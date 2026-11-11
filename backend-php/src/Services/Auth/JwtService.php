<?php

namespace App\Services\Auth;

use App\Config\Settings;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use RuntimeException;

final class JwtService
{
    public function issueAccess(array $user): string
    {
        $now = time();
        return JWT::encode([
            'iss' => Settings::JWT_ISSUER,
            'sub' => (string) $user['id'],
            'typ' => 'access',
            'role' => $user['role'],
            'name' => $user['name'],
            'household_id' => $user['household_id'] !== null ? (int) $user['household_id'] : null,
            'installer_id' => $user['installer_id'] !== null ? (int) $user['installer_id'] : null,
            'iat' => $now,
            'exp' => $now + Settings::ACCESS_TTL_SECONDS,
        ], Settings::jwtSecret(), 'HS256');
    }

    public function decodeAccess(string $token): array
    {
        $claims = (array) JWT::decode($token, new Key(Settings::jwtSecret(), 'HS256'));
        if (($claims['typ'] ?? null) !== 'access' || ($claims['iss'] ?? null) !== Settings::JWT_ISSUER) {
            throw new RuntimeException('not an access token');
        }
        $claims['id'] = (int) $claims['sub'];
        return $claims;
    }
}
