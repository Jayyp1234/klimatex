<?php

namespace Tests\Support;

use App\Services\Bank\BankApi;
use App\Services\Bank\BankError;
use App\Services\Bank\MockBank;

/** MockBank, but scriptable like the live sandbox, and it records every call that moves money. */
final class ScriptedBank implements BankApi
{
    private MockBank $inner;
    /** @var array<int, array|BankError> one outcome per interbank call; empty means success */
    public array $interbank = [];
    public array $requeryResponse = ['status' => 'pending'];
    public bool $loanFails = false;
    public bool $checkoutFails = false;
    public ?float $paidNaira = null;
    /** Answer like the live sandbox did: wallet funding has no "status", a loan repayment's "status" is the loan's. */
    public bool $liveShapes = false;
    /** Every wallet funding times out, so its outcome is unknown. */
    public bool $fundingPending = false;
    public array $interbankCalls = [];
    public array $walletFundings = [];
    public array $loanRepayments = [];
    public array $checkouts = [];
    public int $requeries = 0;
    public array $intraCalls = [];

    public function __construct()
    {
        $this->inner = new MockBank();
    }

    public function interbankTransfer(string $src, string $bankCode, string $account, string $neRef, int $kobo, string $narration, string $ref, string $idem): array
    {
        $this->interbankCalls[] = compact('src', 'bankCode', 'account', 'kobo', 'ref', 'idem', 'neRef');
        $next = array_shift($this->interbank);
        if ($next instanceof BankError) {
            throw $next;
        }
        return $next ?? ['status' => 'successful', 'reference' => $ref];
    }

    public function intraNameEnquiry(string $account): array { return $this->inner->intraNameEnquiry($account); }

    public function intraTransfer(string $src, string $account, string $neRef, int $kobo, string $narration, string $ref, string $idem): array
    {
        $this->intraCalls[] = compact('src', 'account', 'kobo', 'ref', 'idem');
        return $this->inner->intraTransfer($src, $account, $neRef, $kobo, $narration, $ref, $idem);
    }

    public function requery(string $ref): array
    {
        $this->requeries++;
        return $this->requeryResponse + ['reference' => $ref];
    }

    public function fundWallet(string $walletId, string $sourceAccount, int $kobo, string $ref, string $idem): array
    {
        $this->walletFundings[] = compact('walletId', 'sourceAccount', 'kobo', 'ref');
        if ($this->fundingPending) {
            return ['status' => 'pending', 'reference' => $ref, 'outcome' => 'unknown'];
        }
        if ($this->liveShapes) {
            return ['wallet' => $walletId, 'source_account' => $sourceAccount, 'amount' => $kobo / 100, 'reference' => $ref, 'source_balance_after' => 4900000.0];
        }
        return $this->inner->fundWallet($walletId, $sourceAccount, $kobo, $ref, $idem);
    }

    public function loanRepayment(string $loanId, string $sourceAccount, int $kobo, string $ref): array
    {
        $this->loanRepayments[] = compact('loanId', 'sourceAccount', 'kobo', 'ref');
        if ($this->loanFails) {
            throw new BankError(404, ['error' => ['code' => 'NOT_FOUND']]);
        }
        if ($this->liveShapes) {
            return ['loan_id' => $loanId, 'applied_to_instalment' => 1, 'amount_paid' => $kobo / 100, 'outstanding_balance' => 599348.51, 'status' => 'active'];
        }
        return $this->inner->loanRepayment($loanId, $sourceAccount, $kobo, $ref);
    }

    public function createCheckout(string $merchantId, int $kobo, string $ref, string $desc, string $callback, array $customer, array $metadata): array
    {
        $this->checkouts[] = compact('merchantId', 'kobo', 'customer', 'metadata');
        if ($this->checkoutFails) {
            throw new BankError(503, ['error' => ['code' => 'BANK_UNAVAILABLE']]);
        }
        return $this->inner->createCheckout($merchantId, $kobo, $ref, $desc, $callback, $customer, $metadata);
    }

    public function verifyPayment(string $ref): array
    {
        $payment = $this->inner->verifyPayment($ref);
        return $this->paidNaira === null ? $payment : ['amount_paid' => $this->paidNaira] + $payment;
    }

    public function tariff(): array { return $this->inner->tariff(); }
    public function createWallet(string $ownerName, string $phone, string $ref): string { return $this->inner->createWallet($ownerName, $phone, $ref); }
    public function nameEnquiry(string $bankCode, string $account): array { return $this->inner->nameEnquiry($bankCode, $account); }
    public function payWithTestCard(string $ref): array { return $this->inner->payWithTestCard($ref); }
    public function openLoan(string $account, string $bvn, int $kobo, string $purpose, string $ref): string { return $ref; }
    public function registerWebhook(string $url): array { return $this->inner->registerWebhook($url); }
}
