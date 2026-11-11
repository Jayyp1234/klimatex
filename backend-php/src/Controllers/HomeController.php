<?php

namespace App\Controllers;

use App\Core\Request;
use App\Middleware\AuthMiddleware;
use App\Services\Home\HomeService;
use App\Services\Home\PayoutDetailsService;

final class HomeController
{
    public function __construct(private HomeService $homes = new HomeService(), private PayoutDetailsService $payoutDetails = new PayoutDetailsService())
    {
    }

    public function payoutDetails(Request $request): array
    {
        return $this->payoutDetails->get($request->user['household_id'] ?? null);
    }

    public function checkPayoutAccount(Request $request): array
    {
        return $this->payoutDetails->check($request->user['household_id'] ?? null, (string) $request->input('bank_code', ''), (string) $request->input('account', ''));
    }

    public function savePayoutDetails(Request $request): array
    {
        return $this->payoutDetails->save($request->user['household_id'] ?? null, (string) $request->input('method', ''),
            (string) $request->input('bank_code', ''), (string) $request->input('account', ''));
    }

    public function index(Request $request): array
    {
        return ['homes' => $this->homes->list($request->user['role'] === 'installer' ? $request->user['installer_id'] : null)];
    }

    public function show(Request $request, string $id): array
    {
        AuthMiddleware::assertCanViewHome($request, (int) $id);
        return $this->homes->detail((int) $id);
    }

    public function certificate(Request $request, string $id): array
    {
        AuthMiddleware::assertCanViewHome($request, (int) $id);
        return $this->homes->certificate((int) $id);
    }

    public function mine(Request $request): array
    {
        return $this->homes->mine($request->user['household_id'] ?? null);
    }

    public function payouts(Request $request, string $id): array
    {
        AuthMiddleware::assertCanViewHome($request, (int) $id);
        return $this->homes->payouts((int) $id);
    }

    public function alerts(Request $request, string $id): array
    {
        AuthMiddleware::assertCanViewHome($request, (int) $id);
        return $this->homes->alerts((int) $id);
    }

    public function message(Request $request, string $id): array
    {
        AuthMiddleware::assertCanViewHome($request, (int) $id);
        return $this->homes->message((int) $id, (string) $request->query('lang', 'en'));
    }
}
