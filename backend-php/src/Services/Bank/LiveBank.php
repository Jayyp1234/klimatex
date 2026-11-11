<?php

namespace App\Services\Bank;

use App\Config\Settings;

/** Request bodies follow the Sandbox API Mock Specification v2; section 5.8 of the platform guide overrides it. */
final class LiveBank implements BankApi
{
    private const MAX_RETRY_AFTER_SECONDS = 20;

    public function req(string $method, string $path, ?array $json = null, ?string $idem = null): array
    {
        $headers = ['x-api-key' => Settings::gatewayKey()];
        if ($idem) $headers['Idempotency-Key'] = $idem;
        for ($attempt = 0; $attempt < 3; $attempt++) {
            [$status, $body, $responseHeaders] = Http::call($method, Settings::bankBase() . $path, $json, $headers);
            if ($status !== 429) break;
            // Shared 60-a-minute team limit: wait as long as the gateway asks, within reason.
            sleep(min(self::MAX_RETRY_AFTER_SECONDS, max(1, (int) ($responseHeaders['retry-after'] ?? 2 * ($attempt + 1)))));
        }
        if ($status >= 400) {
            $error = new BankError($status, $body);
            error_log("bank $method $path -> $status " . ($error->code() ?? '') . ' request_id=' . ($error->requestId() ?? '-'));
            throw $error;
        }
        return $body['data'] ?? $body;
    }

    public function tariff(): array { return $this->req('GET', '/tariff'); }

    public function createWallet(string $ownerName, string $phone, string $ref): string
    {
        $d = $this->req('POST', '/wallets', ['owner_name' => $ownerName, 'phone' => $phone, 'reference' => $ref], $ref);
        return $d['wallet_id'];
    }

    // TODO(spec): the spec names this call ("fund a wallet from a team account") but shows no body.
    public function fundWallet(string $walletId, string $sourceAccount, int $kobo, string $ref, string $idem): array
    {
        try {
            return $this->req('POST', "/wallets/$walletId/fund", ['source_account' => $sourceAccount, 'amount' => naira($kobo),
                'currency' => 'NGN', 'narration' => 'KlimateX carbon payout', 'reference' => $ref], $idem);
        } catch (BankError $e) {
            if ($e->outcomeUnknown()) return ['status' => 'pending', 'reference' => $ref, 'outcome' => 'unknown'];
            throw $e;
        }
    }

    public function nameEnquiry(string $bankCode, string $account): array
    {
        return $this->req('POST', '/transfers/interbank/name-enquiry',
            ['destination_bank_code' => $bankCode, 'account_number' => $account]);
    }

    /** Returns 202 pending; transfer.successful follows about 5 seconds later. */
    public function interbankTransfer(string $src, string $bankCode, string $account, string $neRef, int $kobo,
                                      string $narration, string $ref, string $idem): array
    {
        $body = ['source_account' => $src, 'destination_bank_code' => $bankCode, 'destination_account' => $account,
            'name_enquiry_ref' => $neRef, 'amount' => naira($kobo), 'currency' => 'NGN', 'narration' => $narration, 'reference' => $ref];
        try {
            return $this->req('POST', '/transfers/interbank', $body, $idem);
        } catch (BankError $e) {
            if ($e->outcomeUnknown()) return ['status' => 'pending', 'reference' => $ref, 'outcome' => 'unknown'];
            throw $e;
        }
    }

    public function intraNameEnquiry(string $account): array
    {
        return $this->req('POST', '/transfers/intra/name-enquiry', ['account_number' => $account]);
    }

    public function intraTransfer(string $src, string $account, string $neRef, int $kobo, string $narration, string $ref, string $idem): array
    {
        $body = ['source_account' => $src, 'destination_account' => $account, 'name_enquiry_ref' => $neRef,
            'amount' => naira($kobo), 'currency' => 'NGN', 'narration' => $narration, 'reference' => $ref];
        try {
            return $this->req('POST', '/transfers/intra', $body, $idem);
        } catch (BankError $e) {
            if ($e->outcomeUnknown()) return ['status' => 'pending', 'reference' => $ref, 'outcome' => 'unknown'];
            throw $e;
        }
    }

    public function requery(string $ref): array
    {
        try {
            return $this->req('GET', "/transfers/$ref");
        } catch (BankError $e) {
            if ($e->status === 404) return ['status' => 'not_found', 'reference' => $ref];
            throw $e;
        }
    }

    public function createCheckout(string $merchantId, int $kobo, string $ref, string $desc, string $callback, array $customer, array $metadata): array
    {
        return $this->req('POST', '/payments/checkout', ['merchant_id' => $merchantId, 'amount' => naira($kobo), 'currency' => 'NGN',
            'customer' => $customer, 'channels' => ['card', 'bank_transfer', 'ussd', 'qr'], 'description' => $desc,
            'reference' => $ref, 'callback_url' => $callback, 'metadata' => $metadata], $ref);
    }

    /** Sandbox only, for an unattended demo run: the spec's successful test card, then its OTP. */
    public function payWithTestCard(string $ref): array
    {
        $this->req('POST', "/payments/$ref/card", ['card' => ['number' => '5399830000000008', 'expiry_month' => '12',
            'expiry_year' => '2030', 'cvv' => '123', 'pin' => '1234']], "card-$ref");
        return $this->req('POST', "/payments/$ref/otp", ['otp' => '123456'], "otp-$ref");
    }

    public function verifyPayment(string $ref): array { return $this->req('GET', "/payments/$ref/verify"); }

    public function openLoan(string $account, string $bvn, int $kobo, string $purpose, string $ref): string
    {
        $d = $this->req('POST', '/loans/applications', ['applicant_account' => $account, 'bvn' => $bvn, 'amount' => naira($kobo),
            'tenor_months' => 12, 'purpose' => $purpose], $ref);
        if (!in_array($d['decision'] ?? '', ['approved', 'approved_reduced'], true)) {
            throw new BankError(422, ['code' => 'LOAN_NOT_APPROVED', 'decision' => $d['decision'] ?? null]);
        }
        $loanId = $d['loan_id'];
        $this->req('POST', "/loans/$loanId/accept", [], "$ref-accept");
        $this->req('POST', "/loans/$loanId/disburse", [], "$ref-disburse");
        return $loanId;
    }

    public function loanRepayment(string $loanId, string $sourceAccount, int $kobo, string $ref): array
    {
        return $this->req('POST', "/loans/$loanId/repayments", ['source_account' => $sourceAccount, 'amount' => naira($kobo), 'reference' => $ref], $ref);
    }

    public function registerWebhook(string $url): array
    {
        return $this->req('POST', '/webhooks', ['url' => $url, 'events' => ['*']]);
    }
}
