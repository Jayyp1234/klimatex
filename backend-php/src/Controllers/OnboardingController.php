<?php

namespace App\Controllers;

use App\Core\Request;
use App\Services\Auth\PhoneAuthService;
use App\Services\Onboarding\Catalog;
use App\Services\Onboarding\OnboardingService;

/** Family self-onboarding and the installer marketplace (docs/ONBOARDING_FLOW.md). */
final class OnboardingController
{
    public function __construct(
        private Catalog $catalog = new Catalog(),
        private OnboardingService $onboarding = new OnboardingService(),
        private PhoneAuthService $phones = new PhoneAuthService(),
    ) {
    }

    /** Public: every listed installer and package with price ranges and estimates. */
    public function installers(Request $request): array
    {
        return $this->catalog->list() + ['options' => [
            'income_bands' => array_map(fn ($b, $k) => ['key' => $k, 'label' => $b['label'], 'limit_naira' => OnboardingService::loanLimit($k)],
                OnboardingService::INCOME_BANDS, array_keys(OnboardingService::INCOME_BANDS)),
            'generator' => array_map(fn ($label, $k) => ['key' => $k, 'label' => $label], OnboardingService::GENERATOR, array_keys(OnboardingService::GENERATOR)),
            'inverter_brands' => OnboardingService::INVERTER_BRANDS,
            'estimate_existing_solar' => Catalog::estimate(1.6),
        ]];
    }

    /** Public: step 1 of sign-up. A number that already has a home is told to sign in instead. */
    public function phone(Request $request): array
    {
        return $this->phones->startSignup((string) $request->input('phone', ''));
    }

    /** Public: creates the account from a verified code (see /api/auth/phone/verify) and signs in. */
    public function account(Request $request): array
    {
        return $this->onboarding->createAccountWithCode($request->body ?? []);
    }

    public function mine(Request $request): array
    {
        return $this->onboarding->mine($request->user['household_id'] ?? null);
    }

    public function answer(Request $request): array
    {
        return $this->onboarding->answer($request->user['household_id'] ?? null, $request->body ?? []);
    }

    public function submit(Request $request): array
    {
        $installer = $request->input('installer_id');
        return $this->onboarding->submit($request->user['household_id'] ?? null, $installer !== null ? (int) $installer : null);
    }

    public function acceptQuote(Request $request): array
    {
        return $this->onboarding->acceptQuote($request->user['household_id'] ?? null);
    }

    public function profile(Request $request): array
    {
        return $this->onboarding->profile($request->user['household_id'] ?? null, $request->body ?? []);
    }

    public function change(Request $request): array
    {
        return $this->onboarding->change($request->user['household_id'] ?? null, $request->body ?? []);
    }

    public function cancel(Request $request): array
    {
        return $this->onboarding->cancel($request->user['household_id'] ?? null);
    }

    public function requests(Request $request): array
    {
        return $this->onboarding->requests($request->user);
    }

    public function act(Request $request, string $id, string $action): array
    {
        return $this->onboarding->act($request->user, (int) $id, $action, $request->body ?? []);
    }
}
