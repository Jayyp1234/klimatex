<?php

namespace App\Models;

use App\Config\Database;

/** Refresh tokens (stored only as hashes) and failed-login tracking. */
final class AuthTokenRepository
{
    public function store(int $userId, string $hash, string $expiresAt): void
    {
        Database::insert('refresh_tokens', ['user_id' => $userId, 'token_hash' => $hash, 'expires_at' => $expiresAt, 'created_at' => now_iso()]);
    }

    public function findByHash(string $hash): ?array
    {
        return Database::one('SELECT * FROM refresh_tokens WHERE token_hash = ?', [$hash]);
    }

    /** True only for the one caller that actually revoked it, so a token can't be spent twice. */
    public function revoke(int $id): bool
    {
        return Database::run('UPDATE refresh_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL', [now_iso(), $id])->rowCount() === 1;
    }

    public function revokeAll(int $userId): void
    {
        Database::run('UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', [now_iso(), $userId]);
    }

    public function recentFailures(string $email, string $since): int
    {
        return (int) Database::val('SELECT COUNT(*) FROM login_failures WHERE email = ? AND failed_at >= ?', [$email, $since]);
    }

    public function recordFailure(string $email, string $ip): void
    {
        Database::insert('login_failures', ['email' => $email, 'ip' => $ip, 'failed_at' => now_iso()]);
    }

    public function clearFailures(string $email): void
    {
        Database::run('DELETE FROM login_failures WHERE email = ?', [$email]);
    }
}
