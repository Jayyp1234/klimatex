<?php

namespace App\Services\Home;

use App\Config\Settings;
use App\Models\SiteRepository;
use App\Models\SiteResultRepository;
use App\Services\Evidence\EvidenceService;

/**
 * Credit tips: what a home can do to earn more, read from its own checks and evidence.
 *
 * Every tip points at a rule that already decides the home's credits (missing days earn zero,
 * backup above 10% excludes the period, no credits until the generator is scrapped, a surveyed
 * baseline and an inaccurate meter are credited lower), so the advice is never a guess.
 * Written for the household by default, or for the installer with $forInstaller.
 */
final class CreditTips
{
    private const ORDER = ['high' => 0, 'medium' => 1, 'low' => 2];

    public function __construct(
        private SiteRepository $sites = new SiteRepository(),
        private SiteResultRepository $results = new SiteResultRepository(),
        private EvidenceService $evidence = new EvidenceService(),
        private HomeService $homes = new HomeService(),
    ) {
    }

    public function forSite(int $siteId, bool $forInstaller = false): array
    {
        $site = $this->sites->detail($siteId);
        $result = $this->results->latestForSite($siteId);
        $evidence = $this->evidence->forSite($siteId);
        $checks = [];
        foreach ($result ? jdec($result['checks']) : [] as $check) {
            $checks[$check['name']] = $check;
        }
        $tips = [];
        $add = function (string $kind, bool $done, string $priority, string $who, string $title, string $body, ?array $action = null) use (&$tips) {
            $tips[] = ['id' => $kind, 'kind' => $kind, 'status' => $done ? 'done' : 'todo', 'priority' => $priority, 'who' => $who,
                'title' => $title, 'body' => $body, 'action' => $done ? null : $action];
        };
        $you = fn (string $household, string $installer) => $forInstaller ? $installer : $household;

        // Live problems first: they cost credits today.
        foreach ($this->homes->alerts($siteId)['alerts'] as $alert) {
            if ($alert['kind'] === 'no_data') {
                $add('offline', false, 'high', 'household', $you('Your inverter is offline', 'Inverter offline'),
                    $alert['body'] . ' ' . $you('Every day without data earns nothing.', 'Every day without data earns this home nothing.'));
            }
            if ($alert['kind'] === 'low_output') {
                $add('low_output', false, 'medium', 'household', $you($alert['title'], 'Output down this week'),
                    $you($alert['body'], 'The panels made less than the sunlight allows. Ask the family to clean them, then check the inverter if it continues.'));
            }
        }

        $g = $evidence['generator'];
        $deadline = self::day($g['deadline']);
        $add('generator', $g['scrapped'], 'high', 'household',
            $g['scrapped'] ? 'Old generator scrapped' : $you('Scrap your old generator to start earning', 'Generator not yet scrapped'),
            $g['scrapped'] ? 'A recycler confirmed it on ' . self::day($g['scrapped_on']) . '. Credits can be issued.'
                : "No credits are issued until a licensed recycler confirms the generator is scrapped. The 24-month window closes on $deadline.",
            ['label' => $you('Ask your installer', 'Book the recycler'), 'href' => null]);

        if (isset($checks['backup_share'])) {
            $share = (float) $checks['backup_share']['evidence']['share'];
            $pct = round($share * 100, 1);
            $limit = (int) round(Settings::BACKUP_LIMIT * 100);
            if ($share > Settings::BACKUP_LIMIT) {
                $add('backup', false, 'high', 'household', $you("Your backup generator ran $pct% of your power", "Backup generator at $pct%"),
                    "Above $limit%, the whole period earns nothing. " . $you('Use it only when the battery is empty and the grid is off.', 'Help the family size the battery so the generator stays off.'));
            } elseif ($share > Settings::BACKUP_LIMIT / 2) {
                $add('backup', false, 'medium', 'household', $you("Backup generator at $pct%, close to the $limit% limit", "Backup generator at $pct%, near the limit"),
                    "Above $limit%, the whole period earns nothing. " . $you('Run it less, especially in the evening when the battery should carry you.', 'Check the battery is charging fully and the load is not too big for it.'));
            } else {
                $add('backup', true, 'low', 'household', "Backup generator at $pct%", "Well under the $limit% limit.");
            }
        }

        if (isset($checks['missing_data'])) {
            $missing = (int) $checks['missing_data']['evidence']['missing_days'];
            $add('missing_data', $missing === 0, 'medium', 'household',
                $missing ? "$missing " . ($missing === 1 ? 'day' : 'days') . ' with no data earned nothing' : 'No missing days',
                $missing ? $you('Days without readings count as zero. Keep the inverter and its Wi-Fi on, day and night.', 'Days without readings count as zero. Check the data logger and its connection.')
                    : 'Every day of the last period was recorded.');
        }

        $b = $evidence['baseline'];
        $receiptCut = (int) round($b['deduction'] * 100);
        $add('fuel_receipts', $b['tier'] === 'measured', 'medium', 'household',
            $b['tier'] === 'measured' ? 'Baseline measured from 12 months of fuel receipts' : "Add your fuel receipts: {$b['months']} of {$b['needed']} months",
            $b['tier'] === 'measured' ? 'Your credits use your real fuel use before solar, not an estimate.'
                : sprintf('Receipts for %s to %s, the year before solar, turn the estimated baseline into a measured one. Until then credits are cut by %d%%.',
                    self::month($b['from']), self::month($b['to']), $receiptCut),
            $forInstaller ? null : ['label' => 'Add receipts', 'href' => '/app/household/receipts/']);

        $m = $evidence['meter'];
        $meterCut = (int) round($m['deduction'] * 100);
        if ($m['accuracy_pct'] === null) {
            $add('meter', false, 'high', 'installer', 'Meter has no calibration record',
                "Without a certificate showing ±{$m['limit_pct']}% accuracy at 95% confidence, readings are credited $meterCut% lower. "
                . $you('Ask your installer to add it.', 'Record it from the calibration certificate.'));
        } elseif (!$m['within_limit']) {
            $add('meter', false, 'high', 'installer', $you('Your meter is less accurate than required', "Meter at ±{$m['accuracy_pct']}%, above the limit"),
                "It is rated ±{$m['accuracy_pct']}%, but ±{$m['limit_pct']}% at 95% confidence is required, so readings are credited at the low end: $meterCut% less. "
                . $you('Ask your installer to recalibrate or replace it.', 'Recalibrate or replace it, then record the new certificate.'));
        } else {
            $add('meter', true, 'low', 'installer', "Meter accurate to ±{$m['accuracy_pct']}%",
                'Within the ±' . $m['limit_pct'] . '% limit' . ($m['calibrated_on'] ? ', calibrated ' . self::day($m['calibrated_on']) : '') . '. Readings are credited in full.');
        }

        // Check failures the installer has to fix.
        $failedDays = (int) ($checks['sunlight']['evidence']['days_over_limit'] ?? 0) + (int) ($checks['spike']['evidence']['days'] ?? 0);
        if ($failedDays) {
            $add('impossible_days', false, 'high', 'installer', "$failedDays days read higher than the sunshine allows",
                'Those days earned nothing. ' . $you('Ask your installer to check the inverter.', 'The inverter or its settings may be faulty.'));
        }
        if (($checks['clone']['result'] ?? 'pass') !== 'pass') {
            $add('clone', false, 'high', 'installer', $you('Your readings need an auditor\'s check', 'Readings match another home too closely'),
                'An auditor checks this home before it can earn. ' . $you('Your installer will be in touch.', 'Confirm each inverter is reporting its own home.'));
        }
        if (($checks['flat_line']['result'] ?? 'pass') !== 'pass') {
            $add('flat_line', false, 'medium', 'installer', 'Readings stopped changing for a week',
                'Usually a frozen data logger. ' . $you('Switch the inverter off and on again, or ask your installer.', 'Restart the logger and check its firmware.'));
        }
        if (($checks['energy_balance']['result'] ?? 'pass') !== 'pass') {
            $add('energy_balance', false, 'medium', 'installer', "Inverter figures don't add up on {$checks['energy_balance']['evidence']['days']} days",
                'More solar went to the home than the panels made. ' . $you('Your installer should check the inverter settings.', 'Check the inverter configuration.'));
        }
        if (($checks['identity']['result'] ?? 'pass') !== 'pass') {
            $add('identity', false, 'high', 'installer', 'Install photo taken away from the home',
                "It was taken {$checks['identity']['evidence']['install_photo_distance_m']} m from the home's location, more than the 200 m allowed. The home earns nothing until it is redone.");
        }

        usort($tips, fn ($a, $b) => [$a['status'] === 'done', self::ORDER[$a['priority']]] <=> [$b['status'] === 'done', self::ORDER[$b['priority']]]);
        $cut = 1 - (1 - $m['deduction']) * (1 - $b['deduction']);
        return ['home' => ['id' => $siteId, 'label' => $site['label'], 'household' => $site['name']],
            'period' => $result ? ['id' => (int) $result['period_id'], 'status' => $result['status']] : null,
            'todo' => count(array_filter($tips, fn ($t) => $t['status'] === 'todo')),
            'credits_cut_pct' => (int) round($cut * 100),
            'tips' => $tips];
    }

    /** Every home an installer looks after, the homes with the most to fix first. */
    public function forInstaller(?int $installerId): array
    {
        $homes = [];
        foreach ($this->sites->allWithHousehold($installerId) as $site) {
            $tips = $this->forSite((int) $site['id'], true);
            $homes[] = ['home' => $tips['home'], 'period' => $tips['period'], 'todo' => $tips['todo'], 'credits_cut_pct' => $tips['credits_cut_pct'],
                'tips' => array_values(array_filter($tips['tips'], fn ($t) => $t['status'] === 'todo'))];
        }
        $high = fn (array $h) => count(array_filter($h['tips'], fn ($t) => $t['priority'] === 'high'));
        usort($homes, fn ($a, $b) => [$high($b), $b['todo']] <=> [$high($a), $a['todo']]);
        $byKind = [];
        foreach ($homes as $h) {
            foreach ($h['tips'] as $t) {
                $byKind[$t['kind']] = ($byKind[$t['kind']] ?? 0) + 1;
            }
        }
        arsort($byKind);
        return ['homes' => $homes, 'by_kind' => $byKind, 'homes_with_todo' => count(array_filter($homes, fn ($h) => $h['todo'] > 0))];
    }

    /** Dates as families read them. */
    private static function day(?string $iso): string
    {
        return $iso ? gmdate('j M Y', strtotime($iso)) : 'unknown';
    }

    private static function month(?string $ym): string
    {
        return $ym ? gmdate('M Y', strtotime("$ym-01")) : '?';
    }
}
