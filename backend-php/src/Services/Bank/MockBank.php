<?php

namespace App\Services\Bank;

use App\Models\KvStore;

/** Offline stand-in that behaves like the sandbox spec. State lives in the kv table between requests. */
final class MockBank implements BankApi
{
    private function state(): array
    {
        return jdec(KvStore::get('mock_bank')) ?? ['wallets' => [], 'payments' => [], 'transfers' => [], 'idem' => []];
    }

    private function save(array $s): void { KvStore::set('mock_bank', jenc($s)); }

    private function once(string $idem, callable $fn): array
    {
        $s = $this->state();
        if (isset($s['idem'][$idem])) return $s['idem'][$idem] + ['replayed' => true];
        [$s, $out] = $fn($s);
        $s['idem'][$idem] = $out;
        $this->save($s);
        return $out;
    }

    /** NIP fee tiers from the spec: ₦10 / ₦25 / ₦50, plus 7.5% VAT. */
    public static function nipFeeKobo(int $kobo): int
    {
        return $kobo <= 500000 ? 1000 : ($kobo <= 5000000 ? 2500 : 5000);
    }

    public function tariff(): array { return ['schedule' => 'sandbox', 'nip' => [10, 25, 50], 'vat' => 0.075]; }

    public function createWallet(string $ownerName, string $phone, string $ref): string
    {
        $id = 'wal_' . substr(hash('sha256', $ref), 0, 10);
        $s = $this->state();
        $s['wallets'][$id] ??= 0;
        $this->save($s);
        return $id;
    }

    public function fundWallet(string $walletId, string $sourceAccount, int $kobo, string $ref, string $idem): array
    {
        return $this->once($idem, function ($s) use ($walletId, $kobo, $ref) {
            $s['wallets'][$walletId] = ($s['wallets'][$walletId] ?? 0) + $kobo;
            return [$s, ['status' => 'successful', 'reference' => $ref]];
        });
    }

    public function nameEnquiry(string $bankCode, string $account): array
    {
        $names = ['0123987005' => 'AREWA SOLAR CO-OPERATIVE SOCIETY', '0123456789' => 'ADAEZE CHIAMAKA OKONKWO'];
        if ($account === '0000000001') {
            throw new BankError(404, ['error' => ['code' => 'ACCOUNT_NOT_FOUND', 'message' => 'Account not found']]);
        }
        return ['account_name' => $names[$account] ?? 'TEST ACCOUNT', 'name_enquiry_ref' => 'NE-NIP-' . strtoupper(bin2hex(random_bytes(4)))];
    }

    public function interbankTransfer(string $src, string $bankCode, string $account, string $neRef, int $kobo,
                                      string $narration, string $ref, string $idem): array
    {
        return $this->once($idem, function ($s) use ($kobo, $ref) {
            $fee = self::nipFeeKobo($kobo);
            $vat = (int) round($fee * 0.075);
            $stamp = $kobo >= 1000000 ? 5000 : 0;
            $t = ['status' => 'successful', 'reference' => $ref, 'fee' => naira($fee), 'vat' => naira($vat),
                'stamp_duty' => naira($stamp), 'total_debit' => naira($kobo + $fee + $vat + $stamp)];
            $s['transfers'][$ref] = $t;
            return [$s, $t];
        });
    }

    public function intraNameEnquiry(string $account): array
    {
        $names = ['0987654321' => 'NGOZI ADAOBI EZE', '0987654322' => 'AISHA HAUWA BELLO', '0123456789' => 'ADAEZE CHIAMAKA OKONKWO'];
        if (!isset($names[$account])) {
            throw new BankError(404, ['error' => ['code' => 'ACCOUNT_NOT_FOUND', 'message' => 'Account not found']]);
        }
        return ['account_name' => $names[$account], 'name_enquiry_ref' => 'NE-INTRA-' . strtoupper(bin2hex(random_bytes(4)))];
    }

    public function intraTransfer(string $src, string $account, string $neRef, int $kobo, string $narration, string $ref, string $idem): array
    {
        return $this->once($idem, function ($s) use ($kobo, $ref) {
            $t = ['status' => 'successful', 'reference' => $ref, 'channel' => 'intrabank', 'fee' => 0.0, 'vat' => 0.0, 'total_debit' => naira($kobo)];
            $s['transfers'][$ref] = $t;
            return [$s, $t];
        });
    }

    public function requery(string $ref): array
    {
        return $this->state()['transfers'][$ref] ?? ['status' => 'not_found', 'reference' => $ref];
    }

    public function createCheckout(string $merchantId, int $kobo, string $ref, string $desc, string $callback, array $customer, array $metadata): array
    {
        $s = $this->state();
        $s['payments'][$ref] = ['status' => 'pending', 'amount' => naira($kobo), 'amount_paid' => 0.0, 'merchant_id' => $merchantId];
        $this->save($s);
        return ['reference' => $ref, 'status' => 'pending', 'payment_url' => "https://pay.xtradot.co/pay/mock-$ref"];
    }

    public function payWithTestCard(string $ref): array
    {
        $s = $this->state();
        $amount = $s['payments'][$ref]['amount'] ?? 0.0;
        $s['payments'][$ref]['status'] = 'successful';
        $s['payments'][$ref]['amount_paid'] = $amount;
        $s['payments'][$ref]['merchant_fee'] = min(2000.0, round($amount * 0.015, 2));
        $this->save($s);
        return ['reference' => $ref] + $s['payments'][$ref];
    }

    public function verifyPayment(string $ref): array
    {
        return ['reference' => $ref] + ($this->state()['payments'][$ref] ?? ['status' => 'not_found']);
    }

    public function openLoan(string $account, string $bvn, int $kobo, string $purpose, string $ref): string
    {
        return $ref;
    }

    public function loanRepayment(string $loanId, string $sourceAccount, int $kobo, string $ref): array
    {
        return ['status' => 'successful', 'loan_id' => $loanId, 'amount_paid' => naira($kobo)];
    }

    public function registerWebhook(string $url): array { return ['id' => 'wh_mock', 'webhook_secret' => 'mock-secret']; }
}
