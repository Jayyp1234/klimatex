<?php

namespace App\Models;

use App\Config\Database;

final class UserRepository
{
    public const ROLES = ['household', 'installer', 'auditor', 'buyer', 'lender', 'admin'];

    public function create(string $email, string $name, string $hash, string $role, ?int $householdId = null, ?int $installerId = null): int
    {
        return (int) Database::insert('users', [
            'email' => strtolower(trim($email)), 'name' => $name, 'password_hash' => $hash, 'role' => $role,
            'household_id' => $householdId, 'installer_id' => $installerId, 'active' => 1, 'created_at' => now_iso(),
        ]);
    }

    public function findByEmail(string $email): ?array
    {
        return Database::one('SELECT * FROM users WHERE email = ?', [strtolower(trim($email))]);
    }

    public function find(int $id): ?array
    {
        return Database::one('SELECT * FROM users WHERE id = ?', [$id]);
    }

    public function findByPhone(string $phone): ?array
    {
        return Database::one('SELECT * FROM users WHERE phone = ?', [$phone]);
    }

    /** The one login that belongs to a household, if the family has signed in before. */
    public function findForHousehold(int $householdId): ?array
    {
        return Database::one("SELECT * FROM users WHERE household_id = ? AND role = 'household' ORDER BY id LIMIT 1", [$householdId]);
    }

    public function setPhoneAccess(int $id, string $phone, string $pinHash, string $name): void
    {
        Database::run('UPDATE users SET phone = ?, pin_hash = ?, name = ? WHERE id = ?', [$phone, $pinHash, $name, $id]);
    }
}
