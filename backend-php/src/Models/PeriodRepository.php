<?php

namespace App\Models;

use App\Config\Database;

final class PeriodRepository
{
    public function find(int $id): ?array
    {
        return Database::one('SELECT * FROM periods WHERE id = ?', [$id]);
    }

    public function latestId(): ?int
    {
        $id = Database::val('SELECT MAX(id) FROM periods');
        return $id ? (int) $id : null;
    }

    public function firstOverlapping(string $start, string $end): ?array
    {
        return Database::one('SELECT id, start_day, end_day FROM periods WHERE start_day <= ? AND end_day >= ? ORDER BY id LIMIT 1', [$end, $start]);
    }

    public function create(array $row): int
    {
        return (int) Database::insert('periods', $row);
    }

    public function update(int $id, array $row): void
    {
        Database::update('periods', $id, $row);
    }
}
