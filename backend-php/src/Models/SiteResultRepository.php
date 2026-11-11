<?php

namespace App\Models;

use App\Config\Database;

final class SiteResultRepository
{
    public function deleteForPeriod(int $periodId): void
    {
        Database::run('DELETE FROM site_results WHERE period_id = ?', [$periodId]);
    }

    public function create(array $row): void
    {
        Database::insert('site_results', $row);
    }

    public function update(int $id, array $row): void
    {
        Database::update('site_results', $id, $row);
    }

    /** @return array<int,array> keyed by site id */
    public function forPeriod(int $periodId): array
    {
        $out = [];
        foreach (Database::all('SELECT * FROM site_results WHERE period_id = ? ORDER BY site_id', [$periodId]) as $row) {
            $out[(int) $row['site_id']] = $row;
        }
        return $out;
    }

    public function forPeriodWithLabels(int $periodId): array
    {
        return Database::all('SELECT r.*, s.label FROM site_results r JOIN sites s ON s.id = r.site_id WHERE period_id = ? ORDER BY site_id', [$periodId]);
    }

    public function find(int $periodId, int $siteId): ?array
    {
        return Database::one('SELECT * FROM site_results WHERE period_id = ? AND site_id = ?', [$periodId, $siteId]);
    }

    public function forSite(int $siteId): array
    {
        return Database::all('SELECT * FROM site_results WHERE site_id = ? ORDER BY period_id', [$siteId]);
    }

    public function latestForSite(int $siteId): ?array
    {
        return Database::one('SELECT * FROM site_results WHERE site_id = ? ORDER BY period_id DESC LIMIT 1', [$siteId]);
    }
}
