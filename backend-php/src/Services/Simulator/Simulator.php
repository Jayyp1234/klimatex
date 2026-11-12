<?php

namespace App\Services\Simulator;

use App\Config\Database;
use App\Config\Settings;
use App\Models\KvStore;
use App\Services\Bank\Bank;
use App\Models\UserRepository;
use App\Services\Bank\BankApi;
use App\Services\Bank\BankError;
use App\Services\Ledger\Ledger;
use App\Services\Evidence\EvidenceService;
use App\Services\Street\StreetService;

/**
 * Synthetic demo data: 20 Surulere homes, Jan-Jun 2026, two planted frauds.
 *   Home 17 reports about 3x what the sun allows (sunlight check fails).
 *   Home 19 replays Home 04's data stream (clone check catches both).
 *   Home 04's panels gather dust in the last week (the dust alert fires; Home 19 copies it).
 *   Home 12 is Adaeze: a small backup generator keeps her at grade B; paid off her solar loan.
 * Sunlight is a placeholder series unless data/sunlight_surulere_2026.json exists
 * (run scripts/fetch_nasa.php on a machine with internet to create it).
 */
final class Simulator
{
    public const AREA = 'Surulere';
    public const START = '2026-01-01';
    public const END = '2026-06-30';
    private const MONTHLY_MEAN = [1 => 5.1, 2 => 5.4, 3 => 5.4, 4 => 5.2, 5 => 4.9, 6 => 4.2]; // kWh/m2/day, placeholder

    public static function days(string $start = self::START, string $end = self::END): array
    {
        $out = [];
        for ($d = new \DateTimeImmutable($start); $d <= new \DateTimeImmutable($end); $d = $d->modify('+1 day')) {
            $out[] = $d->format('Y-m-d');
        }
        return $out;
    }

    /**
     * Bank references for wallets and the loan are fixed per home. When the live database is reset and
     * seeded again, SEED_RUN (e.g. a timestamp) makes them new, so the sandbox can't refuse or replay them.
     */
    private static function runTag(): string
    {
        $run = preg_replace('/[^A-Za-z0-9]/', '', (string) getenv('SEED_RUN'));
        return $run !== '' ? "-$run" : '';
    }

    /** A real sandbox loan. If the bank refuses, the home is simply paid into its wallet. */
    private static function openLoan(BankApi $bank, int $n): ?string
    {
        try {
            // Adaeze's own sandbox account and BVN, so the bank's scoring and disbursement are real.
            return $bank->openLoan(Settings::LOAN_APPLICANT_ACCOUNT, Settings::LOAN_APPLICANT_BVN, Settings::DEMO_LOAN_KOBO,
                'Solar home system with 2.4 kWh battery', sprintf('loan_demo_%02d', $n) . self::runTag());
        } catch (BankError $e) {
            error_log("demo loan for home $n: {$e->getMessage()}");
            return null;
        }
    }

    /** One login per role, only when DEMO_PASSWORD is configured. */
    private static function createDemoLogins(int $householdId, int $installerId): void
    {
        $password = Settings::demoPassword();
        if ($password === null) {
            return;
        }
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $users = new UserRepository();
        $users->create('adaeze@demo.klimatex.test', 'Adaeze', $hash, 'household', $householdId);
        $users->create('installer@demo.klimatex.test', 'Arewa Solar Co-operative Society', $hash, 'installer', null, $installerId);
        $users->create('auditor@demo.klimatex.test', 'Demo Auditor (team member)', $hash, 'auditor');
        $users->create('buyer@demo.klimatex.test', 'Mama Nkechi Provisions Ltd', $hash, 'buyer');
        $users->create('lender@demo.klimatex.test', 'Access Bank lending team', $hash, 'lender');
        $users->create('admin@demo.klimatex.test', 'KlimateX Operations', $hash, 'admin');
    }

    public static function seed(): array
    {
        if ((int) Database::val('SELECT COUNT(*) FROM sites') > 0) return ['seeded' => false, 'reason' => 'already seeded'];
        $rng = new Rng(2026);
        $b = Bank::client();
        return Database::tx(function () use ($rng, $b) {
            $file = dirname(__DIR__, 3) . '/data/sunlight_surulere_2026.json';
            $real = is_file($file) ? json_decode(file_get_contents($file), true) : null;
            $sun = [];
            foreach (self::days() as $d) {
                $v = $real[$d] ?? self::MONTHLY_MEAN[(int) substr($d, 5, 2)] * $rng->uniform(0.72, 1.12);
                $sun[$d] = round($v, 3);
                Database::insert('sunlight', ['area' => self::AREA, 'day' => $d, 'kwh_m2' => $sun[$d]]);
            }

            $inst = Database::insert('installers', ['name' => 'Arewa Solar Co-operative Society', 'accreditation_id' => 'KX-INS-007',
                'account_number' => Settings::INSTALLER_ACCOUNT, 'bank_code' => Settings::INSTALLER_BANK_CODE]);

            $adaeze = 0;
            $series04 = null;
            for ($n = 1; $n <= 20; $n++) {
                $label = sprintf('Home %02d', $n);
                $name = $n === 12 ? 'Adaeze' : sprintf('Household %02d', $n);
                $phone = sprintf('+23470000100%02d', $n);
                $hh = Database::insert('households', ['name' => $name, 'phone' => $phone, 'wallet_id' => $b->createWallet($name, $phone, "hh-$n" . self::runTag()),
                    'consent_hash' => hash('sha256', "consent-$n"), 'loan_id' => $n === 12 ? self::openLoan($b, $n) : null]);
                if ($n === 12) $adaeze = $hh;
                $lat = 6.4980 + $rng->uniform(-0.01, 0.01);
                $lon = 3.3550 + $rng->uniform(-0.01, 0.01);
                $kwp = round($rng->uniform(1.45, 1.75), 2);
                $site = Database::insert('sites', ['label' => $label, 'household_id' => $hh, 'installer_id' => $inst, 'area' => self::AREA,
                    'lat' => $lat, 'lon' => $lon, 'install_lat' => $lat + $rng->uniform(-0.0004, 0.0004),
                    'install_lon' => $lon + $rng->uniform(-0.0004, 0.0004), 'grid_hours_per_day' => 6.0,
                    'baseline_kwh_per_day' => 4.0, 'panel_kwp' => $kwp, 'battery_kwh' => 2.4, 'installed_on' => '2025-12-20']);
                Database::insert('generators', ['site_id' => $site, 'serial' => sprintf('GEN-%04d-%d', $n, $rng->int(1000, 9999)),
                    'fuel' => 'petrol', 'rated_kva' => 3.5, 'scrapped_on' => '2026-01-03',
                    'scrap_certificate' => sprintf('RCY-2026-%04d', $n), 'scrap_photo' => "scrap/$label.jpg",
                    'trade_in_value_kobo' => 4500000]);
                $inv = Database::insert('inverters', ['site_id' => $site, 'serial' => sprintf('INV-SIM-%04d', $n), 'vendor' => 'simulator']);

                $series = [];
                foreach (self::days() as $i => $d) {
                    if ($n === 19 && $series04) {
                        [$g, $toLoad] = $series04[$i];
                    } else {
                        $g = max(0.2, $sun[$d] * $kwp * 0.80 * $rng->gauss(1.0, 0.09));
                        if ($n === 17) $g = $sun[$d] * $kwp * 3.0;
                        if ($n === 4 && $i >= count(self::days()) - 7) $g *= 0.78; // dust on the panels in the last week
                        $toLoad = $g * $rng->uniform(0.84, 0.90);
                    }
                    $series[] = [$g, $toLoad];
                    $grid = 1.7 * $rng->uniform(0.8, 1.2);
                    $backup = $n === 12 ? 0.45 * $rng->uniform(0.6, 1.4) : 0.04 * $rng->uniform(0.0, 1.5);
                    Database::insert('readings', ['inverter_id' => $inv, 'day' => $d, 'kwh_generated' => round($g, 3),
                        'kwh_solar_to_load' => round($toLoad, 3), 'kwh_from_grid' => round($grid, 3),
                        'kwh_from_backup' => round($backup, 3), 'source' => 'sim',
                        'payload_hash' => hash('sha256', jenc(['inv' => $inv, 'day' => $d, 'g' => round($g, 3)]))]);
                }
                if ($n === 4) $series04 = $series;
            }
            StreetService::assignDemo(self::AREA);
            EvidenceService::assignDemo();
            self::createDemoLogins($adaeze, $inst);
            Ledger::append('seed.loaded', ['homes' => 20, 'from' => self::START, 'to' => self::END, 'area' => self::AREA]);
            return ['seeded' => true, 'homes' => 20, 'days' => count(self::days())];
        });
    }
}
