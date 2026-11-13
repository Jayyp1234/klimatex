<?php

namespace App\Services\Home;

use App\Core\HttpException;
use App\Models\CreditRepository;
use App\Models\KvStore;
use App\Models\PayoutRepository;
use App\Models\PeriodRepository;
use App\Models\SiteRepository;
use App\Models\SiteResultRepository;
use App\Services\Ai\Maas;
use App\Services\Carbon\Checks;
use App\Services\Carbon\Grade;

final class HomeService
{
    private const LANGUAGES = ['en', 'pcm', 'yo', 'ig', 'ha'];

    public function __construct(
        private SiteRepository $sites = new SiteRepository(),
        private SiteResultRepository $results = new SiteResultRepository(),
        private PeriodRepository $periods = new PeriodRepository(),
        private PayoutRepository $payouts = new PayoutRepository(),
        private CreditRepository $credits = new CreditRepository(),
    ) {
    }

    public function list(?int $installerId = null): array
    {
        $latest = $this->periods->latestId();
        $byId = [];
        foreach ($latest ? $this->results->forPeriod($latest) : [] as $row) {
            $byId[$row['site_id']] = $row;
        }
        $homes = [];
        foreach ($this->sites->allWithHousehold() as $site) {
            if ($installerId !== null && (int) $site['installer_id'] !== $installerId) {
                continue;
            }
            $result = $byId[$site['id']] ?? null;
            $homes[] = ['id' => (int) $site['id'], 'label' => $site['label'], 'household' => $site['name'], 'area' => $site['area'],
                'grade' => $result['grade'] ?? null, 'trust_score' => $result ? (int) $result['trust_score'] : null,
                'status' => $result['status'] ?? null, 'tco2e' => $result ? (float) $result['tco2e'] : null];
        }
        return $homes;
    }

    public function detail(int $id): array
    {
        $site = $this->site($id);
        $readings = $this->sites->readingsFor((int) $site['inverter_id']);
        // The most a day's panels could honestly produce: irradiance x panel size x the same 1.1 tolerance the sunlight check uses.
        $sun = $readings ? $this->sites->sunlight($site['area'], $readings[0]['day'], end($readings)['day']) : [];
        $ceiling = fn ($day) => isset($sun[$day]) ? round($sun[$day] * $site['panel_kwp'] * Checks::PHYSICS_TOLERANCE, 3) : null;
        $daily = array_map(fn ($r) => ['day' => $r['day'], 'generated' => (float) $r['kwh_generated'], 'to_load' => (float) $r['kwh_solar_to_load'],
            'grid' => (float) $r['kwh_from_grid'], 'backup' => (float) $r['kwh_from_backup'], 'ceiling' => $ceiling($r['day'])], $readings);
        $periods = array_map(fn ($r) => ['period' => (int) $r['period_id'], 'tco2e' => (float) $r['tco2e'], 'score' => (int) $r['trust_score'],
            'status' => $r['status'], 'grade' => $r['grade'], 'checks' => jdec($r['checks']), 'monthly' => jdec($r['monthly'])], $this->results->forSite($id));
        return ['site' => ['id' => $id, 'label' => $site['label'], 'area' => $site['area'], 'panel_kwp' => (float) $site['panel_kwp'], 'grid_hours_per_day' => (float) $site['grid_hours_per_day']],
            'household' => ['name' => $site['name'], 'wallet' => $site['wallet_id'], 'loan' => $site['loan_id']],
            'generator' => ['serial' => $site['generator_serial'], 'kva' => (float) $site['rated_kva'], 'scrapped_on' => $site['scrapped_on'], 'certificate' => $site['scrap_certificate']],
            'inverter' => ['serial' => $site['inverter_serial'], 'vendor' => $site['vendor']],
            'daily' => $daily, 'periods' => $periods];
    }

    public function certificate(int $id): array
    {
        $site = $this->site($id);
        $result = $this->results->latestForSite($id) ?? throw new HttpException(409, 'Your first grade comes after your first monthly audit. Your readings are already coming in.');
        $monthly = jdec($result['monthly']);
        $months = max(1, count($monthly));
        $before = Grade::beforeShare((float) $site['grid_hours_per_day']);
        $litres = array_sum(array_column($monthly, 'eg_res_kwh')) * (1 - $site['grid_hours_per_day'] / 24) * 0.7;
        return ['certificate' => sprintf('KX-HEC-%s-LAG-%06d', gmdate('Y'), $id), 'home' => $site['label'], 'area' => $site['area'],
            'household' => $site['name'], 'grade_before' => Grade::forShare($before), 'generator_share_before' => round($before, 3),
            'grade_now' => $result['grade'], 'generator_share_now' => (float) $result['generator_share'],
            'potential' => 'A with a 2.4 kWh battery', 'credited_tco2e_period' => round((float) $result['tco2e'], 3),
            'credited_tco2e_per_year' => round($result['tco2e'] * 12 / $months, 2), 'petrol_litres_avoided_period' => (int) round($litres),
            'payouts_naira' => $this->payouts->totalForSite($id) / 100, 'trust_score' => (int) $result['trust_score'],
            'checks' => array_map(fn ($c) => ['name' => $c['name'], 'result' => $c['result']], jdec($result['checks'])),
            'measured' => 'metered from inverter', 'scale' => 'KlimateX scale (proposed), not an official rating'];
    }

    /** The home a household account belongs to. */
    public function mine(?int $householdId): array
    {
        $id = $householdId ? $this->sites->idForHousehold($householdId) : null;
        return ['site_id' => $id ?? throw new HttpException(404, 'No home is linked to this account yet.')];
    }

    /** Every payout to this home, with the audit period, tonnes and credit serials it came from. */
    public function payouts(int $id): array
    {
        $this->site($id);
        $rows = [];
        foreach ($this->payouts->forSite($id) as $payout) {
            $orderId = (int) $payout['order_id'];
            $tonnes = 0.0;
            foreach ($this->credits->contributionsForOrder($orderId) as $credit) {
                foreach (jdec($credit['contributions']) ?? [] as $part) {
                    if ((int) $part['site_id'] === $id) {
                        $tonnes += $part['t'];
                    }
                }
            }
            $period = ($periodId = $this->credits->periodIdForOrder($orderId)) ? $this->periods->find($periodId) : null;
            $destination = self::destination((string) $payout['recipient']);
            $rows[] = [
                'id' => (int) $payout['id'],
                'order' => $orderId,
                'amount_naira' => (int) $payout['amount_kobo'] / 100,
                'status' => $payout['status'],
                'destination' => $destination,
                'reference' => $payout['reference'],
                'tonnes' => round($tonnes, 3),
                'period' => $period ? ['start' => $period['start_day'], 'end' => $period['end_day']] : null,
                'paid_on' => $this->credits->retiredAtForOrder($orderId),
                'serials' => $this->credits->serialsForOrder($orderId),
            ];
        }
        return ['payouts' => $rows, 'paid_naira' => $this->payouts->totalForSite($id) / 100];
    }

    /** Only things that need the family's attention, plus the latest payment. Newest first. */
    public function alerts(int $id): array
    {
        $site = $this->site($id);
        $alerts = [];
        $readings = $this->sites->readingsFor((int) $site['inverter_id']);
        $feedDay = $this->sites->latestReadingDay();
        $lastDay = $readings ? end($readings)['day'] : null;

        if ($feedDay !== null && ($lastDay === null || $lastDay < $feedDay)) {
            $alerts[] = ['id' => "no-data-$lastDay", 'kind' => 'no_data', 'severity' => 'critical', 'at' => $feedDay,
                'title' => 'Inverter offline', 'body' => $lastDay ? "No data since $lastDay. Check your inverter is on and connected." : 'Your inverter has not reported yet.'];
        }

        if ($lowOutput = $this->lowOutputAlert($site, $readings, $lastDay)) {
            $alerts[] = $lowOutput;
        }

        $result = $this->results->latestForSite($id);
        if ($result && $result['status'] !== 'eligible') {
            $failed = array_column(array_filter(jdec($result['checks']), fn ($c) => $c['result'] !== 'pass'), 'name');
            $alerts[] = ['id' => "held-{$result['period_id']}", 'kind' => 'held', 'severity' => 'warning', 'at' => $lastDay,
                'title' => $result['status'] === 'excluded' ? 'This period earns nothing' : 'This period is on hold',
                'body' => 'Checks that need attention: ' . str_replace('_', ' ', implode(', ', $failed)) . '.'];
        }

        $latest = $this->payouts->forSite($id)[0] ?? null;
        if ($latest && $latest['status'] === 'paid') {
            $to = ['solar_loan' => 'your solar loan', 'bank' => 'your bank account', 'wallet' => 'your Access wallet'][self::destination((string) $latest['recipient'])];
            $alerts[] = ['id' => "payout-{$latest['id']}", 'kind' => 'payout', 'severity' => 'info',
                'at' => substr((string) $this->credits->retiredAtForOrder((int) $latest['order_id']), 0, 10) ?: null,
                'title' => 'Payout sent', 'body' => '₦' . number_format((int) $latest['amount_kobo'] / 100) . " has been paid to $to."];
        }
        return ['alerts' => $alerts, 'data_as_of' => $feedDay];
    }

    /**
     * Low output this week, measured from readings. A clean system makes about 80% of what the sun
     * allows, so the alert fires below 82% of that. The drop is measured against the home's own
     * previous three weeks when there are enough of them, otherwise against the sunlight ceiling.
     * Dust wording only when the drop is clear: steady across the week and between 10% and 50%.
     * Anything else (a sudden collapse, a patchy week) gets the generic wording, because a fault is likelier.
     */
    private function lowOutputAlert(array $site, array $readings, ?string $lastDay): ?array
    {
        $window = array_slice($readings, -28);
        $sun = $window ? $this->sites->sunlight($site['area'], $window[0]['day'], end($window)['day']) : [];
        $ratio = fn (array $r) => isset($sun[$r['day']]) && $sun[$r['day']] > 0 ? (float) $r['kwh_generated'] / ($sun[$r['day']] * $site['panel_kwp']) : null;
        $week = array_values(array_filter(array_map($ratio, array_slice($window, -7)), fn ($x) => $x !== null));
        $before = array_values(array_filter(array_map($ratio, array_slice($window, 0, -7)), fn ($x) => $x !== null));
        if (count($week) < 5) {
            return null;
        }
        $weekRatio = array_sum($week) / count($week);
        if ($weekRatio / 0.8 >= 0.82) {
            return null;
        }
        $baseline = count($before) >= 10 ? array_sum($before) / count($before) : 0.8;
        $drop = max(0.0, 1 - $weekRatio / $baseline);
        $short = (int) round($drop * 100);
        $steady = count(array_filter($week, fn ($x) => $x < $baseline * 0.9)) >= count($week) - 1;
        $base = ['id' => "low-output-$lastDay", 'kind' => 'low_output', 'severity' => 'warning', 'at' => $lastDay];

        if ($steady && $drop >= 0.10 && $drop <= 0.50) {
            // November to March is Harmattan: Saharan dust settles on Lagos rooftops. The alert is about
            // what to do now, so the season is today's, not the reading's.
            $harmattan = in_array((int) gmdate('n'), [11, 12, 1, 2, 3], true);
            return $base + ['title' => $harmattan ? 'Harmattan dust on your panels' : 'Dust on your panels?',
                'body' => ($harmattan ? "Harmattan dust cut your output $short% this week." : "Dust or shade cut your output $short% this week.")
                    . ' Clean your panels to keep your credits coming.'];
        }
        return $base + ['title' => 'Lower output this week',
            'body' => "Your panels made $short% less than usual for the sunlight this week. Check the inverter is on and the panels are clear, or ask your installer."];
    }

    /** Cached per home, period and language, because model calls share the team's rate limit. */
    public function message(int $id, string $lang): array
    {
        if (!in_array($lang, self::LANGUAGES, true)) {
            throw new HttpException(422, 'Language must be en, pcm, yo, ig or ha.', ['lang']);
        }
        $certificate = $this->certificate($id);
        $result = $this->results->latestForSite($id);
        $cacheKey = "msg:$id:{$result['period_id']}:{$result['status']}:$lang";
        if (($cached = KvStore::get($cacheKey)) !== null) {
            return ['lang' => $lang, 'text' => $cached, 'source' => 'model'];
        }
        // "This month" means the latest audited month, the same figures the dashboard cards show.
        $monthly = jdec($result['monthly']) ?: [];
        ksort($monthly);
        $month = end($monthly) ?: ['eg_res_kwh' => 0, 'er_t' => 0];
        $litres = $month['eg_res_kwh'] * (1 - $this->site($id)['grid_hours_per_day'] / 24) * 0.7;
        $checks = array_filter(jdec($result['checks']), fn ($c) => $c['result'] !== 'pass');
        $reason = $result['status'] === 'eligible' ? null : implode(', ', array_column($checks, 'name'));
        $message = Maas::familyMessage($certificate['household'], $certificate['grade_now'], $litres, (float) $month['er_t'], $result['status'], $reason, $lang);
        // Only model text is cached, so a ready-written fallback is replaced once the model is back.
        if ($message['source'] === 'model') {
            KvStore::set($cacheKey, $message['text']);
        }
        return ['lang' => $lang] + $message;
    }

    private function site(int $id): array
    {
        return $this->sites->detail($id) ?? throw new HttpException(404, 'Home not found.');
    }

    /** PayoutService names the channel in the recipient: "… solar loan", "… (bank account ···1234)", otherwise the wallet. */
    private static function destination(string $recipient): string
    {
        return match (true) {
            str_contains($recipient, 'solar loan') => 'solar_loan',
            str_contains($recipient, '(bank account') => 'bank',
            default => 'wallet',
        };
    }
}
