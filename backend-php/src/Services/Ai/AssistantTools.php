<?php

namespace App\Services\Ai;

use App\Core\HttpException;
use App\Services\Home\CreditTips;
use App\Services\Home\HomeService;

/**
 * What the family assistant may look up, bound to one home.
 *
 * The home comes from the caller's token, never from the model: no tool takes a site id,
 * so a question can't reach another family's records. Every tool only reads.
 */
final class AssistantTools
{
    /** Plain-language meaning of each automated check, for families. */
    public const CHECKS = [
        'sunlight' => 'a reading was higher than the sunlight measured over your street allowed',
        'energy_balance' => 'some days the energy figures did not add up',
        'clone' => 'your readings looked copied from another home',
        'flat_line' => 'the inverter sent the same number for several days in a row',
        'spike' => 'a day jumped far above your normal output',
        'missing_data' => 'some days had no readings from your inverter',
        'identity' => 'the inverter location did not match your home',
        'decommissioned' => 'the proof that your old generator was scrapped is still missing',
        'backup_share' => 'too much power came from backup instead of solar',
    ];

    private const DESTINATIONS = ['solar_loan' => 'your solar loan', 'bank' => 'your bank account', 'wallet' => 'your Access wallet'];

    private array $cache = [];

    public function __construct(private int $siteId, private HomeService $homes = new HomeService())
    {
    }

    /** OpenAI-style tool definitions. None take arguments: the home is already fixed. */
    public static function definitions(): array
    {
        $tool = fn (string $name, string $description) => ['type' => 'function', 'function' => [
            'name' => $name, 'description' => $description, 'parameters' => ['type' => 'object', 'properties' => new \stdClass()]]];
        return [
            $tool('home_overview', 'The home: family name, energy grade before and now, trust score, latest audit status, tonnes credited, petrol avoided, total paid.'),
            $tool('audit_status', 'The latest audit period: whether it is eligible, held or excluded, and which checks failed and why.'),
            $tool('payouts', 'Every payout to this home: amount in naira, status, where it was sent, date, tonnes.'),
            $tool('alerts', 'Things that need the family\'s attention now: inverter offline, dusty panels, held period, latest payment.'),
            $tool('energy', 'Solar made in the last 7 days, the latest reading day, and each audited month\'s solar kWh and tonnes.'),
            $tool('loan', 'The solar loan, if any, and how much carbon money has gone into repaying it.'),
            $tool('credit_tips', 'How this home could earn more credits, from its own checks and evidence: missing data days, backup generator share against the 10% limit, generator scrapping, fuel receipts for a measured baseline, meter accuracy. Each tip says what to do and who does it.'),
        ];
    }

    public static function names(): array
    {
        return array_map(fn ($t) => $t['function']['name'], self::definitions());
    }

    /** Runs one tool. Unknown names and missing data come back as data, so the model can say so. */
    public function run(string $name): array
    {
        if (!in_array($name, self::names(), true)) {
            return ['error' => "No tool called $name."];
        }
        try {
            return $this->cache[$name] ??= $this->$name();
        } catch (HttpException $e) {
            return ['unavailable' => $e->getMessage()];
        }
    }

    private function home_overview(): array
    {
        $c = $this->homes->certificate($this->siteId);
        return ['family' => $c['household'], 'home' => $c['home'], 'area' => $c['area'],
            'grade_before' => $c['grade_before'], 'grade_now' => $c['grade_now'], 'next_step' => $c['potential'],
            'trust_score' => $c['trust_score'], 'audit_status' => $this->audit_status()['status'],
            'tonnes_credited_this_period' => $c['credited_tco2e_period'], 'tonnes_per_year' => $c['credited_tco2e_per_year'],
            'petrol_litres_avoided_this_period' => $c['petrol_litres_avoided_period'], 'total_paid_naira' => $c['payouts_naira']];
    }

    private function audit_status(): array
    {
        $periods = $this->homes->detail($this->siteId)['periods'];
        $latest = end($periods) ?: throw new HttpException(409, 'No audit period has been computed for this home yet.');
        $failed = array_values(array_filter($latest['checks'], fn ($c) => $c['result'] !== 'pass'));
        return ['status' => $latest['status'], 'grade' => $latest['grade'], 'trust_score' => $latest['score'], 'tonnes' => round($latest['tco2e'], 3),
            'checks_passed' => count($latest['checks']) - count($failed), 'checks_total' => count($latest['checks']),
            'needs_attention' => array_map(fn ($c) => ['check' => $c['name'], 'result' => $c['result'],
                'meaning' => self::CHECKS[$c['name']] ?? str_replace('_', ' ', $c['name'])], $failed)];
    }

    private function payouts(): array
    {
        $data = $this->homes->payouts($this->siteId);
        $latest = $data['payouts'][0] ?? null;
        // Same estimate as the dashboard: about what was paid last time, after the audit closing the next six months.
        $periodEnd = $latest['period']['end'] ?? $this->homes->alerts($this->siteId)['data_as_of'];
        return ['total_paid_naira' => $data['paid_naira'],
            'next_payment' => ['estimate_naira' => $latest['amount_naira'] ?? null, 'after_audit_closing' => self::day(self::nextAudit($periodEnd)),
                'note' => 'An estimate, not a promise: not every credit sells each period. Paid the day the credits sell.'],
            'payouts' => array_map(fn ($p) => [
                'amount_naira' => $p['amount_naira'], 'status' => $p['status'], 'sent_to' => self::DESTINATIONS[$p['destination']],
                'date' => self::day($p['paid_on']), 'tonnes' => $p['tonnes'], 'reference' => $p['reference'],
                'period' => $p['period']], $data['payouts'])];
    }

    /** Dates as the app shows them: "9 Nov 2026". */
    public static function day(?string $iso): ?string
    {
        return $iso ? gmdate('j M Y', strtotime(substr($iso, 0, 10) . ' UTC')) : null;
    }

    /** The last day of the month six months after a period ends: 30 Jun 2026 gives 31 Dec 2026. */
    public static function nextAudit(?string $periodEnd): ?string
    {
        return $periodEnd ? (new \DateTimeImmutable(substr($periodEnd, 0, 7) . '-01', new \DateTimeZone('UTC')))->modify('+6 months')->format('Y-m-t') : null;
    }

    private function alerts(): array
    {
        $data = $this->homes->alerts($this->siteId);
        return ['data_as_of' => $data['data_as_of'], 'alerts' => array_map(fn ($a) => ['title' => $a['title'], 'detail' => $a['body'],
            'severity' => $a['severity']], $data['alerts'])];
    }

    private function energy(): array
    {
        $detail = $this->homes->detail($this->siteId);
        $week = array_slice($detail['daily'], -7);
        $periods = $detail['periods'];
        $monthly = (end($periods) ?: ['monthly' => []])['monthly'] ?? [];
        ksort($monthly);
        return ['panel_kwp' => $detail['site']['panel_kwp'], 'latest_reading_day' => $week ? self::day(end($week)['day']) : null,
            'last_7_days_kwh' => round(array_sum(array_column($week, 'generated')), 1),
            'last_7_days' => array_map(fn ($d) => ['day' => $d['day'], 'kwh' => round($d['generated'], 2)], $week),
            'audited_months' => array_map(fn ($m, $k) => ['month' => $k, 'solar_kwh' => round($m['eg_res_kwh'], 1), 'tonnes' => round($m['er_t'], 3)],
                array_values($monthly), array_keys($monthly))];
    }

    private function credit_tips(): array
    {
        $tips = (new CreditTips(homes: $this->homes))->forSite($this->siteId);
        return ['things_to_do' => $tips['todo'], 'credits_cut_by_evidence_pct' => $tips['credits_cut_pct'],
            'tips' => array_map(fn ($t) => ['status' => $t['status'], 'priority' => $t['priority'], 'who_acts' => $t['who'],
                'title' => $t['title'], 'detail' => $t['body']], $tips['tips'])];
    }

    private function loan(): array
    {
        $loan = $this->homes->detail($this->siteId)['household']['loan'];
        if (!$loan) {
            return ['has_loan' => false];
        }
        $toLoan = array_filter($this->homes->payouts($this->siteId)['payouts'], fn ($p) => $p['destination'] === 'solar_loan' && $p['status'] === 'paid');
        return ['has_loan' => true, 'lender' => 'Access Bank', 'loan_reference' => $loan,
            'repaid_from_carbon_naira' => array_sum(array_column($toLoan, 'amount_naira')), 'repayments' => count($toLoan),
            'note' => 'Carbon payouts reduce the loan but do not replace agreed instalments. The bank holds the full balance.'];
    }
}
