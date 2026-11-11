<?php

namespace App\Services\Carbon;

use App\Config\Settings;
use App\Services\Evidence\EvidenceService;

/** Nine explainable checks. Failed days earn zero; missing days are zero; never filled upward. */
final class Checks
{
    public const PHYSICS_TOLERANCE = 1.1;
    public const CLONE_CORR = 0.99;
    public const CLONE_MIN_DAYS = 14;
    public const SPIKE_FACTOR = 3.0;
    public const GPS_LIMIT_M = 200;

    public static function haversine(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $r = 6371000;
        $p1 = deg2rad($lat1); $p2 = deg2rad($lat2);
        $dp = $p2 - $p1; $dl = deg2rad($lon2 - $lon1);
        $a = sin($dp / 2) ** 2 + cos($p1) * cos($p2) * sin($dl / 2) ** 2;
        return 2 * $r * asin(sqrt($a));
    }

    public static function pearson(array $a, array $b): float
    {
        $n = min(count($a), count($b));
        if ($n < 2) return 0.0;
        $ma = array_sum($a) / $n; $mb = array_sum($b) / $n;
        $num = $da = $db = 0.0;
        for ($i = 0; $i < $n; $i++) {
            $x = $a[$i] - $ma; $y = $b[$i] - $mb;
            $num += $x * $y; $da += $x * $x; $db += $y * $y;
        }
        $den = sqrt($da * $db);
        return $den ? $num / $den : 0.0;
    }

    public static function median(array $v): float
    {
        sort($v);
        $n = count($v);
        return $n % 2 ? $v[intdiv($n, 2)] : ($v[$n / 2 - 1] + $v[$n / 2]) / 2;
    }

    /** $series: [label => [kwh per day]] -> [label => [partner labels]] */
    public static function findClones(array $series): array
    {
        $labels = array_keys($series);
        $out = array_fill_keys($labels, []);
        for ($i = 0; $i < count($labels); $i++) {
            for ($j = $i + 1; $j < count($labels); $j++) {
                $a = $series[$labels[$i]]; $b = $series[$labels[$j]];
                if (min(count($a), count($b)) >= self::CLONE_MIN_DAYS && self::pearson($a, $b) > self::CLONE_CORR) {
                    $out[$labels[$i]][] = $labels[$j];
                    $out[$labels[$j]][] = $labels[$i];
                }
            }
        }
        return $out;
    }

    /**
     * $site: site row + 'generator' row; $readings: rows keyed by day; $sun: [day => kWh/m2];
     * returns [checks, failedDays (day => true), score, status]
     */
    public static function runSite(array $site, array $readings, array $sun, array $allDays, array $clonePartners): array
    {
        $checks = [];
        $failed = [];

        // 1. Sunlight: kWh <= irradiance x panel kWp x 1.1
        // A day with no irradiance record can't be proven, so it fails rather than passes.
        $over = [];
        $unproven = [];
        foreach ($readings as $d => $r) {
            if (!isset($sun[$d])) {
                $unproven[] = $d;
            } elseif ($r['kwh_generated'] > $sun[$d] * $site['panel_kwp'] * self::PHYSICS_TOLERANCE) {
                $over[] = $d;
            }
        }
        foreach ([...$over, ...$unproven] as $d) $failed[$d] = true;
        sort($over);
        $checks[] = ['name' => 'sunlight', 'result' => ($over || $unproven) ? 'fail' : 'pass',
            'evidence' => ['days_over_limit' => count($over), 'days_without_irradiance' => count($unproven), 'first' => $over[0] ?? null,
                'rule' => 'kWh <= NASA irradiance x panel kWp x 1.1']];

        // 2. Energy balance
        $bad = 0;
        foreach ($readings as $r) {
            if ($r['kwh_solar_to_load'] > $r['kwh_generated'] * 1.02) $bad++;
        }
        $checks[] = ['name' => 'energy_balance', 'result' => $bad ? 'flag' : 'pass', 'evidence' => ['days' => $bad]];

        // 3. Clone (pairs found across all sites by the caller)
        $checks[] = ['name' => 'clone', 'result' => $clonePartners ? 'flag' : 'pass',
            'evidence' => ['matches' => $clonePartners, 'rule' => 'corr > 0.99 over 14+ days']];

        // 4. Flat line: 7-day windows with under 1% variation
        $days = array_keys($readings);
        sort($days);
        $series = array_map(fn($d) => $readings[$d]['kwh_generated'], $days);
        $flat = 0;
        for ($i = 0; $i + 7 <= count($series); $i++) {
            $w = array_slice($series, $i, 7);
            $m = array_sum($w) / 7;
            $sd = sqrt(array_sum(array_map(fn($x) => ($x - $m) ** 2, $w)) / 7);
            if ($m > 0 && $sd / $m < 0.01) $flat++;
        }
        $checks[] = ['name' => 'flat_line', 'result' => $flat ? 'flag' : 'pass', 'evidence' => ['flat_windows' => $flat]];

        // 5. Spike: a day over 3x the trailing 30-day median
        $spikes = 0;
        foreach ($days as $i => $d) {
            $window = array_slice($series, max(0, $i - 30), $i - max(0, $i - 30));
            if (count($window) >= 7) {
                $med = self::median($window);
                if ($med > 0 && $readings[$d]['kwh_generated'] > self::SPIKE_FACTOR * $med) {
                    $failed[$d] = true;
                    $spikes++;
                }
            }
        }
        $checks[] = ['name' => 'spike', 'result' => $spikes ? 'fail' : 'pass', 'evidence' => ['days' => $spikes]];

        // 6. Missing data
        $missing = count(array_filter($allDays, fn($d) => !isset($readings[$d])));
        $checks[] = ['name' => 'missing_data', 'result' => $missing ? 'flag' : 'pass',
            'evidence' => ['missing_days' => $missing, 'credited_as' => 0]];

        // 7. Identity: serials unique (database), install photo within 200 m
        $dist = self::haversine($site['lat'], $site['lon'], $site['install_lat'], $site['install_lon']);
        $checks[] = ['name' => 'identity', 'result' => $dist > self::GPS_LIMIT_M ? 'fail' : 'pass',
            'evidence' => ['install_photo_distance_m' => round($dist)]];

        // 8. Decommissioning
        $g = $site['generator'];
        $scrapped = !empty($g['scrapped_on']) && !empty($g['scrap_certificate']);
        $checks[] = ['name' => 'decommissioned', 'result' => $scrapped ? 'pass' : 'hold',
            'evidence' => ['scrapped_on' => $g['scrapped_on'] ?? null, 'certificate' => $g['scrap_certificate'] ?? null,
                'deadline' => EvidenceService::scrapDeadline($site['installed_on'] ?? null)]];

        // 9. Backup share
        $use = 0.0; $backup = 0.0;
        foreach ($readings as $r) {
            $use += $r['kwh_solar_to_load'] + $r['kwh_from_grid'] + $r['kwh_from_backup'];
            $backup += $r['kwh_from_backup'];
        }
        $share = $use > 0 ? $backup / $use : 0;
        $checks[] = ['name' => 'backup_share', 'result' => $share > Settings::BACKUP_LIMIT ? 'fail' : 'pass',
            'evidence' => ['share' => round($share, 4), 'limit' => Settings::BACKUP_LIMIT]];

        // Trust score
        $score = 100;
        $score -= min(60, (int) round(100 * count($failed) / max(1, count($allDays))));
        if ($clonePartners) $score -= 40;
        if ($flat) $score -= 30;
        if ($bad) $score -= 20;
        if ($missing) $score -= min(20, $missing);
        if ($dist > self::GPS_LIMIT_M) $score = 0;
        $score = max(0, $score);

        if ($share > Settings::BACKUP_LIMIT || $score < 50) $status = 'excluded';
        elseif ($score < 80 || !$scrapped) $status = 'held';
        else $status = 'eligible';

        return [$checks, $failed, $score, $status];
    }
}
