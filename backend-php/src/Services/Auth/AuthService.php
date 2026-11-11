<?php

namespace App\Services\Auth;

use App\Config\Settings;
use App\Core\HttpException;
use App\Models\AuthTokenRepository;
use App\Models\UserRepository;

final class AuthService
{
    /** Verified against when the email is unknown, so response time doesn't reveal which emails exist. */
    public const DUMMY_HASH = '$2y$10$usesomesillystringforsalt.0n2vF0xQ6r1m7oQ0m4g1dV4dV4dV4';

    public function __construct(
        private UserRepository $users = new UserRepository(),
        private AuthTokenRepository $tokens = new AuthTokenRepository(),
        private JwtService $jwt = new JwtService(),
    ) {
    }

    public function login(string $email, string $password, string $ip): array
    {
        $email = strtolower(trim($email));
        if ($email === '' || $password === '') {
            throw new HttpException(422, 'Enter your email and password.', ['email', 'password']);
        }
        $since = gmdate('Y-m-d\TH:i:s\Z', time() - Settings::LOGIN_WINDOW_SECONDS);
        if ($this->tokens->recentFailures($email, $since) >= Settings::LOGIN_MAX_FAILURES) {
            throw new HttpException(429, 'Too many failed attempts. Try again in 15 minutes.');
        }
        $user = $this->users->findByEmail($email);
        $valid = password_verify($password, $user['password_hash'] ?? self::DUMMY_HASH);
        if (!$user || !$valid || !(int) $user['active']) {
            $this->tokens->recordFailure($email, $ip);
            throw new HttpException(401, 'That email and password don\'t match.');
        }
        $this->tokens->clearFailures($email);
        return $this->issue($user);
    }

    /** Rotates the token. Replaying a spent token means it leaked, so every session is ended. */
    public function refresh(string $token): array
    {
        $row = $token === '' ? null : $this->tokens->findByHash(hash('sha256', $token));
        if (!$row) {
            throw new HttpException(401, 'Your session has expired. Sign in again.');
        }
        if ($row['revoked_at'] !== null || !$this->tokens->revoke((int) $row['id'])) {
            $this->tokens->revokeAll((int) $row['user_id']);
            throw new HttpException(401, 'Your session has expired. Sign in again.');
        }
        $user = $this->users->find((int) $row['user_id']);
        if ($row['expires_at'] < now_iso() || !$user || !(int) $user['active']) {
            throw new HttpException(401, 'Your session has expired. Sign in again.');
        }
        return $this->issue($user);
    }

    public function logout(string $token): void
    {
        $row = $token === '' ? null : $this->tokens->findByHash(hash('sha256', $token));
        if ($row) {
            $this->tokens->revoke((int) $row['id']);
        }
    }

    public function publicUser(array $user): array
    {
        return ['id' => (int) $user['id'], 'email' => $user['email'], 'phone' => $user['phone'] ?? null, 'name' => $user['name'], 'role' => $user['role'],
            'household_id' => $user['household_id'] !== null ? (int) $user['household_id'] : null,
            'installer_id' => $user['installer_id'] !== null ? (int) $user['installer_id'] : null];
    }

    public function find(int $id): ?array
    {
        return $this->users->find($id);
    }

    /** Starts a session: a short access token and a rotating refresh token. */
    public function issue(array $user): array
    {
        $refresh = bin2hex(random_bytes(32));
        $this->tokens->store((int) $user['id'], hash('sha256', $refresh), gmdate('Y-m-d\TH:i:s\Z', time() + Settings::REFRESH_TTL_SECONDS));
        return ['access_token' => $this->jwt->issueAccess($user), 'refresh_token' => $refresh,
            'expires_in' => Settings::ACCESS_TTL_SECONDS, 'user' => $this->publicUser($user)];
    }
}
