<?php

namespace App\Services\Home;

use App\Config\Settings;
use App\Core\HttpException;
use App\Models\HouseholdRepository;
use App\Services\Bank\Bank;
use App\Services\Bank\BankError;

/**
 * Where a family's carbon earnings are paid: the Access wallet opened for them at registration,
 * or a bank account they add. A bank account is saved only after the bank confirms the name on it.
 */
final class PayoutDetailsService
{
    public function __construct(private HouseholdRepository $households = new HouseholdRepository())
    {
    }

    public function get(?int $householdId): array
    {
        $home = $this->home($householdId);
        $bank = $home['payout_account'] ? [
            'bank_code' => $home['payout_bank_code'],
            'bank_name' => Settings::BANKS[$home['payout_bank_code']] ?? 'Bank',
            'account_ending' => substr($home['payout_account'], -4),
            'account_name' => $home['payout_account_name'],
        ] : null;
        return [
            'method' => $home['payout_method'] === 'bank' && $bank ? 'bank' : 'wallet',
            'wallet' => $home['wallet_id'] ? ['provider' => 'Access wallet', 'phone' => $home['phone'] ? self::maskPhone($home['phone']) : null] : null,
            'bank' => $bank,
            'has_loan' => (bool) $home['loan_id'],
            'updated_at' => $home['payout_updated_at'],
            'banks' => array_map(fn ($code, $name) => ['code' => (string) $code, 'name' => $name], array_keys(Settings::BANKS), Settings::BANKS),
        ];
    }

    /** Asks the bank whose name is on an account, so the family can confirm it before saving. */
    public function check(?int $householdId, string $bankCode, string $account): array
    {
        $this->home($householdId);
        [$bankCode, $account] = self::validate($bankCode, $account);
        return ['account_name' => $this->nameOn($bankCode, $account), 'bank_name' => Settings::BANKS[$bankCode]];
    }

    public function save(?int $householdId, string $method, string $bankCode, string $account): array
    {
        $home = $this->home($householdId);
        if ($method === 'wallet') {
            if (!$home['wallet_id']) {
                throw new HttpException(409, "Your Access wallet isn't open yet. Add a bank account instead, or ask your installer.");
            }
            // The bank account stays on file so switching back doesn't mean typing it again.
            $this->households->savePayout((int) $home['id'], 'wallet', $home['payout_bank_code'], $home['payout_account'], $home['payout_account_name']);
        } elseif ($method === 'bank' && $account === '' && $home['payout_account']) {
            // Switching back to the account already on file: the screen never holds the full number.
            $this->households->savePayout((int) $home['id'], 'bank', $home['payout_bank_code'], $home['payout_account'], $home['payout_account_name']);
        } elseif ($method === 'bank') {
            [$bankCode, $account] = self::validate($bankCode, $account);
            // Checked again here: the name the screen showed is never trusted.
            $this->households->savePayout((int) $home['id'], 'bank', $bankCode, $account, $this->nameOn($bankCode, $account));
        } else {
            throw new HttpException(422, 'Choose your Access wallet or a bank account.', ['method']);
        }
        return $this->get($householdId);
    }

    private function nameOn(string $bankCode, string $account): string
    {
        try {
            $name = trim((string) (Bank::client()->nameEnquiry($bankCode, $account)['account_name'] ?? ''));
        } catch (BankError $e) {
            if (in_array($e->code(), ['ACCOUNT_NOT_FOUND', 'INVALID_ACCOUNT'], true) || $e->status === 404) {
                throw new HttpException(422, 'No account with that number at ' . Settings::BANKS[$bankCode] . '. Check the number and the bank.', ['account']);
            }
            error_log("name enquiry failed: {$e->getMessage()}");
            throw new HttpException(502, "The bank couldn't confirm that account just now. Try again in a minute.");
        }
        return $name !== '' ? $name : throw new HttpException(502, "The bank couldn't confirm that account just now. Try again in a minute.");
    }

    private static function validate(string $bankCode, string $account): array
    {
        $account = preg_replace('/\D+/', '', $account);
        if (!isset(Settings::BANKS[$bankCode])) {
            throw new HttpException(422, 'Choose your bank.', ['bank_code']);
        }
        if (strlen($account) !== 10) {
            throw new HttpException(422, 'An account number has 10 digits.', ['account']);
        }
        return [$bankCode, $account];
    }

    private function home(?int $householdId): array
    {
        return ($householdId ? $this->households->find($householdId) : null) ?? throw new HttpException(404, 'No home is linked to this account yet.');
    }

    private static function maskPhone(string $phone): string
    {
        return '0' . substr($phone, 4, 3) . ' ••• ' . substr($phone, -4);
    }
}
