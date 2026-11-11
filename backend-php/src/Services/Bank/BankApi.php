<?php

namespace App\Services\Bank;

/**
 * The Xtradot Bank sandbox, per the Sandbox API Mock Specification v2 (participant edition).
 * Amounts are integer kobo here and naira with two decimals on the wire.
 */
interface BankApi
{
    public function tariff(): array;
    public function createWallet(string $ownerName, string $phone, string $ref): string;
    /** Pays into a wallet from a team-owned bank account. */
    public function fundWallet(string $walletId, string $sourceAccount, int $kobo, string $ref, string $idem): array;
    public function nameEnquiry(string $bankCode, string $account): array;
    public function interbankTransfer(string $src, string $bankCode, string $account, string $neRef, int $kobo,
                                      string $narration, string $ref, string $idem): array;
    /** Xtradot to Xtradot (NIP 000014). Completes inside the call and carries no fee. */
    public function intraNameEnquiry(string $account): array;
    public function intraTransfer(string $src, string $account, string $neRef, int $kobo, string $narration, string $ref, string $idem): array;
    /** One status check by reference. Returns status "not_found" when the bank has no record. */
    public function requery(string $ref): array;
    /** @param array{name:string,email?:string,phone?:string} $customer */
    public function createCheckout(string $merchantId, int $kobo, string $ref, string $desc, string $callback, array $customer, array $metadata): array;
    public function payWithTestCard(string $ref): array;
    public function verifyPayment(string $ref): array;
    /** Applies for, accepts and disburses a loan. Throws BankError when it isn't approved. */
    public function openLoan(string $account, string $bvn, int $kobo, string $purpose, string $ref): string;
    public function loanRepayment(string $loanId, string $sourceAccount, int $kobo, string $ref): array;
    public function registerWebhook(string $url): array;
}
