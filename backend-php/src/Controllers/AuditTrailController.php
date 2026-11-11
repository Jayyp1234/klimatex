<?php

namespace App\Controllers;

use App\Config\Database;
use App\Core\Request;
use App\Models\SiteRepository;
use App\Services\Ledger\Ledger;
use App\Services\Period\PeriodService;

/** Read-only views for the auditor portal: every period at a glance, and each period's entries in the ledger. */
final class AuditTrailController
{
    private const PERIOD_EVENTS = ['period.created', 'period.computed', 'period.sampled', 'site.reviewed', 'period.signed'];

    public function index(Request $request): array
    {
        $counts = [];
        foreach (Database::all('SELECT period_id, status, COUNT(*) AS n, SUM(reviewed) AS reviewed FROM site_results GROUP BY period_id, status') as $r) {
            $counts[(int) $r['period_id']][$r['status']] = (int) $r['n'];
            $counts[(int) $r['period_id']]['reviewed'] = ($counts[(int) $r['period_id']]['reviewed'] ?? 0) + (int) $r['reviewed'];
        }
        $credits = [];
        foreach (Database::all('SELECT period_id, COUNT(*) AS n, SUM(CASE WHEN status = \'retired\' THEN 1 ELSE 0 END) AS retired FROM credits GROUP BY period_id') as $r) {
            $credits[(int) $r['period_id']] = ['issued' => (int) $r['n'], 'retired' => (int) $r['retired']];
        }
        $periods = array_map(function ($p) use ($counts, $credits) {
            $id = (int) $p['id'];
            $c = $counts[$id] ?? [];
            return ['id' => $id, 'start' => $p['start_day'], 'end' => $p['end_day'], 'status' => $p['status'],
                'eligible_t' => round((float) $p['total_t'], 3), 'carried_t' => round((float) $p['carried_t'], 3),
                'sample_seed' => $p['sample_seed'] !== null ? (int) $p['sample_seed'] : null, 'sample' => jdec($p['sample_site_ids']) ?? [],
                'signed_by' => $p['signed_by'], 'signed_at' => $p['signed_at'],
                'registry' => ['project' => $p['registry_project_id'], 'mrv' => $p['registry_mrv_id']],
                'homes' => ['eligible' => $c['eligible'] ?? 0, 'held' => $c['held'] ?? 0, 'excluded' => $c['excluded'] ?? 0, 'reviewed' => $c['reviewed'] ?? 0],
                'credits' => $credits[$id] ?? ['issued' => 0, 'retired' => 0]];
        }, Database::all('SELECT * FROM periods ORDER BY start_day DESC, id DESC'));
        // A period can only be computed once readings cover it, so the portal needs the newest reading day.
        return ['periods' => $periods, 'ledger' => Ledger::verify(), 'data_as_of' => (new SiteRepository())->latestReadingDay()];
    }

    /** Every ledger entry about one period, oldest first, with its hash so anyone can check the chain. */
    public function trail(Request $request, string $id): array
    {
        (new PeriodService())->get((int) $id);
        $events = [];
        foreach (Database::all('SELECT * FROM ledger ORDER BY id') as $e) {
            $payload = jdec($e['payload']) ?? [];
            if (in_array($e['event_type'], self::PERIOD_EVENTS, true) && (int) ($payload['period'] ?? 0) === (int) $id) {
                $events[] = ['id' => (int) $e['id'], 'at' => $e['ts'], 'type' => $e['event_type'], 'payload' => $payload, 'hash' => $e['hash']];
            }
        }
        return ['events' => $events];
    }
}
