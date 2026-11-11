<?php

namespace App\Services\Period;

use App\Config\Database;
use App\Config\Settings;
use App\Core\HttpException;
use App\Models\CreditRepository;
use App\Models\KvStore;
use App\Models\PeriodRepository;
use App\Models\SiteRepository;
use App\Models\SiteResultRepository;
use App\Services\Carbon\Carbon;
use App\Services\Carbon\Checks;
use App\Services\Carbon\Grade;
use App\Services\Evidence\EvidenceService;
use App\Services\Ledger\Ledger;
use App\Services\Registry\Registry;
use App\Services\Simulator\Simulator;

/** Monitoring periods: compute tonnes and checks, draw the auditor's sample, sign off, mint credits. */
final class PeriodService
{
    private const DECISIONS = ['ok', 'clear', 'keep_held', 'exclude'];

    public function __construct(
        private PeriodRepository $periods = new PeriodRepository(),
        private SiteRepository $sites = new SiteRepository(),
        private SiteResultRepository $results = new SiteResultRepository(),
        private CreditRepository $credits = new CreditRepository(),
    ) {
    }

    public function get(int $id): array
    {
        return $this->periods->find($id) ?? throw new HttpException(404, 'Period not found.');
    }

    /** The same home-month must never be credited twice, so periods may not overlap. */
    public function create(string $start, string $end): int
    {
        foreach (['start' => $start, 'end' => $end] as $field => $value) {
            $parsed = \DateTimeImmutable::createFromFormat('!Y-m-d', $value);
            if (!$parsed || $parsed->format('Y-m-d') !== $value) {
                throw new HttpException(422, "Enter the $field date as YYYY-MM-DD.", [$field]);
            }
        }
        if ($start > $end) {
            throw new HttpException(422, 'The period must end on or after its start date.', ['start', 'end']);
        }
        return Database::tx(function () use ($start, $end) {
            Database::lock('periods');
            if ($existing = $this->periods->firstOverlapping($start, $end)) {
                throw new HttpException(409, "These dates overlap period {$existing['id']} ({$existing['start_day']} to {$existing['end_day']}).");
            }
            $id = $this->periods->create(['project' => Settings::PROJECT_CODE, 'start_day' => $start, 'end_day' => $end, 'status' => 'open']);
            Ledger::append('period.created', ['period' => $id, 'start' => $start, 'end' => $end]);
            return $id;
        });
    }

    public function compute(int $id): array
    {
        $period = $this->get($id);
        if (!in_array($period['status'], ['open', 'computed'], true)) {
            throw new HttpException(409, "This period is already {$period['status']}.");
        }
        return Database::tx(function () use ($period, $id) {
            $this->results->deleteForPeriod($id);
            [$start, $end] = [$period['start_day'], $period['end_day']];
            $allDays = Simulator::days($start, $end);
            $sites = $this->sites->forCompute();
            $readings = [];
            foreach ($this->sites->readingsBetween($start, $end) as $row) {
                $readings[$row['inverter_id']][$row['day']] = $row;
            }
            $series = [];
            foreach ($sites as $site) {
                $series[$site['label']] = array_map(fn ($day) => (float) ($readings[$site['inverter_id']][$day]['kwh_generated'] ?? 0), $allDays);
            }
            $clones = Checks::findClones($series);
            $methodology = Carbon::methodology();
            $receiptMonths = EvidenceService::receiptCounts();

            $total = 0.0;
            $out = [];
            foreach ($sites as $site) {
                $siteReadings = $readings[$site['inverter_id']] ?? [];
                $candidate = $site + ['generator' => ['scrapped_on' => $site['scrapped_on'], 'scrap_certificate' => $site['scrap_certificate']]];
                [$checks, $failed, $score, $status] = Checks::runSite($candidate, $siteReadings, $this->sites->sunlight($site['area'], $start, $end), $allDays, $clones[$site['label']]);

                $byMonth = [];
                foreach ($siteReadings as $day => $row) {
                    $byMonth[substr($day, 0, 7)][$day] = $row;
                }
                ksort($byMonth);
                [$monthly, $tonnes, $use, $backupTotal] = [[], 0.0, 0.0, 0.0];
                foreach ($byMonth as $month => $rows) {
                    [$solar, $backup] = [0.0, 0.0];
                    foreach ($rows as $day => $row) {
                        if (empty($failed[$day])) {
                            $solar += $row['kwh_solar_to_load']; // failed days earn zero
                        }
                        $backup += $row['kwh_from_backup'];
                        $use += $row['kwh_solar_to_load'] + $row['kwh_from_grid'] + $row['kwh_from_backup'];
                        $backupTotal += $row['kwh_from_backup'];
                    }
                    $monthly[$month] = $methodology->siteMonth(['solar_kwh' => $solar, 'backup_kwh' => $backup, 'days' => count($rows),
                        'grid_hours' => (float) $site['grid_hours_per_day'], 'genset_kva' => (float) $site['rated_kva'],
                        'baseline_kwh_per_day' => (float) $site['baseline_kwh_per_day'],
                        'meter_accuracy_pct' => $site['accuracy_pct'] !== null ? (float) $site['accuracy_pct'] : null,
                        'baseline_tier' => EvidenceService::tier($receiptMonths[(int) $site['id']] ?? 0)]);
                    $tonnes += $monthly[$month]['er_t'];
                }
                $share = $use > 0 ? $backupTotal / $use : 0;
                $this->results->create(['period_id' => $id, 'site_id' => $site['id'], 'tco2e' => round($tonnes, 4), 'monthly' => jenc($monthly),
                    'trust_score' => $score, 'status' => $status, 'checks' => jenc($checks), 'generator_share' => round($share, 4),
                    'grade' => Grade::forShare($share), 'reviewed' => 0]);
                if ($status === 'eligible') {
                    $total += $tonnes;
                }
                $out[] = ['site' => $site['label'], 'tco2e' => round($tonnes, 3), 'score' => $score, 'status' => $status];
            }
            $labelsWith = fn ($status) => array_values(array_column(array_filter($out, fn ($o) => $o['status'] === $status), 'site'));
            $this->periods->update($id, ['status' => 'computed', 'total_t' => round($total, 4)]);
            Ledger::append('period.computed', ['period' => $id, 'methodology' => $methodology->code(), 'eligible_t' => round($total, 4),
                'eligible' => count($labelsWith('eligible')), 'held' => $labelsWith('held'), 'excluded' => $labelsWith('excluded')]);
            return ['period' => $id, 'methodology' => $methodology->code(), 'eligible_t' => round($total, 3), 'sites' => $out];
        });
    }

    public function sample(int $id, int $seed, float $fraction = 0.2): array
    {
        if ($this->get($id)['status'] !== 'computed') {
            throw new HttpException(409, 'Compute the period before drawing a sample.');
        }
        $rows = $this->results->forPeriod($id);
        $idsWith = fn ($status) => array_values(array_map(fn ($r) => (int) $r['site_id'], array_filter($rows, fn ($r) => $r['status'] === $status)));
        $held = $idsWith('held');
        $eligible = $idsWith('eligible');

        mt_srand($seed); // visible seed: anyone can redraw the same sample
        $pool = $eligible;
        for ($i = count($pool) - 1; $i > 0; $i--) {
            $j = mt_rand(0, $i);
            [$pool[$i], $pool[$j]] = [$pool[$j], $pool[$i]];
        }
        $picked = array_slice($pool, 0, max(1, (int) ceil(count($eligible) * $fraction)));
        $sample = array_values(array_unique(array_merge($held, $picked)));
        sort($sample);

        return Database::tx(function () use ($id, $seed, $sample, $held) {
            $this->periods->update($id, ['sample_seed' => $seed, 'sample_site_ids' => jenc($sample), 'status' => 'sampled']);
            Ledger::append('period.sampled', ['period' => $id, 'seed' => $seed, 'sites' => $sample]);
            return ['seed' => $seed, 'sample' => $sample, 'always_included_held' => $held];
        });
    }

    public function review(int $id, int $siteId, string $decision, string $note = ''): array
    {
        if (!in_array($decision, self::DECISIONS, true)) {
            throw new HttpException(422, 'Decision must be ok, clear, keep_held or exclude.', ['decision']);
        }
        $period = $this->get($id);
        if ($period['status'] !== 'sampled') {
            throw new HttpException(409, 'Sites can only be reviewed while a period is awaiting sign-off.');
        }
        if (!in_array($siteId, jdec($period['sample_site_ids']) ?? [], true)) {
            throw new HttpException(409, 'This site is not in the audit sample.');
        }
        $result = $this->results->find($id, $siteId) ?? throw new HttpException(404, 'Site not found in this period.');
        $status = $result['status'];
        if ($decision === 'clear' && $status === 'held') {
            $status = 'eligible';
        }
        if ($decision === 'exclude') {
            $status = 'excluded';
        }
        return Database::tx(function () use ($result, $status, $id, $siteId, $decision, $note) {
            $this->results->update((int) $result['id'], ['status' => $status, 'reviewed' => 1]);
            Ledger::append('site.reviewed', ['period' => $id, 'site' => $siteId, 'decision' => $decision, 'note' => $note]);
            return ['site' => $siteId, 'status' => $status];
        });
    }

    public function signOff(int $id, string $auditor): array
    {
        $period = $this->get($id);
        if ($period['status'] !== 'sampled') {
            throw new HttpException(409, 'Draw the sample before signing off.');
        }
        $results = [];
        foreach ($this->results->forPeriod($id) as $row) {
            $results[(int) $row['site_id']] = $row;
        }
        $unreviewed = array_values(array_filter(jdec($period['sample_site_ids']) ?? [], fn ($site) => !$results[$site]['reviewed']));
        if ($unreviewed) {
            throw new HttpException(409, 'Review every sampled site first.', $unreviewed);
        }

        $pieces = [];
        foreach ($results as $site => $row) {
            if ($row['status'] !== 'eligible') {
                continue;
            }
            foreach (jdec($row['monthly']) as $month => $values) {
                if ($values['er_t'] > 0) {
                    $pieces[] = ['site_id' => $site, 'month' => $month, 't' => $values['er_t']];
                }
            }
        }
        $total = array_sum(array_column($pieces, 't'));
        $ourWhole = (int) floor($total + 1e-9);
        $eligibleSites = array_keys(array_filter($results, fn ($r) => $r['status'] === 'eligible'));
        $kwh = 0.0;
        foreach ($eligibleSites as $site) {
            foreach (jdec($results[$site]['monthly']) as $values) {
                $kwh += $values['eg_credited_kwh'] ?? $values['eg_res_kwh']; // the lower end of each meter's accuracy
            }
        }

        // The registry is the issuer: it converts the metered kWh itself, and only its credits can be retired.
        // Its calls are idempotent by reference, so they run outside the database transaction.
        $projectId = KvStore::get('registry_project') ?? Registry::createProject('proj-' . Settings::PROJECT_CODE);
        KvStore::set('registry_project', $projectId);
        $mrvId = Registry::submitMrv($projectId, $period['start_day'], $period['end_day'], $kwh,
            Settings::publicBase() . '/api/ledger/verify', $this->sites->inverterSerials($eligibleSites), "mrv-$id")['submission_id'];
        Registry::verifyMrv($mrvId, "review-$id");
        $issued = Registry::mrvStatus($mrvId);
        if (($issued['status'] ?? '') !== 'verified') {
            throw new HttpException(409, 'The registry has not verified this period yet. Try signing off again in a minute.');
        }
        // We never list more credits than the registry issued, whatever our own methodology estimate says.
        $count = min($ourWhole, (int) $issued['credits_issued']);

        return Database::tx(function () use ($period, $id, $auditor, $pieces, $total, $count, $ourWhole, $projectId, $mrvId, $issued, $kwh) {
            Database::lock('periods');
            if ($this->get($id)['status'] !== 'sampled') {
                throw new HttpException(409, 'This period has already been signed off.');
            }
            // Each credit is an equal slice of every eligible home-month: whichever credits sell,
            // every family is paid in proportion to the tonnes it earned. Each serial sums to 1.000 t.
            $vintage = (int) substr($period['end_day'], 0, 4);
            $start = $this->credits->countAll() + 1;
            $share = $total > 0 ? 1 / $total : 0;
            $contributions = jenc(array_map(fn ($p) => ['site_id' => $p['site_id'], 'month' => $p['month'], 't' => round($p['t'] * $share, 6)], $pieces));
            $serials = [];
            for ($i = 0; $i < $count; $i++) {
                $serial = sprintf('KX-NG-%d-%s-%06d', $vintage, Settings::PROJECT_CODE, $start + $i);
                $this->credits->create(['serial' => $serial, 'period_id' => $id, 'vintage' => $vintage, 'status' => 'listed',
                    'contributions' => $contributions, 'authorised' => 0, 'simulated' => 1]);
                $serials[] = $serial;
            }
            $carried = round($total - $ourWhole, 4);
            $this->periods->update($id, ['status' => 'signed', 'signed_by' => $auditor, 'signed_at' => now_iso(),
                'registry_project_id' => $projectId, 'registry_mrv_id' => $mrvId, 'carried_t' => $carried,
                'registry_kwh' => round($kwh, 1), 'registry_tco2e' => (float) ($issued['verified_tco2e'] ?? 0), 'registry_batch_id' => $issued['credit_batch_id'],
                'registry_credits' => (int) $issued['credits_issued'], 'registry_serial_range' => $issued['serial_range'] ?? null]);
            $first = $serials[0] ?? null;
            $last = $serials ? $serials[count($serials) - 1] : null;
            Ledger::append('period.signed', ['period' => $id, 'auditor' => $auditor, 'credits' => $count, 'first' => $first, 'last' => $last, 'carried_t' => $carried, 'registry_mrv' => $mrvId,
                'registry_batch' => $issued['credit_batch_id'], 'registry_credits' => (int) $issued['credits_issued']]);
            return ['credits_minted' => $count, 'methodology_t' => round($total, 3), 'carried_t' => $carried, 'first' => $first, 'last' => $last,
                'registry_project' => $projectId, 'registry_mrv' => $mrvId, 'registry_kwh' => round($kwh, 1),
                'registry_tco2e' => (float) ($issued['verified_tco2e'] ?? 0), 'registry_credits' => (int) $issued['credits_issued'],
                'registry_batch' => $issued['credit_batch_id'], 'registry_serial_range' => $issued['serial_range'] ?? null];
        });
    }
}
