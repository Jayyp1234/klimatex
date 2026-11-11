<?php

namespace App\Models;

use App\Config\Database;

final class HouseholdRepository
{
    public function find(int $id): ?array
    {
        return Database::one('SELECT * FROM households WHERE id = ?', [$id]);
    }

    public function findByPhone(string $phone): ?array
    {
        return Database::one('SELECT * FROM households WHERE phone = ?', [$phone]);
    }

    public function savePayout(int $id, string $method, ?string $bankCode, ?string $account, ?string $accountName): void
    {
        Database::run('UPDATE households SET payout_method = ?, payout_bank_code = ?, payout_account = ?, payout_account_name = ?, payout_updated_at = ? WHERE id = ?',
            [$method, $bankCode, $account, $accountName, now_iso(), $id]);
    }
}
