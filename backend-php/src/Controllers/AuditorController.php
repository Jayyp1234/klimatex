<?php

namespace App\Controllers;

use App\Core\Request;
use App\Models\SiteResultRepository;
use App\Services\Period\PeriodService;

final class AuditorController
{
    public function __construct(
        private PeriodService $periods = new PeriodService(),
        private SiteResultRepository $results = new SiteResultRepository(),
    ) {
    }

    public function create(Request $request): array
    {
        return ['period' => $this->periods->create((string) $request->input('start', ''), (string) $request->input('end', ''))];
    }

    public function show(Request $request, string $id): array
    {
        $period = $this->periods->get((int) $id);
        $sites = array_map(fn ($r) => ['site_id' => (int) $r['site_id'], 'label' => $r['label'], 'tco2e' => (float) $r['tco2e'],
            'score' => (int) $r['trust_score'], 'status' => $r['status'], 'reviewed' => (bool) $r['reviewed'],
            'failed' => array_values(array_column(array_filter(jdec($r['checks']), fn ($c) => in_array($c['result'], ['fail', 'flag', 'hold'], true)), 'name'))],
            $this->results->forPeriodWithLabels((int) $id));
        return ['id' => (int) $id, 'start' => $period['start_day'], 'end' => $period['end_day'], 'status' => $period['status'],
            'eligible_t' => (float) $period['total_t'], 'carried_t' => (float) $period['carried_t'],
            'sample_seed' => $period['sample_seed'] !== null ? (int) $period['sample_seed'] : null,
            'sample' => jdec($period['sample_site_ids']), 'signed_by' => $period['signed_by'], 'sites' => $sites];
    }

    public function compute(Request $request, string $id): array
    {
        return $this->periods->compute((int) $id);
    }

    public function sample(Request $request, string $id): array
    {
        return $this->periods->sample((int) $id, (int) $request->query('seed', 42));
    }

    public function review(Request $request, string $id, string $site): array
    {
        return $this->periods->review((int) $id, (int) $site, (string) $request->input('decision', ''), (string) $request->input('note', ''));
    }

    /** The signature is the signed-in auditor; it can't be supplied by the caller. */
    public function signOff(Request $request, string $id): array
    {
        return $this->periods->signOff((int) $id, $request->user['name']);
    }
}
