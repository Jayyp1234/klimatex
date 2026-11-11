<?php

namespace App\Services\Street;

use App\Config\Database;
use App\Core\HttpException;
use App\Services\Carbon\Grade;

/**
 * Street grade: the same A to G scale as a home, for a whole street.
 *
 * The share of the street's power that still comes from generators, averaged over every home on it:
 *   - homes on KlimateX whose latest period is verified (eligible) count at their metered share;
 *   - every other home, including those not yet on solar and any held or excluded home, counts at the
 *     surveyed generator share before solar (1 - grid hours / 24). Unverified data never improves a grade.
 * Published only as street totals, never per home, and only for streets with at least MIN_HOMES verified homes.
 */
final class StreetService
{
    private const BANDS = ['A' => 0.02, 'B' => 0.10, 'C' => 0.25, 'D' => 0.40, 'E' => 0.55, 'F' => 0.75];
    /** A solar home with a working battery; used to say how many more homes would lift the grade. */
    private const SOLAR_HOME_SHARE = 0.01;

    /**
     * A street is published only with at least this many verified homes. Unverified homes count at a known
     * surveyed share, so with fewer verified homes one home's metered figure could be worked out from the average.
     */
    public const MIN_HOMES = 3;

    private ?array $latest = null;

    /** Demo streets in Surulere. Homes are assigned in label order: 01-05, 06-11, 12-16, 17-20. */
    public const DEMO = [
        ['name' => 'Adeniran Ogunsanya Street', 'homes_total' => 5, 'sites' => 5],
        ['name' => 'Bode Thomas Street', 'homes_total' => 6, 'sites' => 6],
        ['name' => 'Ogunlana Drive', 'homes_total' => 9, 'sites' => 5],
        ['name' => 'Akerele Street', 'homes_total' => 10, 'sites' => 4],
    ];

    /** Puts seeded homes on the demo streets. Safe to run again: only homes without a street are assigned. */
    public static function assignDemo(string $area = 'Surulere', float $gridHours = 6.0, string $surveyedOn = '2025-12-15'): int
    {
        return Database::tx(function () use ($area, $gridHours, $surveyedOn) {
            $sites = Database::all('SELECT id FROM sites WHERE area = ? ORDER BY label', [$area]);
            $assigned = 0;
            $offset = 0;
            foreach (self::DEMO as $street) {
                $id = Database::val('SELECT id FROM streets WHERE name = ? AND area = ?', [$street['name'], $area])
                    ?: Database::insert('streets', ['name' => $street['name'], 'area' => $area, 'homes_total' => $street['homes_total'],
                        'grid_hours_per_day' => $gridHours, 'surveyed_on' => $surveyedOn]);
                foreach (array_slice($sites, $offset, $street['sites']) as $site) {
                    $assigned += Database::run('UPDATE sites SET street_id = ? WHERE id = ? AND street_id IS NULL', [$id, $site['id']])->rowCount();
                }
                $offset += $street['sites'];
            }
            return $assigned;
        });
    }

    public function list(): array
    {
        $streets = array_values(array_filter(array_map(fn ($s) => $this->grade($s), Database::all('SELECT * FROM streets ORDER BY name')),
            fn ($s) => $s['homes_verified'] >= self::MIN_HOMES));
        usort($streets, fn ($a, $b) => $a['generator_share'] <=> $b['generator_share']);
        return ['streets' => $streets, 'as_of' => $this->latestPeriodEnd(),
            'method' => 'Share of power still from generators across every home on the street. Homes not yet verified on KlimateX count at their surveyed generator use.'];
    }

    /** The street a home is on, with the home's own grade beside it. */
    public function forSite(int $siteId): array
    {
        $street = Database::one('SELECT st.* FROM streets st JOIN sites s ON s.street_id = st.id WHERE s.id = ?', [$siteId])
            ?? throw new HttpException(404, 'This home is not linked to a street yet.');
        $graded = $this->grade($street);
        if ($graded['homes_verified'] < self::MIN_HOMES) {
            throw new HttpException(404, 'Your street needs a few more homes on KlimateX before it gets a grade.');
        }
        $home = $this->latest()[$siteId] ?? null;
        return ['street' => $graded, 'home_grade' => $home['grade'] ?? null, 'as_of' => $this->latestPeriodEnd()];
    }

    private function grade(array $street): array
    {
        $total = (int) $street['homes_total'];
        $before = Grade::beforeShare((float) $street['grid_hours_per_day']);
        $sites = Database::all('SELECT id FROM sites WHERE street_id = ?', [$street['id']]);
        $latest = $this->latest();
        $verified = array_values(array_filter(array_map(fn ($s) => $latest[$s['id']] ?? null, $sites), fn ($r) => $r && $r['status'] === 'eligible'));
        $others = max(0, $total - count($verified));
        $sum = array_sum(array_map(fn ($r) => (float) $r['generator_share'], $verified)) + $others * $before;
        $share = $total > 0 ? $sum / $total : $before;
        $grade = Grade::forShare($share);

        // How many more homes switching to verified solar would lift the street one grade.
        $next = null;
        $needed = null;
        $letters = array_keys(self::BANDS);
        $index = array_search($grade, $letters, true);
        if ($index !== false && $index > 0 && $before > self::SOLAR_HOME_SHARE) {
            $next = $letters[$index - 1];
            $gap = $sum - self::BANDS[$next] * $total;
            $k = (int) ceil($gap / ($before - self::SOLAR_HOME_SHARE));
            $needed = $k >= 1 && $k <= $others ? $k : null;
            $next = $needed ? $next : null;
        }
        return ['id' => (int) $street['id'], 'name' => $street['name'], 'area' => $street['area'], 'grade' => $grade,
            'generator_share' => round($share, 3), 'homes_total' => $total, 'homes_on_klimatex' => count($sites),
            'homes_verified' => count($verified), 'next_grade' => $next, 'homes_needed_for_next' => $needed];
    }

    /** Latest computed result per site, read once per request. */
    private function latest(): array
    {
        if ($this->latest !== null) {
            return $this->latest;
        }
        // The newest period with results; an open, uncomputed period would blank every grade.
        $period = Database::val("SELECT MAX(id) FROM periods WHERE status IN ('computed', 'sampled', 'signed')");
        $this->latest = [];
        foreach ($period ? Database::all('SELECT site_id, status, generator_share, grade FROM site_results WHERE period_id = ?', [$period]) : [] as $r) {
            $this->latest[(int) $r['site_id']] = $r;
        }
        return $this->latest;
    }

    private function latestPeriodEnd(): ?string
    {
        return Database::val("SELECT end_day FROM periods WHERE status IN ('computed', 'sampled', 'signed') ORDER BY id DESC LIMIT 1") ?: null;
    }
}
