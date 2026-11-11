<?php

namespace App\Models;

use App\Config\Database;

final class OrderRepository
{
    public function create(array $row): int
    {
        return (int) Database::insert('orders', $row);
    }

    public function find(int $id): ?array
    {
        return Database::one('SELECT * FROM orders WHERE id = ?', [$id]);
    }

    public function findByReference(string $reference): ?array
    {
        return Database::one('SELECT * FROM orders WHERE payment_reference = ?', [$reference]);
    }

    public function update(int $id, array $row): void
    {
        Database::update('orders', $id, $row);
    }

    /** Atomic state change. Only one concurrent caller can win it. */
    public function transition(int $id, string $from, string $to): bool
    {
        return Database::run('UPDATE orders SET status = ? WHERE id = ? AND status = ?', [$to, $id, $from])->rowCount() === 1;
    }

    public function expiredReservations(string $now): array
    {
        return Database::all("SELECT id FROM orders WHERE status = 'reserved' AND expires_at < ?", [$now]);
    }

    public function awaitingSettlement(): array
    {
        return Database::all("SELECT id FROM orders WHERE status = 'retired' ORDER BY id");
    }

    public function forBuyer(int $userId): array
    {
        return Database::all('SELECT * FROM orders WHERE buyer_user_id = ? ORDER BY id DESC', [$userId]);
    }
}
