<?php

namespace App\Services\Fleet;

use App\Config\Database;
use App\Models\PeriodRepository;
use App\Models\SiteRepository;
use App\Services\Home\HomeService;

/**
 * One read-only view of many homes: for an installer, the homes it fitted; for the lender and
 * operations, every home. Everything here is computed from the same tables the household app reads,
 * so a home's numbers match on every screen.
 */
final class FleetService
{
    public function __construct(
        private SiteRepository $sites = new SiteRepository(),
        private PeriodRepository $periods = new PeriodRepository(),
        private HomeService $homes = new HomeService(),
    ) {
    }

    public function overview(?int $installerId): array
    {
        $where = $installerId !== null ? 'WHERE s.installer_id = ?' : '';
        $params = $installerId !== null ? [$installerId] : [];
        $asOf = $this->sites->latestReadingDay();
        $periodId = $this->periods->latestId();
        $period = $periodId ? $this->periods->find($periodId) : null;
        $weekStart = $asOf ? gmdate('Y-m-d', strtotime("$asOf -6 days")) : null;

        $sites = Database::all("SELECT s.id, s.label, s.area, s.panel_kwp, s.installed_on, s.installer_id, h.name, h.loan_id,
                i.serial AS inverter_serial, i.vendor, ins.name AS installer
            FROM sites s JOIN households h ON h.id = s.household_id JOIN inverters i ON i.site_id = s.id
            JOIN installers ins ON ins.id = s.installer_id $where ORDER BY s.id", $params);
        $ids = array_map(fn ($s) => (int) $s['id'], $sites);

        $results = [];
        foreach ($periodId ? Database::all('SELECT * FROM site_results WHERE period_id = ?', [$periodId]) : [] as $r) {
            $results[(int) $r['site_id']] = $r;
        }
        $energy = [];
        foreach (Database::all("SELECT i.site_id, MAX(r.day) AS last_day, SUM(r.kwh_generated) AS kwh,
                SUM(CASE WHEN r.day >= ? THEN r.kwh_generated ELSE 0 END) AS kwh_week
            FROM readings r JOIN inverters i ON i.id = r.inverter_id GROUP BY i.site_id", [$weekStart ?? '9999-12-31']) as $row) {
            $energy[(int) $row['site_id']] = $row;
        }
        $paid = [];
        foreach (Database::all("SELECT site_id, SUM(amount_kobo) AS kobo,
                SUM(CASE WHEN recipient LIKE '%solar loan%' THEN amount_kobo ELSE 0 END) AS loan_kobo
            FROM payouts WHERE role = 'household' AND status = 'paid' GROUP BY site_id") as $row) {
            $paid[(int) $row['site_id']] = $row;
        }

        $homes = [];
        foreach ($sites as $s) {
            $id = (int) $s['id'];
            $r = $results[$id] ?? null;
            $e = $energy[$id] ?? null;
            $alerts = array_column($this->homes->alerts($id)['alerts'], 'kind');
            $offline = in_array('no_data', $alerts, true);
            $homes[] = [
                'id' => $id, 'label' => $s['label'], 'household' => $s['name'], 'area' => $s['area'], 'installer' => $s['installer'],
                'inverter' => $s['inverter_serial'], 'vendor' => $s['vendor'], 'panel_kwp' => (float) $s['panel_kwp'], 'installed_on' => $s['installed_on'],
                'grade' => $r['grade'] ?? null, 'trust_score' => $r ? (int) $r['trust_score'] : null, 'status' => $r['status'] ?? null,
                'tco2e' => $r ? round((float) $r['tco2e'], 3) : 0.0, 'generator_share' => $r ? (float) $r['generator_share'] : null,
                'last_reading' => $e['last_day'] ?? null, 'kwh_period' => round((float) ($e['kwh'] ?? 0), 1), 'kwh_week' => round((float) ($e['kwh_week'] ?? 0), 1),
                'health' => $offline ? 'offline' : (in_array('low_output', $alerts, true) ? 'low_output' : 'reporting'),
                'loan' => $s['loan_id'], 'paid_naira' => (int) ($paid[$id]['kobo'] ?? 0) / 100, 'loan_repaid_naira' => (int) ($paid[$id]['loan_kobo'] ?? 0) / 100,
            ];
        }

        $in = $ids ? implode(',', array_fill(0, count($ids), '?')) : 'NULL';
        $monthly = array_map(fn ($m) => ['month' => $m['month'], 'solar_kwh' => round((float) $m['solar'], 1), 'used_kwh' => round((float) $m['used'], 1),
            'grid_kwh' => round((float) $m['grid'], 1), 'backup_kwh' => round((float) $m['backup'], 1)],
            Database::all("SELECT SUBSTR(CAST(r.day AS VARCHAR(10)), 1, 7) AS month, SUM(r.kwh_generated) AS solar, SUM(r.kwh_solar_to_load) AS used,
                    SUM(r.kwh_from_grid) AS grid, SUM(r.kwh_from_backup) AS backup
                FROM readings r JOIN inverters i ON i.id = r.inverter_id WHERE i.site_id IN ($in) GROUP BY 1 ORDER BY 1", $ids));

        $earnings = $installerId !== null
            ? (int) Database::val("SELECT COALESCE(SUM(p.amount_kobo), 0) FROM payouts p JOIN installers i ON i.name = p.recipient
                WHERE p.role = 'installer' AND p.status = 'paid' AND i.id = ?", [$installerId]) / 100
            : (int) Database::val("SELECT COALESCE(SUM(amount_kobo), 0) FROM payouts WHERE role = 'installer' AND status = 'paid'") / 100;
        $credits = ['issued' => 0, 'listed' => 0, 'reserved' => 0, 'retired' => 0];
        foreach (Database::all('SELECT status, COUNT(*) AS n FROM credits GROUP BY status') as $c) {
            $credits[$c['status']] = (int) $c['n'];
            $credits['issued'] += (int) $c['n'];
        }

        $count = fn (callable $f) => count(array_filter($homes, $f));
        $scores = array_filter(array_column($homes, 'trust_score'), fn ($v) => $v !== null);
        $grades = [];
        foreach (['A', 'B', 'C', 'D', 'E', 'F', 'G'] as $g) {
            $grades[$g] = $count(fn ($h) => $h['grade'] === $g);
        }
        $loans = array_values(array_filter($homes, fn ($h) => $h['loan'] !== null));

        return [
            'scope' => $installerId !== null ? 'installer' : 'all',
            'installer' => $installerId !== null ? ($sites[0]['installer'] ?? null) : null,
            'as_of' => $asOf,
            'period' => $period ? ['id' => (int) $period['id'], 'start' => $period['start_day'], 'end' => $period['end_day'], 'status' => $period['status'],
                'signed_at' => $period['signed_at'], 'total_t' => round((float) $period['total_t'], 3)] : null,
            'totals' => [
                'homes' => count($homes),
                'eligible' => $count(fn ($h) => $h['status'] === 'eligible'),
                'held' => $count(fn ($h) => $h['status'] === 'held'),
                'excluded' => $count(fn ($h) => $h['status'] === 'excluded'),
                'offline' => $count(fn ($h) => $h['health'] === 'offline'),
                'low_output' => $count(fn ($h) => $h['health'] === 'low_output'),
                'kwh_period' => round(array_sum(array_column($homes, 'kwh_period')), 1),
                'kwh_week' => round(array_sum(array_column($homes, 'kwh_week')), 1),
                // Only homes whose period passed count toward credits; held and excluded tonnes are not issued.
                'tco2e' => round(array_sum(array_column(array_filter($homes, fn ($h) => $h['status'] === 'eligible'), 'tco2e')), 3),
                'avg_trust' => $scores ? (int) round(array_sum($scores) / count($scores)) : null,
                'paid_households_naira' => array_sum(array_column($homes, 'paid_naira')),
                'loan_repaid_naira' => array_sum(array_column($homes, 'loan_repaid_naira')),
                'installer_earnings_naira' => $earnings,
                'loans' => count($loans),
                'a_or_b' => $grades['A'] + $grades['B'],
            ],
            'grades' => $grades,
            'credits' => $credits,
            'monthly' => $monthly,
            'homes' => $homes,
        ];
    }
}
