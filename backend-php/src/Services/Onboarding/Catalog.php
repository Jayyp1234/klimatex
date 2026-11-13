<?php

namespace App\Services\Onboarding;

use App\Config\Database;
use App\Config\Settings;
use App\Core\HttpException;

/**
 * The installer marketplace: listed installers, their solar packages with price ranges, and what each
 * package could save. Prices are sample figures until real installers list their own, and every
 * saving is an estimate from package size, not a metered result.
 */
final class Catalog
{
    /** Sun hours a day for Lagos (rounded) and the share of panel output that reaches the home. */
    private const SUN_HOURS = 4.5;
    private const SYSTEM_YIELD = 0.8;
    /** Hours of grid a day in the estimate, the same default the demo homes use. */
    private const GRID_HOURS = 6.0;
    /** Litres of petrol a small generator burns per kWh, the figure the certificate uses. */
    private const LITRES_PER_KWH = 0.7;

    /** The demo's first installer is listed with these; three sample installers join it. */
    private const FIRST_INSTALLER = ['area' => 'Surulere', 'blurb' => 'Co-operative of trained installers. Fitted the first metered homes on KlimateX.',
        'packages' => [
            ['Starter 1.5 kVA', 1.5, 2.4, 4, 400, 130000000, 160000000, 'Lights, fans, TV, phone charging'],
            ['Family 3.5 kVA', 3.5, 5.0, 6, 550, 300000000, 360000000, 'Fridge, fans, TV, lights, a small pump'],
        ]];
    private const SAMPLE_INSTALLERS = [
        ['Yaba Solar Works', 'KX-INS-012', 'Yaba', 'Solar for flats and family homes on the mainland. Two-year workmanship warranty.', [
            ['Home 3 kVA', 3.0, 5.0, 6, 450, 260000000, 310000000, 'Fridge, fans, TV, lights'],
            ['Home Plus 5 kVA', 5.0, 10.0, 10, 550, 520000000, 600000000, 'Freezer, AC in one room, pump'],
        ]],
        ['Ikeja PowerHome', 'KX-INS-019', 'Ikeja', 'Small-office and home systems. Installs within two weeks of a quote.', [
            ['Flat 2 kVA', 2.0, 2.5, 4, 450, 150000000, 190000000, 'Lights, fans, TV, laptop'],
            ['Family 3.5 kVA', 3.5, 5.0, 8, 450, 320000000, 380000000, 'Fridge, fans, TV, lights, a small pump'],
        ]],
        ['Lekki Sun Installers', 'KX-INS-024', 'Lekki', 'Larger homes and estates on the island.', [
            ['Estate 5 kVA', 5.0, 10.0, 12, 550, 580000000, 680000000, 'Freezer, two ACs, pump, the whole house'],
        ]],
    ];

    /** Lists the demo's installer and adds the sample installers, once. Safe to call on every read. */
    public static function ensure(): void
    {
        $first = Database::one('SELECT id, listed FROM installers ORDER BY id LIMIT 1');
        $samplesMissing = !Database::val('SELECT id FROM installers WHERE name = ?', [self::SAMPLE_INSTALLERS[0][0]]);
        if (($first && !(int) $first['listed']) || $samplesMissing) {
            Database::tx(function () {
                Database::lock('installer_catalog');
                $first = Database::one('SELECT id, listed FROM installers ORDER BY id LIMIT 1');
                if ($first && !(int) $first['listed'] && !Database::val('SELECT id FROM installer_packages WHERE installer_id = ?', [$first['id']])) {
                    Database::run('UPDATE installers SET area = ?, blurb = ?, listed = 1 WHERE id = ?',
                        [self::FIRST_INSTALLER['area'], self::FIRST_INSTALLER['blurb'], $first['id']]);
                    self::addPackages((int) $first['id'], self::FIRST_INSTALLER['packages']);
                }
                foreach (self::SAMPLE_INSTALLERS as [$name, $accreditation, $area, $blurb, $packages]) {
                    if (Database::val('SELECT id FROM installers WHERE name = ?', [$name])) {
                        continue;
                    }
                    // Sample installers are paid into the sandbox installer account if a sale ever reaches them.
                    $id = (int) Database::insert('installers', ['name' => $name, 'accreditation_id' => $accreditation,
                        'account_number' => Settings::INSTALLER_ACCOUNT, 'bank_code' => Settings::INSTALLER_BANK_CODE,
                        'area' => $area, 'blurb' => $blurb, 'listed' => 1]);
                    self::addPackages($id, $packages);
                }
            });
        }
    }

    private static function addPackages(int $installerId, array $packages): void
    {
        foreach ($packages as [$name, $kva, $battery, $panels, $watts, $min, $max, $powers]) {
            Database::insert('installer_packages', ['installer_id' => $installerId, 'name' => $name, 'inverter_kva' => $kva,
                'battery_kwh' => $battery, 'panels' => $panels, 'panel_w' => $watts, 'price_min_kobo' => $min,
                'price_max_kobo' => $max, 'powers' => $powers]);
        }
    }

    /** Every listed installer and its packages, plus the price range across all of them. */
    public function list(): array
    {
        self::ensure();
        $packages = [];
        foreach (Database::all('SELECT * FROM installer_packages ORDER BY price_min_kobo') as $p) {
            $packages[(int) $p['installer_id']][] = self::package($p);
        }
        $installers = [];
        foreach (Database::all('SELECT * FROM installers WHERE listed = 1 ORDER BY id') as $i) {
            $installers[] = $this->installer($i) + ['packages' => $packages[(int) $i['id']] ?? []];
        }
        $all = array_merge(...array_values($packages ?: [[]]));
        $family = array_values(array_filter($all, fn ($p) => $p['inverter_kva'] >= 3 && $p['inverter_kva'] <= 3.5));
        return [
            'installers' => $installers,
            'price_range_naira' => $all ? [min(array_column($all, 'price_min_naira')), max(array_column($all, 'price_max_naira'))] : null,
            'family_home_range_naira' => $family ? [min(array_column($family, 'price_min_naira')), max(array_column($family, 'price_max_naira'))] : null,
            'note' => 'Sample prices from demo installers. Your installer confirms the final price after a site survey.',
        ];
    }

    public function find(int $packageId): array
    {
        self::ensure();
        $p = Database::one('SELECT * FROM installer_packages WHERE id = ?', [$packageId]) ?? throw new HttpException(404, 'That package is no longer listed.', ['package_id']);
        $i = Database::one('SELECT * FROM installers WHERE id = ?', [$p['installer_id']]);
        return self::package($p) + ['installer' => $this->installer($i)];
    }

    public function installerById(int $id): array
    {
        self::ensure();
        $i = Database::one('SELECT * FROM installers WHERE id = ? AND listed = 1', [$id]) ?? throw new HttpException(404, 'That installer is not listed.', ['installer_id']);
        return $this->installer($i);
    }

    /** How the installer's homes perform on our meters, which is what a family should judge them on. */
    private function installer(array $i): array
    {
        $homes = (int) Database::val('SELECT COUNT(*) FROM sites WHERE installer_id = ?', [$i['id']]);
        $period = Database::val('SELECT MAX(period_id) FROM site_results');
        $trust = $period ? Database::val('SELECT AVG(r.trust_score) FROM site_results r JOIN sites s ON s.id = r.site_id WHERE r.period_id = ? AND s.installer_id = ?', [$period, $i['id']]) : null;
        return ['id' => (int) $i['id'], 'name' => $i['name'], 'area' => $i['area'], 'blurb' => $i['blurb'],
            'accreditation_id' => $i['accreditation_id'], 'metered_homes' => $homes,
            'average_trust_score' => $trust !== null ? (int) round((float) $trust) : null];
    }

    public static function package(array $p): array
    {
        $kwp = $p['panels'] * $p['panel_w'] / 1000;
        return ['id' => (int) $p['id'], 'installer_id' => (int) $p['installer_id'], 'name' => $p['name'],
            'inverter_kva' => (float) $p['inverter_kva'], 'battery_kwh' => (float) $p['battery_kwh'],
            'panels' => (int) $p['panels'], 'panel_w' => (int) $p['panel_w'], 'panel_kwp' => round($kwp, 2), 'powers' => $p['powers'],
            'price_min_naira' => (int) $p['price_min_kobo'] / 100, 'price_max_naira' => (int) $p['price_max_kobo'] / 100,
            'estimate' => self::estimate($kwp)];
    }

    /**
     * A year's estimate for a system this size: solar made, generator power it replaces (grid covers
     * 6 hours a day), petrol not burned, tonnes avoided and the family's half of the carbon income at
     * the demo price. Metered data replaces all of this once the home is live.
     */
    public static function estimate(float $kwp, float $gridHours = self::GRID_HOURS): array
    {
        $solar = $kwp * self::SUN_HOURS * self::SYSTEM_YIELD * 365;
        $generator = $solar * (1 - $gridHours / 24);
        $tonnes = $generator / 1000 * Settings::EF_GENSET * (1 - Settings::DAF_NETZERO);
        $family = $tonnes * Settings::PRICE_PER_CREDIT_KOBO / 100 * Settings::SPLIT['household'] / 10000;
        return ['solar_kwh_year' => (int) (round($solar / 10) * 10), 'generator_kwh_year' => (int) (round($generator / 10) * 10),
            'petrol_litres_year' => (int) (round($generator * self::LITRES_PER_KWH / 10) * 10),
            'tonnes_year' => round($tonnes, 1), 'family_carbon_naira_year' => (int) (round($family / 50) * 50),
            'basis' => 'Estimate for this system size. Your metered readings replace it once the home is live.'];
    }
}
