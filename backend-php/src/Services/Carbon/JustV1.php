<?php

namespace App\Services\Carbon;

use App\Config\Settings;

/**
 * Gold Standard JUST: Fossil Fuel Generators v1.0, Scenario B (unreliable grid).
 *   EG_cred     = EG_RES x (1 - meter deduction)     metered kWh at the lower end of the meter's accuracy
 *   EG_BAS cap  = P_genset(kW) x hours x AF
 *   S_grid      = grid hours / 24,  S_genset = 1 - S_grid
 *   BE          = min(EG_cred, EG_BAS) x (S_genset x EF_BL + S_grid x EF_grid) x (1 - DAF) x (1 - baseline deduction)
 *   AE          = backup fossil kWh x EF_BL + embodied
 *   LE          = max(0, (baseline - EG_RES) x 1.3 t/MWh)
 *   ER          = max(0, BE - AE - LE)
 *
 * Meter deduction: a meter proven to ±5% at 95% confidence is credited in full. A less accurate one
 * is credited at the lower end of its range; one with no calibration record is treated as ±10%.
 * Baseline deduction: a baseline measured from 12 months of fuel receipts is used as is; one taken
 * from the survey alone is cut by 10%.
 * The two deductions, like the emission factors, are our conservative placeholders until they are
 * checked against the methodology's annexes and the validator's opinion.
 */
final class JustV1 implements Methodology
{
    public const METER_LIMIT_PCT = 5.0;
    public const METER_UNKNOWN_PCT = 10.0;
    public const SURVEY_BASELINE_DEDUCTION = 0.10;

    public function code(): string { return 'gs-just-v1'; }

    public function name(): string { return 'Gold Standard JUST: Fossil Fuel Generators v1.0 (Scenario B)'; }

    public function parameters(): array
    {
        return ['ef_genset_t_per_mwh' => Settings::EF_GENSET, 'ef_grid_t_per_mwh' => Settings::EF_GRID,
            'daf_netzero' => Settings::DAF_NETZERO, 'availability_factor' => Settings::AVAILABILITY_FACTOR,
            'leakage_t_per_mwh' => Settings::LEAKAGE_T_PER_MWH, 'embodied_t_site_month' => Settings::EMBODIED_T_SITE_MONTH,
            'backup_limit' => Settings::BACKUP_LIMIT, 'meter_limit_pct' => self::METER_LIMIT_PCT,
            'meter_unknown_pct' => self::METER_UNKNOWN_PCT, 'survey_baseline_deduction' => self::SURVEY_BASELINE_DEDUCTION];
    }

    /** Share of metered kWh not credited because of the meter's accuracy. */
    public static function meterDeduction(?float $accuracyPct): float
    {
        $pct = $accuracyPct ?? self::METER_UNKNOWN_PCT;
        return $pct <= self::METER_LIMIT_PCT ? 0.0 : min(1.0, $pct / 100);
    }

    public static function baselineDeduction(string $tier): float
    {
        return $tier === 'measured' ? 0.0 : self::SURVEY_BASELINE_DEDUCTION;
    }

    public function siteMonth(array $in): array
    {
        [$solar, $days] = [(float) $in['solar_kwh'], (int) $in['days']];
        $meterCut = self::meterDeduction($in['meter_accuracy_pct']);
        $baselineCut = self::baselineDeduction($in['baseline_tier']);
        $creditedKwh = $solar * (1 - $meterCut);

        $cap = $in['genset_kva'] * 0.8 * 24 * $days * Settings::AVAILABILITY_FACTOR;
        $sGrid = max(0.0, min(1.0, $in['grid_hours'] / 24));
        $sGen = 1 - $sGrid;
        $be = min($creditedKwh, $cap) / 1000 * ($sGen * Settings::EF_GENSET + $sGrid * Settings::EF_GRID)
            * (1 - Settings::DAF_NETZERO) * (1 - $baselineCut);
        $ae = $in['backup_kwh'] / 1000 * Settings::EF_GENSET + Settings::EMBODIED_T_SITE_MONTH;
        $le = max(0.0, ($in['baseline_kwh_per_day'] * $days - $solar) / 1000 * Settings::LEAKAGE_T_PER_MWH);
        $er = max(0.0, $be - $ae - $le);
        $r = fn ($x) => round($x, 4);
        return ['eg_res_kwh' => $r($solar), 'eg_credited_kwh' => $r($creditedKwh), 'eg_cap_kwh' => $r($cap), 's_grid' => $r($sGrid),
            'meter_deduction' => $r($meterCut), 'baseline_tier' => $in['baseline_tier'], 'baseline_deduction' => $r($baselineCut),
            'be_t' => $r($be), 'ae_t' => $r($ae), 'le_t' => $r($le), 'er_t' => $r($er)];
    }
}
