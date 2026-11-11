<?php

namespace App\Services\Carbon;

/**
 * A crediting methodology: how one home-month of metered solar becomes tonnes.
 *
 * The checks, the audit sample and the market don't depend on which methodology runs, so moving
 * to another one (for example Gold Standard's ESE framework, once it is published) means adding a
 * class here and changing METHODOLOGY, not rewriting the pipeline.
 */
interface Methodology
{
    /** Short code stored with every computed period, e.g. "gs-just-v1". */
    public function code(): string;

    public function name(): string;

    /** The constants this methodology uses, published so anyone can recheck a result. */
    public function parameters(): array;

    /**
     * @param array{solar_kwh:float, backup_kwh:float, days:int, grid_hours:float, genset_kva:float,
     *              baseline_kwh_per_day:float, meter_accuracy_pct:?float, baseline_tier:string} $in
     * @return array<string, float|string> must include er_t, eg_res_kwh and eg_credited_kwh
     */
    public function siteMonth(array $in): array;
}
