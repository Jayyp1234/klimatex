<?php

namespace App\Services\Onboarding;

use App\Config\Database;
use App\Config\Settings;
use App\Core\HttpException;
use App\Models\HouseholdRepository;
use App\Models\UserRepository;
use App\Services\Auth\AuthService;
use App\Services\Auth\PhoneAuthService;
use App\Services\Bank\Bank;
use App\Services\Bank\BankError;
use App\Services\Ledger\Ledger;
use App\Services\Telegram\TelegramService;
use Throwable;

/**
 * A family's journey from first visit to a certified home (docs/ONBOARDING_FLOW.md), shared by the
 * website and the Telegram bot.
 *
 * Path "need" (no solar yet): package → cash or loan → account → loan pre-check → request →
 *   installer accepts → survey → quote → family accepts (Access loan if needed) → install = certified.
 * Path "have" (solar already): account → link inverter → generator status → pick installer →
 *   installer books the check visit → verifies = certified.
 *
 * Certification creates the home (site, inverter, generator) that the rest of KlimateX works on.
 * Until then the family sees only the tracker and estimates.
 */
final class OnboardingService
{
    public const PATHS = ['need', 'have'];
    public const INCOME_BANDS = [
        'low' => ['label' => 'Under ₦150,000 a month', 'monthly' => 100000],
        'mid' => ['label' => '₦150,000 to ₦400,000 a month', 'monthly' => 275000],
        'high' => ['label' => 'Over ₦400,000 a month', 'monthly' => 500000],
    ];
    public const GENERATOR = ['trade_in' => 'Trade it in', 'backup' => 'Keep it as backup', 'none' => 'No generator'];
    public const INVERTER_BRANDS = ['Growatt', 'Deye', 'Luminous', 'Felicity', 'Must', 'Other'];

    /** Pre-check rule: a third of monthly income over 24 months, after interest. Access decides the real loan. */
    private const LOAN_SHARE = 0.33;
    private const LOAN_MONTHS = 24;
    private const LOAN_COST = 1.3;
    /** The sandbox approves loans up to ₦1,000,000 and refers larger ones. */
    private const LOAN_CAP_KOBO = 100000000;
    private const TRADE_IN_KOBO = 4500000;

    private const ORDER = [
        'need' => ['started', 'requested', 'accepted', 'survey', 'quoted', 'approved', 'certified'],
        'have' => ['started', 'requested', 'visit', 'certified'],
    ];

    public function __construct(
        private Catalog $catalog = new Catalog(),
        private HouseholdRepository $households = new HouseholdRepository(),
        private UserRepository $users = new UserRepository(),
    ) {
    }

    // ----- Starting -----

    /**
     * Creates the family's account and household and opens their onboarding. The phone must already be
     * proved: by a one-time code on the website, or by Telegram's own contact share in the bot.
     *
     * @param array{phone:string,name:string,area:string,path:string,package_id?:?int,payment?:?string,pin?:?string} $in
     * @return array the new user row
     */
    public function createAccount(array $in, string $channel, ?callable $proveInTx = null): array
    {
        $name = trim(preg_replace('/\s+/', ' ', (string) ($in['name'] ?? '')));
        if (mb_strlen($name) < 2 || mb_strlen($name) > 60) {
            throw new HttpException(422, 'Enter your name, between 2 and 60 characters.', ['name']);
        }
        $area = trim(preg_replace('/\s+/', ' ', (string) ($in['area'] ?? '')));
        if (mb_strlen($area) < 2 || mb_strlen($area) > 60) {
            throw new HttpException(422, 'Enter the area the home is in, like Surulere or Yaba.', ['area']);
        }
        $path = (string) ($in['path'] ?? '');
        if (!in_array($path, self::PATHS, true)) {
            throw new HttpException(422, 'Choose whether you need solar or already have it.', ['path']);
        }
        $packageId = null;
        $payment = null;
        if ($path === 'need') {
            $packageId = $this->catalog->find((int) ($in['package_id'] ?? 0))['id'];
            $payment = (string) ($in['payment'] ?? '');
            if (!in_array($payment, ['cash', 'loan'], true)) {
                throw new HttpException(422, 'Choose how you want to pay: cash or an Access loan.', ['payment']);
            }
        }
        $pin = $in['pin'] ?? null;
        if ($pin !== null) {
            PhoneAuthService::assertPin((string) $pin);
        }

        return Database::tx(function () use ($in, $name, $area, $path, $packageId, $payment, $pin, $channel, $proveInTx) {
            $phone = $proveInTx ? $proveInTx() : PhoneAuthService::normalise((string) $in['phone']);
            if ($this->households->findByPhone($phone) || $this->users->findByPhone($phone)) {
                throw new HttpException(409, 'This number already has a KlimateX account. Sign in with it instead.', ['phone']);
            }
            $household = (int) Database::insert('households', ['name' => $name, 'phone' => $phone]);
            $userId = $this->users->create(sprintf('home-%d@households.klimatex.test', $household), $name,
                password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT), 'household', $household);
            Database::run('UPDATE users SET phone = ?, pin_hash = ? WHERE id = ?',
                [$phone, $pin !== null ? password_hash((string) $pin, PASSWORD_DEFAULT) : null, $userId]);
            $installerId = $packageId ? (int) Database::val('SELECT installer_id FROM installer_packages WHERE id = ?', [$packageId]) : null;
            Database::insert('onboardings', ['household_id' => $household, 'user_id' => $userId, 'path' => $path, 'status' => 'started',
                'channel' => $channel, 'area' => $area, 'package_id' => $packageId, 'installer_id' => $installerId, 'payment' => $payment,
                'events' => jenc([['status' => 'started', 'at' => now_iso()]]), 'created_at' => now_iso(), 'updated_at' => now_iso()]);
            return $this->users->find($userId);
        });
    }

    /** Website: the one-time code proved the phone; the family also sets a PIN for the website and app. */
    public function createAccountWithCode(array $in): array
    {
        $phones = new PhoneAuthService();
        $user = $this->createAccount($in + ['pin' => (string) ($in['pin'] ?? '')], 'web',
            fn () => $phones->claimSetup((string) ($in['setup_token'] ?? '')));
        return (new AuthService())->issue($user) + ['onboarding' => $this->view((int) $user['household_id'])];
    }

    // ----- The family's steps -----

    public function mine(?int $householdId): array
    {
        return $this->view($this->requireHousehold($householdId));
    }

    /** Saves any of: income_band, inverter_brand, inverter_serial, generator. */
    public function answer(?int $householdId, array $in): array
    {
        $o = $this->row($this->requireHousehold($householdId));
        if ($o['status'] !== 'started') {
            throw new HttpException(409, 'Your request has already gone to the installer.');
        }
        $set = [];
        if (array_key_exists('income_band', $in)) {
            $band = (string) $in['income_band'];
            if ($o['path'] !== 'need' || $o['payment'] !== 'loan' || !isset(self::INCOME_BANDS[$band])) {
                throw new HttpException(422, 'Choose one of the income ranges.', ['income_band']);
            }
            $set['income_band'] = $band;
            $set['loan_limit_kobo'] = self::loanLimit($band) * 100;
        }
        if (array_key_exists('inverter_brand', $in)) {
            $brand = (string) $in['inverter_brand'];
            if ($o['path'] !== 'have' || !in_array($brand, self::INVERTER_BRANDS, true)) {
                throw new HttpException(422, 'Choose your inverter brand.', ['inverter_brand']);
            }
            $set['inverter_brand'] = $brand;
        }
        if (array_key_exists('inverter_serial', $in)) {
            $serial = strtoupper(preg_replace('/[^A-Za-z0-9-]/', '', (string) $in['inverter_serial']));
            if ($o['path'] !== 'have' || strlen($serial) < 6 || strlen($serial) > 40) {
                throw new HttpException(422, 'Enter the serial number from the sticker on your inverter (6 to 40 letters and numbers).', ['inverter_serial']);
            }
            // One inverter, one home: the same identity rule the nine checks use.
            if (Database::val('SELECT id FROM inverters WHERE serial = ?', [$serial])
                || Database::val('SELECT id FROM onboardings WHERE inverter_serial = ? AND id <> ?', [$serial, $o['id']])) {
                throw new HttpException(409, 'That inverter is already linked to another home. Check the serial, or contact support if it is yours.', ['inverter_serial']);
            }
            $set['inverter_serial'] = $serial;
        }
        if (array_key_exists('generator', $in)) {
            $generator = (string) $in['generator'];
            if ($o['path'] !== 'have' || !isset(self::GENERATOR[$generator])) {
                throw new HttpException(422, 'Tell us what happens to your generator.', ['generator']);
            }
            $set['generator'] = $generator;
        }
        if (!$set) {
            throw new HttpException(422, 'Nothing to save.');
        }
        Database::update('onboardings', (int) $o['id'], $set + ['updated_at' => now_iso()]);
        $now = $this->row((int) $o['household_id']);
        if ($o['path'] === 'have' && $now['inverter_serial'] && $now['generator'] && !($o['inverter_serial'] && $o['generator'])) {
            $this->move($now, [], 'linked');
        }
        return $this->view((int) $o['household_id']);
    }

    /** Sends the request to the installer: the package's installer, or the one picked for a check visit. */
    public function submit(?int $householdId, ?int $installerId): array
    {
        $o = $this->row($this->requireHousehold($householdId));
        if ($o['status'] !== 'started') {
            throw new HttpException(409, 'Your request has already gone to the installer.');
        }
        $set = ['status' => 'requested'];
        if ($o['path'] === 'need') {
            if ($o['payment'] === 'loan' && !$o['income_band']) {
                throw new HttpException(409, 'Do the quick loan check first.');
            }
        } else {
            if (!$o['inverter_brand'] || !$o['inverter_serial'] || !$o['generator']) {
                throw new HttpException(409, 'Link your inverter and tell us about your generator first.');
            }
            $set['installer_id'] = $this->catalog->installerById((int) $installerId)['id'];
        }
        $this->move($o, $set, 'requested');
        return $this->view((int) $o['household_id']);
    }

    /** The family accepts the installer's quote. With a loan, Access is asked now. */
    public function acceptQuote(?int $householdId): array
    {
        $o = $this->row($this->requireHousehold($householdId));
        if ($o['status'] !== 'quoted') {
            throw new HttpException(409, 'There is no quote waiting for you.');
        }
        if ($o['payment'] !== 'loan') {
            $this->move($o, ['status' => 'approved'], 'approved', 'Quote accepted, paying cash');
            return $this->view((int) $o['household_id']);
        }
        $amount = min((int) $o['quote_kobo'], (int) $o['loan_limit_kobo'], self::LOAN_CAP_KOBO);
        try {
            // The sandbox has one loan applicant (a synthetic account and BVN); every demo family borrows through it.
            $loanId = Bank::client()->openLoan(Settings::LOAN_APPLICANT_ACCOUNT, Settings::LOAN_APPLICANT_BVN, $amount,
                'Solar home system: ' . ($this->catalog->find((int) $o['package_id'])['name']),
                sprintf('loan_onb_%d_%s', $o['id'], substr(hash('sha256', (string) $o['created_at']), 0, 8)));
            Database::run('UPDATE households SET loan_id = ? WHERE id = ?', [$loanId, $o['household_id']]);
            $this->move($o, ['status' => 'approved', 'loan_id' => $loanId, 'loan_status' => 'approved', 'loan_limit_kobo' => $amount], 'approved',
                sprintf('Access loan of ₦%s approved', number_format($amount / 100)));
        } catch (BankError $e) {
            error_log("onboarding {$o['id']}: loan refused: {$e->getMessage()}");
            $this->move($o, ['status' => 'approved', 'loan_status' => 'referred', 'payment' => 'cash'], 'approved',
                'Access referred the loan for review; continuing as a cash quote');
        }
        return $this->view((int) $o['household_id']);
    }

    // ----- The installer's side -----

    public function requests(array $user): array
    {
        Catalog::ensure();
        $rows = $user['role'] === 'admin'
            ? Database::all("SELECT * FROM onboardings WHERE status <> 'started' ORDER BY updated_at DESC")
            : Database::all("SELECT * FROM onboardings WHERE status <> 'started' AND installer_id = ? ORDER BY updated_at DESC", [(int) $user['installer_id']]);
        return ['requests' => array_map(fn ($o) => $this->installerView($o), $rows)];
    }

    /** accept, survey, quote, complete (install day) or verify (check visit). */
    public function act(array $user, int $id, string $action, array $in): array
    {
        $o = Database::one('SELECT * FROM onboardings WHERE id = ?', [$id]) ?? throw new HttpException(404, 'Request not found.');
        if ($user['role'] !== 'admin' && (int) $o['installer_id'] !== (int) $user['installer_id']) {
            throw new HttpException(404, 'Request not found.');
        }
        $need = $o['path'] === 'need';
        $date = fn (int $days) => self::date((string) ($in['date'] ?? ''), $days);
        match (true) {
            $action === 'accept' && $o['status'] === 'requested' && $need => $this->move($o, ['status' => 'accepted'], 'accepted'),
            $action === 'accept' && $o['status'] === 'requested' && !$need => $this->move($o, ['status' => 'visit', 'survey_on' => $date(2)], 'visit'),
            $action === 'survey' && $o['status'] === 'accepted' => $this->move($o, ['status' => 'survey', 'survey_on' => $date(3)], 'survey'),
            $action === 'quote' && $o['status'] === 'survey' => $this->move($o, ['status' => 'quoted', 'quote_kobo' => self::quote($in)], 'quoted'),
            $action === 'complete' && $o['status'] === 'approved' && $need,
            $action === 'verify' && $o['status'] === 'visit' && !$need => $this->certify($o),
            default => throw new HttpException(409, "This request can't do that now (it is $o[status])."),
        };
        return $this->installerView(Database::one('SELECT * FROM onboardings WHERE id = ?', [$id]));
    }

    private static function quote(array $in): int
    {
        $naira = (int) ($in['amount_naira'] ?? 0);
        if ($naira < 100000 || $naira > 50000000) {
            throw new HttpException(422, 'Enter the quote in naira, between ₦100,000 and ₦50,000,000.', ['amount_naira']);
        }
        return $naira * 100;
    }

    private static function date(string $given, int $daysAhead): string
    {
        if ($given !== '') {
            $d = \DateTimeImmutable::createFromFormat('!Y-m-d', $given);
            if (!$d || $d->format('Y-m-d') !== $given) {
                throw new HttpException(422, 'Enter the date as YYYY-MM-DD.', ['date']);
            }
            return $given;
        }
        return gmdate('Y-m-d', time() + $daysAhead * 86400);
    }

    /**
     * Install day (or the check visit) is done: the home joins KlimateX. Creates the site, inverter and
     * generator, opens the family's Access wallet, and starts readings. In this demo the first week of
     * readings is simulated, like every other home's.
     */
    private function certify(array $o): void
    {
        $household = $this->households->find((int) $o['household_id']);
        $wallet = $household['wallet_id'];
        if (!$wallet) {
            try {
                $wallet = Bank::client()->createWallet($household['name'], (string) $household['phone'], sprintf('hh-onb-%d-%s', $o['id'], substr(hash('sha256', (string) $o['created_at']), 0, 8)));
            } catch (BankError $e) {
                error_log("onboarding {$o['id']}: wallet not opened: {$e->getMessage()}");
                $wallet = null;
            }
        }
        Database::tx(function () use ($o, $wallet) {
            $package = $o['package_id'] ? $this->catalog->find((int) $o['package_id']) : null;
            $next = 1 + (int) Database::val("SELECT COUNT(*) FROM sites");
            while (Database::val('SELECT id FROM sites WHERE label = ?', [sprintf('Home %02d', $next)])) {
                $next++;
            }
            $loc = Settings::PROJECT_LOCATION;
            $jitter = fn () => (random_int(-100, 100) / 10000);
            $lat = $loc['lat'] + $jitter();
            $lon = $loc['lng'] + $jitter();
            $today = gmdate('Y-m-d');
            $kwp = $package['panel_kwp'] ?? 1.6;
            $site = (int) Database::insert('sites', ['label' => sprintf('Home %02d', $next), 'household_id' => (int) $o['household_id'],
                'installer_id' => (int) $o['installer_id'], 'area' => $o['area'], 'lat' => $lat, 'lon' => $lon,
                'install_lat' => $lat, 'install_lon' => $lon, 'grid_hours_per_day' => 6.0, 'baseline_kwh_per_day' => 4.0,
                'panel_kwp' => $kwp, 'battery_kwh' => $package['battery_kwh'] ?? 2.4, 'installed_on' => $today]);
            $generator = $o['path'] === 'need' ? 'trade_in' : $o['generator'];
            if ($generator !== 'none') {
                $scrapped = $generator === 'trade_in';
                Database::insert('generators', ['site_id' => $site, 'serial' => sprintf('GEN-ONB-%04d', $o['id']), 'fuel' => 'petrol',
                    'rated_kva' => 3.5, 'scrapped_on' => $scrapped ? $today : null,
                    'scrap_certificate' => $scrapped ? sprintf('RCY-%s-ONB%04d', gmdate('Y'), $o['id']) : null,
                    'trade_in_value_kobo' => $scrapped ? self::TRADE_IN_KOBO : 0]);
            }
            $serial = $o['inverter_serial'] ?: sprintf('INV-ONB-%04d-%s', $o['id'], strtoupper(bin2hex(random_bytes(2))));
            $inverter = (int) Database::insert('inverters', ['site_id' => $site, 'serial' => $serial, 'vendor' => $o['inverter_brand'] ?: 'installer-fitted']);
            $this->firstReadings($inverter, $kwp);
            if ($wallet) {
                Database::run('UPDATE households SET wallet_id = ?, consent_hash = ? WHERE id = ?',
                    [$wallet, hash('sha256', "consent-onb-{$o['id']}"), $o['household_id']]);
            }
            $this->move($o, ['status' => 'certified', 'site_id' => $site], 'certified');
            Ledger::append('home_certified', ['site_id' => $site, 'household_id' => (int) $o['household_id'],
                'installer_id' => (int) $o['installer_id'], 'path' => $o['path'], 'inverter' => $serial]);
        });
    }

    /** Seven days of simulated readings, the same shape as the demo homes', ending at the latest reading day. */
    private function firstReadings(int $inverter, float $kwp): void
    {
        $last = Database::val('SELECT MAX(day) FROM readings') ?: gmdate('Y-m-d', time() - 86400);
        for ($i = 6; $i >= 0; $i--) {
            $day = gmdate('Y-m-d', strtotime("$last -$i days"));
            $sun = (float) (Database::val('SELECT kwh_m2 FROM sunlight WHERE day = ? ORDER BY id LIMIT 1', [$day]) ?: 4.8);
            $generated = round($sun * $kwp * 0.8 * (random_int(90, 110) / 100), 3);
            $toLoad = round($generated * 0.87, 3);
            Database::insert('readings', ['inverter_id' => $inverter, 'day' => $day, 'kwh_generated' => $generated,
                'kwh_solar_to_load' => $toLoad, 'kwh_from_grid' => round(1.7 * random_int(80, 120) / 100, 3),
                'kwh_from_backup' => round(0.03 * random_int(0, 150) / 100, 3), 'source' => 'sim',
                'payload_hash' => hash('sha256', jenc(['inv' => $inverter, 'day' => $day, 'g' => $generated]))]);
        }
    }

    // ----- Shared -----

    private function move(array $o, array $set, string $status, ?string $note = null): void
    {
        $events = jdec($o['events']) ?: [];
        $events[] = array_filter(['status' => $status, 'at' => now_iso(), 'note' => $note]);
        Database::update('onboardings', (int) $o['id'], $set + ['events' => jenc($events), 'updated_at' => now_iso()]);
        try {
            TelegramService::notifyOnboarding((int) $o['household_id'], $status);
        } catch (Throwable $e) {
            error_log('onboarding: telegram notice failed: ' . get_class($e));
        }
    }

    private function requireHousehold(?int $householdId): int
    {
        if (!$householdId || !Database::val('SELECT id FROM onboardings WHERE household_id = ?', [$householdId])) {
            throw new HttpException(404, 'No sign-up in progress for this account.');
        }
        return $householdId;
    }

    private function row(int $householdId): array
    {
        return Database::one('SELECT * FROM onboardings WHERE household_id = ?', [$householdId]);
    }

    public function has(?int $householdId): bool
    {
        return $householdId && Database::val('SELECT id FROM onboardings WHERE household_id = ?', [$householdId]);
    }

    public static function loanLimit(string $band): int
    {
        $monthly = self::INCOME_BANDS[$band]['monthly'] * self::LOAN_SHARE;
        return (int) (round($monthly * self::LOAN_MONTHS / self::LOAN_COST / 10000) * 10000);
    }

    /** What the family sees: where they are, what happens next and who does it, and their estimates. */
    public function view(int $householdId): array
    {
        $o = $this->row($householdId);
        $package = $o['package_id'] ? $this->catalog->find((int) $o['package_id']) : null;
        $installer = $o['installer_id'] ? $this->catalog->installerById((int) $o['installer_id']) : null;
        $events = jdec($o['events']) ?: [];
        $at = [];
        foreach ($events as $e) {
            $at[$e['status']] ??= $e['at'];
        }
        $order = self::ORDER[$o['path']];
        $index = array_search($o['status'], $order, true);
        $loan = $o['payment'] === 'loan' || $o['loan_status'];
        $labels = $o['path'] === 'need'
            ? ['started' => 'Account created', 'requested' => 'Request sent', 'accepted' => 'Installer accepted', 'survey' => 'Survey booked',
                'quoted' => 'Quote ready', 'approved' => $loan ? 'Loan approved' : 'Quote accepted', 'certified' => 'Installed and certified']
            : ['started' => 'Account created', 'requested' => 'Visit requested', 'visit' => 'Visit booked', 'certified' => 'Verified and certified'];
        $steps = [];
        foreach ($order as $i => $status) {
            $steps[] = ['key' => $status, 'label' => $labels[$status], 'done' => $i <= $index, 'current' => $i === $index + 1, 'at' => $at[$status] ?? null];
        }
        if ($o['path'] === 'have') {
            $linked = $o['inverter_serial'] && $o['generator'];
            array_splice($steps, 1, 0, [['key' => 'linked', 'label' => 'Inverter linked', 'done' => (bool) $linked, 'current' => !$linked, 'at' => $at['linked'] ?? null]]);
            if (!$linked) {
                $steps[2]['current'] = false;
            }
        }
        return [
            'id' => (int) $o['id'], 'path' => $o['path'], 'status' => $o['status'], 'channel' => $o['channel'], 'area' => $o['area'],
            'certified' => $o['status'] === 'certified', 'site_id' => $o['site_id'] ? (int) $o['site_id'] : null,
            'package' => $package ? array_diff_key($package, ['installer' => 1]) : null, 'installer' => $installer,
            'payment' => $o['payment'],
            'loan' => $o['income_band'] || $o['loan_status'] ? ['income_band' => $o['income_band'],
                'limit_naira' => $o['loan_limit_kobo'] !== null ? (int) $o['loan_limit_kobo'] / 100 : null,
                'monthly_naira' => $o['loan_limit_kobo'] !== null ? (int) (round($o['loan_limit_kobo'] / 100 * self::LOAN_COST / self::LOAN_MONTHS / 100) * 100) : null,
                'months' => self::LOAN_MONTHS, 'cap_naira' => self::LOAN_CAP_KOBO / 100, 'status' => $o['loan_status'], 'loan_id' => $o['loan_id']] : null,
            'quote_naira' => $o['quote_kobo'] !== null ? (int) $o['quote_kobo'] / 100 : null,
            'survey_on' => $o['survey_on'],
            'inverter' => ['brand' => $o['inverter_brand'], 'serial' => $o['inverter_serial']],
            'generator' => $o['generator'],
            'steps' => $steps,
            'next' => $this->next($o, $installer),
            'estimate' => $package['estimate'] ?? Catalog::estimate(1.6),
            'events' => array_map(fn ($e) => $e + ['label' => ($labels + ['linked' => 'Inverter linked'])[$e['status']] ?? $e['status']], $events),
        ];
    }

    /** The one thing that happens next, and whose move it is. */
    private function next(array $o, ?array $installer): array
    {
        $who = $installer['name'] ?? 'Your installer';
        $day = $o['survey_on'] ? gmdate('j M Y', strtotime($o['survey_on'])) : '';
        return match ($o['status']) {
            'started' => match (true) {
                $o['path'] === 'need' && $o['payment'] === 'loan' && !$o['income_band'] => ['by' => 'family', 'action' => 'loan_check', 'text' => 'Do the quick Access loan check.'],
                $o['path'] === 'need' => ['by' => 'family', 'action' => 'send_request', 'text' => "Send your request to $who."],
                !$o['inverter_brand'] || !$o['inverter_serial'] => ['by' => 'family', 'action' => 'link_inverter', 'text' => 'Link your inverter: brand and serial number.'],
                !$o['generator'] => ['by' => 'family', 'action' => 'generator', 'text' => 'Tell us what happens to your generator.'],
                default => ['by' => 'family', 'action' => 'pick_installer', 'text' => 'Pick an installer for your check visit.'],
            },
            'requested' => ['by' => 'installer', 'action' => null, 'text' => "Waiting for $who to accept your request."],
            'accepted' => ['by' => 'installer', 'action' => null, 'text' => "$who will book a survey of your home."],
            'survey' => ['by' => 'installer', 'action' => null, 'text' => "Survey booked for $day. Your quote follows."],
            'quoted' => ['by' => 'family', 'action' => 'accept_quote', 'text' => sprintf('Your quote is ₦%s. Accept it to %s.', number_format($o['quote_kobo'] / 100),
                $o['payment'] === 'loan' ? 'send it to Access for your loan' : 'book your install')],
            'approved' => ['by' => 'installer', 'action' => null, 'text' => "$who will install your system, take your generator as a trade-in and pair your inverter."],
            'visit' => ['by' => 'installer', 'action' => null, 'text' => "$who visits on $day to check your inverter and generator."],
            'certified' => ['by' => null, 'action' => null, 'text' => 'Your home is live on KlimateX.'],
            default => ['by' => null, 'action' => null, 'text' => ''],
        };
    }

    private function installerView(array $o): array
    {
        $view = $this->view((int) $o['household_id']);
        $household = $this->households->find((int) $o['household_id']);
        $actions = match (true) {
            $o['status'] === 'requested' => ['accept'],
            $o['status'] === 'accepted' => ['survey'],
            $o['status'] === 'survey' => ['quote'],
            $o['status'] === 'approved' && $o['path'] === 'need' => ['complete'],
            $o['status'] === 'visit' => ['verify'],
            default => [],
        };
        return ['id' => (int) $o['id'], 'family' => $household['name'], 'phone' => PhoneAuthService::mask((string) $household['phone']),
            'requested_at' => array_column($view['steps'], 'at', 'key')['requested'] ?? $o['updated_at'], 'actions' => $actions] + $view;
    }
}
