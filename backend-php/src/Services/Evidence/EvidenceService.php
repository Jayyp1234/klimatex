<?php

namespace App\Services\Evidence;

use App\Config\Database;
use App\Core\HttpException;
use App\Services\Carbon\JustV1;
use App\Services\Ledger\Ledger;

/**
 * The evidence behind a home's baseline and meter, and what it means for the home's credits.
 *
 * Baseline: 12 monthly fuel receipts from the 12 months before solar was installed make the baseline
 * "measured"; with fewer, it stays "surveyed" and the methodology credits it conservatively.
 * Meter: accuracy at 95% confidence, recorded by the installer from the calibration certificate.
 * Generator: it must be scrapped within 24 months of installation; until then the home earns nothing.
 */
final class EvidenceService
{
    public const RECEIPT_MONTHS = 12;
    public const SCRAP_WINDOW_MONTHS = 24;
    private const MAX_LITRES = 2000;
    private const MAX_NAIRA = 5_000_000;

    /** The 12 calendar months before the installation month, oldest first. */
    public static function receiptMonths(?string $installedOn): array
    {
        if (!$installedOn) {
            return [];
        }
        $first = (new \DateTimeImmutable(substr($installedOn, 0, 7) . '-01'))->modify('-' . self::RECEIPT_MONTHS . ' months');
        return array_map(fn ($i) => $first->modify("+$i months")->format('Y-m'), range(0, self::RECEIPT_MONTHS - 1));
    }

    public static function scrapDeadline(?string $installedOn): ?string
    {
        return $installedOn ? (new \DateTimeImmutable($installedOn))->modify('+' . self::SCRAP_WINDOW_MONTHS . ' months')->format('Y-m-d') : null;
    }

    /** Months with a receipt, inside the window, per site. @return array<int, int> */
    public static function receiptCounts(): array
    {
        $out = [];
        foreach (Database::all('SELECT s.id, s.installed_on, r.month FROM fuel_receipts r JOIN sites s ON s.id = r.site_id') as $row) {
            if (in_array($row['month'], self::receiptMonths($row['installed_on']), true)) {
                $out[(int) $row['id']] = ($out[(int) $row['id']] ?? 0) + 1;
            }
        }
        return $out;
    }

    public static function tier(int $months): string
    {
        return $months >= self::RECEIPT_MONTHS ? 'measured' : 'surveyed';
    }

    /** Everything a tip or a dashboard needs about one home's evidence. */
    public function forSite(int $siteId): array
    {
        $site = Database::one('SELECT s.id, s.installed_on, i.accuracy_pct, i.calibrated_on, g.scrapped_on, g.scrap_certificate
            FROM sites s JOIN inverters i ON i.site_id = s.id JOIN generators g ON g.site_id = s.id WHERE s.id = ?', [$siteId])
            ?? throw new HttpException(404, 'Home not found.');
        $window = self::receiptMonths($site['installed_on']);
        $receipts = $this->receipts($siteId);
        $have = array_values(array_intersect($window, array_column($receipts, 'month')));
        $accuracy = $site['accuracy_pct'] !== null ? (float) $site['accuracy_pct'] : null;
        $litres = array_sum(array_map(fn ($r) => in_array($r['month'], $window, true) ? $r['litres'] : 0, $receipts));
        return [
            'baseline' => ['tier' => self::tier(count($have)), 'months' => count($have), 'needed' => self::RECEIPT_MONTHS,
                'missing_months' => array_values(array_diff($window, $have)), 'from' => $window[0] ?? null, 'to' => end($window) ?: null,
                'litres_per_month' => $have ? round($litres / count($have), 1) : null,
                'deduction' => JustV1::baselineDeduction(self::tier(count($have)))],
            'meter' => ['accuracy_pct' => $accuracy, 'calibrated_on' => $site['calibrated_on'], 'limit_pct' => JustV1::METER_LIMIT_PCT,
                'within_limit' => $accuracy !== null && $accuracy <= JustV1::METER_LIMIT_PCT, 'deduction' => JustV1::meterDeduction($accuracy)],
            'generator' => ['scrapped' => !empty($site['scrapped_on']) && !empty($site['scrap_certificate']), 'scrapped_on' => $site['scrapped_on'],
                'deadline' => self::scrapDeadline($site['installed_on'])],
            'receipts' => $receipts,
        ];
    }

    public function receipts(int $siteId): array
    {
        return array_map(fn ($r) => ['month' => $r['month'], 'litres' => (float) $r['litres'], 'amount_naira' => (int) $r['amount_naira']],
            Database::all('SELECT month, litres, amount_naira FROM fuel_receipts WHERE site_id = ? ORDER BY month', [$siteId]));
    }

    /** A household records one month's fuel receipts. Re-entering a month replaces it. */
    public function addReceipt(int $siteId, int $userId, string $month, mixed $litres, mixed $naira): array
    {
        $site = Database::one('SELECT installed_on FROM sites WHERE id = ?', [$siteId]) ?? throw new HttpException(404, 'Home not found.');
        $window = self::receiptMonths($site['installed_on']);
        if (!in_array($month, $window, true)) {
            throw new HttpException(422, sprintf('Receipts count for the 12 months before your solar was installed (%s to %s).',
                $window[0] ?? '?', end($window) ?: '?'), ['month' => 'Pick a month in that range.']);
        }
        if (!is_numeric($litres) || $litres <= 0 || $litres > self::MAX_LITRES) {
            throw new HttpException(422, 'Enter the litres bought that month.', ['litres' => 'Between 1 and 2,000 litres.']);
        }
        if (!is_numeric($naira) || $naira < 0 || $naira > self::MAX_NAIRA || (int) $naira != $naira) {
            throw new HttpException(422, 'Enter what you paid in whole naira.', ['amount_naira' => 'Up to ₦5,000,000.']);
        }
        Database::tx(function () use ($siteId, $userId, $month, $litres, $naira) {
            Database::run('DELETE FROM fuel_receipts WHERE site_id = ? AND month = ?', [$siteId, $month]);
            Database::insert('fuel_receipts', ['site_id' => $siteId, 'month' => $month, 'litres' => round((float) $litres, 1),
                'amount_naira' => (int) $naira, 'added_by' => $userId, 'created_at' => now_iso()]);
            Ledger::append('evidence.fuel_receipt', ['site' => $siteId, 'month' => $month, 'litres' => round((float) $litres, 1)]);
        });
        return $this->forSite($siteId);
    }

    /** The installer records the meter's accuracy from its calibration certificate. */
    public function recordMeter(int $siteId, mixed $accuracyPct, string $calibratedOn): array
    {
        if (!is_numeric($accuracyPct) || $accuracyPct <= 0 || $accuracyPct > 50) {
            throw new HttpException(422, 'Enter the meter accuracy from its certificate, as ± percent at 95% confidence.', ['accuracy_pct' => 'Between 0.1 and 50.']);
        }
        $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $calibratedOn);
        if (!$date || $date->format('Y-m-d') !== $calibratedOn || $calibratedOn > gmdate('Y-m-d')) {
            throw new HttpException(422, 'Enter the calibration date as YYYY-MM-DD, not in the future.', ['calibrated_on' => 'Use the date on the certificate.']);
        }
        Database::tx(function () use ($siteId, $accuracyPct, $calibratedOn) {
            Database::run('UPDATE inverters SET accuracy_pct = ?, calibrated_on = ? WHERE site_id = ?', [round((float) $accuracyPct, 2), $calibratedOn, $siteId]);
            Ledger::append('evidence.meter', ['site' => $siteId, 'accuracy_pct' => round((float) $accuracyPct, 2), 'calibrated_on' => $calibratedOn]);
        });
        return $this->forSite($siteId);
    }

    /**
     * Demo evidence for seeded homes. Safe to run again: only fills what is missing.
     * Every simulator meter is class 1 (±1%) except Home 09 (±8%); every home has its 12 receipts
     * except Home 12 (Adaeze), who has 5, so her baseline is still surveyed.
     */
    public static function assignDemo(): array
    {
        return Database::tx(function () {
            $meters = 0;
            $receipts = 0;
            foreach (Database::all("SELECT s.id, s.label, s.installed_on, i.accuracy_pct FROM sites s JOIN inverters i ON i.site_id = s.id
                WHERE i.vendor = 'simulator' ORDER BY s.id") as $site) {
                if ($site['accuracy_pct'] === null) {
                    $accuracy = $site['label'] === 'Home 09' ? 8.0 : 1.0;
                    $meters += Database::run('UPDATE inverters SET accuracy_pct = ?, calibrated_on = ? WHERE site_id = ? AND accuracy_pct IS NULL',
                        [$accuracy, '2025-12-18', $site['id']])->rowCount();
                }
                $months = self::receiptMonths($site['installed_on']);
                $months = $site['label'] === 'Home 12' ? array_slice($months, -5) : $months;
                foreach ($months as $i => $month) {
                    $litres = 80 + (int) $site['id'] * 2 + ($i % 3) * 5;
                    $receipts += Database::insertIgnore('fuel_receipts', ['site_id' => $site['id'], 'month' => $month, 'litres' => $litres,
                        'amount_naira' => $litres * 700, 'added_by' => null, 'created_at' => '2025-12-20T09:00:00Z']) ? 1 : 0;
                }
            }
            return ['meters' => $meters, 'receipts' => $receipts];
        });
    }
}
