<?php

namespace App\Models;

use App\Config\Database;

final class SiteRepository
{
    public function owners(int $siteId): ?array
    {
        return Database::one('SELECT household_id, installer_id FROM sites WHERE id = ?', [$siteId]);
    }

    public function allWithHousehold(?int $installerId = null): array
    {
        $where = $installerId ? 'WHERE s.installer_id = ?' : '';
        return Database::all("SELECT s.*, h.name FROM sites s JOIN households h ON h.id = s.household_id $where ORDER BY s.id",
            $installerId ? [$installerId] : []);
    }

    public function detail(int $id): ?array
    {
        return Database::one('SELECT s.*, h.name, h.wallet_id, h.loan_id, i.id AS inverter_id, i.serial AS inverter_serial, i.vendor,
            g.serial AS generator_serial, g.rated_kva, g.scrapped_on, g.scrap_certificate
            FROM sites s JOIN households h ON h.id = s.household_id JOIN inverters i ON i.site_id = s.id
            JOIN generators g ON g.site_id = s.id WHERE s.id = ?', [$id]);
    }

    public function forCompute(): array
    {
        return Database::all('SELECT s.*, i.id AS inverter_id, i.accuracy_pct, g.rated_kva, g.scrapped_on, g.scrap_certificate
            FROM sites s JOIN inverters i ON i.site_id = s.id JOIN generators g ON g.site_id = s.id ORDER BY s.id');
    }

    public function readingsBetween(string $start, string $end): array
    {
        return Database::all('SELECT * FROM readings WHERE day >= ? AND day <= ?', [$start, $end]);
    }

    public function readingsFor(int $inverterId): array
    {
        return Database::all('SELECT * FROM readings WHERE inverter_id = ? ORDER BY day', [$inverterId]);
    }

    /** @return array<string,float> day => kWh/m2 */
    public function sunlight(string $area, string $start, string $end): array
    {
        $out = [];
        foreach (Database::all('SELECT day, kwh_m2 FROM sunlight WHERE area = ? AND day >= ? AND day <= ?', [$area, $start, $end]) as $row) {
            $out[$row['day']] = (float) $row['kwh_m2'];
        }
        return $out;
    }

    public function householdFor(int $siteId): ?array
    {
        return Database::one('SELECT s.id, h.name, h.wallet_id, h.loan_id, h.payout_method, h.payout_bank_code, h.payout_account, h.payout_account_name
            FROM sites s JOIN households h ON h.id = s.household_id WHERE s.id = ?', [$siteId]);
    }

    /** @return string[] inverter serials for the given sites, sent to the registry as sensor ids */
    public function inverterSerials(array $siteIds): array
    {
        if ($siteIds === []) {
            return [];
        }
        $in = implode(',', array_fill(0, count($siteIds), '?'));
        return array_column(Database::all("SELECT serial FROM inverters WHERE site_id IN ($in) ORDER BY site_id", array_values($siteIds)), 'serial');
    }

    public function idForHousehold(int $householdId): ?int
    {
        $id = Database::val('SELECT id FROM sites WHERE household_id = ? ORDER BY id LIMIT 1', [$householdId]);
        return $id ? (int) $id : null;
    }

    /** The newest day any inverter has reported, which is "today" for the data feed. */
    public function latestReadingDay(): ?string
    {
        return Database::val('SELECT MAX(day) FROM readings') ?: null;
    }

    public function firstInstaller(): ?array
    {
        return Database::one('SELECT * FROM installers ORDER BY id LIMIT 1');
    }
}
