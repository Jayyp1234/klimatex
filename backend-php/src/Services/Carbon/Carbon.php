<?php

namespace App\Services\Carbon;

use App\Config\Settings;
use RuntimeException;

/**
 * The methodology in use, chosen by METHODOLOGY (default Gold Standard JUST v1).
 * To add one (e.g. the ESE framework once Gold Standard publishes it), implement Methodology
 * and register it in ALL; the checks, audit and market stay the same.
 */
final class Carbon
{
    /** @var array<string, class-string<Methodology>> */
    public const ALL = ['gs-just-v1' => JustV1::class];

    public static function methodology(): Methodology
    {
        $code = Settings::methodology();
        $class = self::ALL[$code] ?? throw new RuntimeException("Unknown methodology: $code");
        return new $class();
    }

    /** One home-month. Defaults describe a calibrated meter and a measured baseline (no deductions). */
    public static function siteMonth(float $solarKwh, float $backupKwh, int $days, float $gridHours, float $gensetKva,
                                     float $baselineKwhPerDay, ?float $meterAccuracyPct = 1.0, string $baselineTier = 'measured'): array
    {
        return self::methodology()->siteMonth(['solar_kwh' => $solarKwh, 'backup_kwh' => $backupKwh, 'days' => $days,
            'grid_hours' => $gridHours, 'genset_kva' => $gensetKva, 'baseline_kwh_per_day' => $baselineKwhPerDay,
            'meter_accuracy_pct' => $meterAccuracyPct, 'baseline_tier' => $baselineTier]);
    }
}
