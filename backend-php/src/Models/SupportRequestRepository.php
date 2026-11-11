<?php

namespace App\Models;

use App\Config\Database;

final class SupportRequestRepository
{
    public function create(array $row): array
    {
        $now = now_iso();
        $id = (int) Database::insert('support_requests', $row + ['status' => 'received', 'created_at' => $now, 'updated_at' => $now]);
        return Database::one('SELECT * FROM support_requests WHERE id = ?', [$id]);
    }

    public function forUser(int $userId): array
    {
        return Database::all('SELECT * FROM support_requests WHERE user_id = ? ORDER BY id DESC LIMIT 50', [$userId]);
    }

    public function all(): array
    {
        return Database::all('SELECT * FROM support_requests ORDER BY id DESC LIMIT 200');
    }

    public function countSince(int $userId, string $since): int
    {
        return (int) Database::val('SELECT COUNT(*) FROM support_requests WHERE user_id = ? AND created_at >= ?', [$userId, $since]);
    }
}
