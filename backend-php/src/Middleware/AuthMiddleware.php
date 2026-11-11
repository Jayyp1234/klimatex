<?php

namespace App\Middleware;

use App\Core\HttpException;
use App\Core\Request;
use App\Models\SiteRepository;
use App\Services\Auth\JwtService;
use Throwable;

final class AuthMiddleware
{
    /** @param string[]|null $roles null is public, [] is any signed-in user */
    public static function enforce(Request $request, ?array $roles): void
    {
        if ($roles === null) {
            return;
        }
        $token = $request->bearerToken();
        if ($token === null) {
            throw new HttpException(401, 'Sign in to continue.');
        }
        try {
            $claims = (new JwtService())->decodeAccess($token);
        } catch (Throwable) {
            throw new HttpException(401, 'Your session has expired. Sign in again.');
        }
        if ($roles !== [] && !in_array($claims['role'], $roles, true)) {
            throw new HttpException(403, 'Your account does not have access to this.');
        }
        $request->user = $claims;
    }

    /** Households see only their own home; installers see only homes they installed. */
    public static function assertCanViewHome(Request $request, int $siteId): void
    {
        $user = $request->user;
        $site = (new SiteRepository())->owners($siteId) ?? throw new HttpException(404, 'Home not found.');
        $denied = match ($user['role']) {
            'household' => (int) ($user['household_id'] ?? 0) !== (int) $site['household_id'],
            'installer' => (int) ($user['installer_id'] ?? 0) !== (int) $site['installer_id'],
            default => false,
        };
        if ($denied) {
            throw new HttpException(403, 'Your account does not have access to this home.');
        }
    }
}
