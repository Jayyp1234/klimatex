<?php

namespace App\Models;

use App\Config\Database;

/** One-time sign-in codes. Only hashes are stored: the code itself and the setup token never touch the database. */
final class PhoneCodeRepository
{
    public function create(string $phone, string $codeHash, string $expiresAt): int
    {
        return (int) Database::insert('phone_codes', ['phone' => $phone, 'code_hash' => $codeHash, 'expires_at' => $expiresAt, 'created_at' => now_iso()]);
    }

    public function countSince(string $phone, string $since): int
    {
        return (int) Database::val('SELECT COUNT(*) FROM phone_codes WHERE phone = ? AND created_at >= ?', [$phone, $since]);
    }

    /** The newest code not yet used, so asking for a new code makes the old one useless. */
    public function latestOpen(string $phone): ?array
    {
        $row = Database::one('SELECT * FROM phone_codes WHERE phone = ? ORDER BY id DESC LIMIT 1', [$phone]);
        return $row && $row['verified_at'] === null ? $row : null;
    }

    public function addAttempt(int $id): void
    {
        Database::run('UPDATE phone_codes SET attempts = attempts + 1 WHERE id = ?', [$id]);
    }

    public function markVerified(int $id, string $setupHash): void
    {
        Database::run('UPDATE phone_codes SET verified_at = ?, setup_hash = ? WHERE id = ?', [now_iso(), $setupHash, $id]);
    }

    public function findBySetup(string $setupHash): ?array
    {
        return Database::one('SELECT * FROM phone_codes WHERE setup_hash = ?', [$setupHash]);
    }

    /** True only for the first caller, so a setup token can't be spent twice. */
    public function spendSetup(int $id): bool
    {
        return Database::run('UPDATE phone_codes SET setup_used_at = ? WHERE id = ? AND setup_used_at IS NULL', [now_iso(), $id])->rowCount() === 1;
    }
}
