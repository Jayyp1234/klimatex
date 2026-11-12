<?php

namespace App\Services\Market;

use App\Config\Settings;
use App\Core\HttpException;
use App\Models\CreditRepository;
use App\Models\KvStore;
use App\Models\OrderRepository;
use App\Models\PayoutRepository;
use App\Models\SiteRepository;
use App\Services\Bank\Bank;
use App\Services\Bank\BankApi;
use App\Services\Bank\BankError;
use App\Services\Ledger\Ledger;
use App\Services\Telegram\TelegramService;

/**
 * Pays out a retired order. The rules that keep money safe:
 *  - pending means the outcome is unknown: requery the bank, never send again
 *  - failed means the bank definitively refused: a retry gets a new key and reference
 *  - only one worker holds a payout at a time
 */
final class PayoutService
{
    private const XTRADOT_NIP = '000014';
    private const REQUERY_GAP_SECONDS = 15;
    private const RETRY_GAP_SECONDS = 60;
    /** A household payout with an unknown outcome is replayed (same key and body), so it must be rare. */
    private const REPLAY_GAP_SECONDS = 300;

    public function __construct(
        private OrderRepository $orders = new OrderRepository(),
        private CreditRepository $credits = new CreditRepository(),
        private PayoutRepository $payouts = new PayoutRepository(),
        private SiteRepository $sites = new SiteRepository(),
    ) {
    }

    /** @param bool $force true for a person pressing confirm; false applies the worker's back-off */
    public function settle(int $orderId, bool $force): void
    {
        $order = $this->orders->find($orderId) ?? throw new HttpException(404, 'Order not found.');
        if ($order['status'] === 'settled') {
            return;
        }
        if ($order['status'] !== 'retired') {
            throw new HttpException(409, 'Credits must be retired before any payout.');
        }
        $pots = $this->pots((int) $order['amount_kobo']);
        $bank = Bank::client();
        foreach ($this->householdShares($orderId, $pots['household']) as $siteId => $kobo) {
            $this->payHousehold($orderId, (int) $siteId, $kobo, $bank, $force);
        }
        $this->payInstaller($orderId, $pots['installer'], $bank, $force);
        $this->book($orderId, 'audit', 'Audit and registry reserve', $pots['audit']);
        $this->book($orderId, 'klimatex', 'KlimateX platform fee', $pots['klimatex']);
        $this->finish($orderId);
    }

    /** Applies a transfer.* webhook, which is how an interbank payout learns its final state. */
    public function applyTransferEvent(string $reference, string $event): void
    {
        $payout = $this->payouts->findByReference($reference);
        $status = ['transfer.successful' => 'paid', 'transfer.failed' => 'failed', 'transfer.reversed' => 'reversed'][$event] ?? null;
        if (!$payout || !$status || $payout['status'] === $status) {
            return;
        }
        $this->payouts->update((int) $payout['id'], ['status' => $status]);
        Ledger::append('payout', ['order' => (int) $payout['order_id'], 'role' => $payout['role'], 'amount_kobo' => (int) $payout['amount_kobo'], 'status' => $status, 'ref' => $reference]);
        if ($status === 'paid' && $payout['role'] === 'household' && $payout['site_id']) {
            TelegramService::notifyPayout((int) $payout['site_id'], (int) $payout['amount_kobo'], 'bank');
        }
        if ($status === 'reversed') {
            $this->orders->transition((int) $payout['order_id'], 'settled', 'retired');
        }
        $this->finish((int) $payout['order_id']);
    }

    private function pots(int $amount): array
    {
        $pots = [];
        foreach (Settings::SPLIT as $role => $basisPoints) {
            $share = intdiv($amount * $basisPoints, 10000);
            $pots[$role] = $share - $share % 100; // whole naira: the sandbox forces failures on kobo endings .01 to .05
        }
        $pots['klimatex'] = $amount - array_sum($pots); // the remainder goes to KlimateX, never lost
        return $pots;
    }

    /** The household pot, split by the tonnes each site contributed to these exact serials. */
    private function householdShares(int $orderId, int $pot): array
    {
        $bySite = [];
        foreach ($this->credits->contributionsForOrder($orderId) as $credit) {
            foreach (jdec($credit['contributions']) as $part) {
                $bySite[$part['site_id']] = ($bySite[$part['site_id']] ?? 0) + $part['t'];
            }
        }
        if (!$bySite) {
            return [];
        }
        ksort($bySite);
        // Whole naira for every family (largest remainder), so no amount ends in the sandbox's trigger kobo.
        $naira = intdiv($pot, 100);
        $total = array_sum($bySite) ?: 1;
        $shares = [];
        $remainders = [];
        foreach ($bySite as $site => $tonnes) {
            $exact = $naira * $tonnes / $total;
            $shares[$site] = (int) floor($exact);
            $remainders[$site] = $exact - $shares[$site];
        }
        arsort($remainders);
        foreach (array_slice(array_keys($remainders), 0, $naira - array_sum($shares)) as $site) {
            $shares[$site]++;
        }
        return array_map(fn ($n) => $n * 100, $shares);
    }

    private function payHousehold(int $orderId, int $siteId, int $kobo, BankApi $bank, bool $force): void
    {
        $home = $this->sites->householdFor($siteId);
        $payout = $this->payouts->ensure(['order_id' => $orderId, 'role' => 'household', 'recipient' => $home['name'], 'site_id' => $siteId, 'amount_kobo' => $kobo,
            'idempotency_key' => self::key('payout', $orderId, 'household', $siteId), 'reference' => sprintf('KXP-%d-H%03d', $orderId, $siteId), 'status' => 'pending']);
        if (!$this->due($payout, $force) || !$this->payouts->claim((int) $payout['id'])) {
            return;
        }
        $previous = $payout['status'];
        // A loan always comes first. Otherwise a family that chose a bank account is paid there, the way installers are.
        if (!$home['loan_id'] && self::channelFor($payout, $home) === 'bank') {
            $label = "{$home['name']} (bank account ···" . substr((string) $home['payout_account'], -4) . ')';
            [$status, $response, $payout] = $this->sendToAccount($payout, (string) $home['payout_bank_code'], (string) $home['payout_account'],
                $kobo, "KlimateX carbon payout, order $orderId", $bank);
            $this->saveResult($payout, $previous, $status, $response, ['site' => $siteId, 'recipient' => $label]);
            if ($status === 'paid' && $previous !== 'paid') {
                TelegramService::notifyPayout($siteId, $kobo, 'bank');
            }
            return;
        }
        $payout = $this->prepareAttempt($payout);
        $this->payouts->update((int) $payout['id'], ['sent_at' => now_iso()]);
        $fields = [];
        try {
            // Paid from the operating account: straight off the solar loan when there is one, otherwise into the wallet.
            [$response, $fields] = $home['loan_id']
                ? $this->repayLoan($bank, $home, $kobo, $payout, $siteId)
                : [$bank->fundWallet($home['wallet_id'], Settings::OPERATING_ACCOUNT, $kobo, $payout['reference'], self::bankKey($payout)), []];
            $status = self::fundingOutcome($response);
        } catch (BankError $e) {
            [$status, $response] = [$e->outcomeUnknown() ? 'pending' : 'failed', ['error' => $e->getMessage()]];
        }
        $this->saveResult($payout, $previous, $status, $response, $fields + ['site' => $siteId]);
        if ($status === 'paid' && $previous !== 'paid') {
            TelegramService::notifyPayout($siteId, $kobo, isset($fields['recipient']) ? 'loan' : 'wallet');
        }
    }

    /** The family has already been paid into its wallet, so a failed loan repayment doesn't fail the payout. */
    /** One payment, never two: if the bank refuses the loan repayment, the same money goes to the wallet instead. */
    private function repayLoan(BankApi $bank, array $home, int $kobo, array $payout, int $siteId): array
    {
        try {
            $repayment = $bank->loanRepayment($home['loan_id'], Settings::OPERATING_ACCOUNT, $kobo, "{$payout['reference']}-LN");
            // A 2xx repayment means the money moved. Its "status" is the loan's (e.g. "active"), not the payment's.
            return [['status' => 'successful', 'loan_status' => $repayment['status'] ?? null] + $repayment,
                ['recipient' => "{$home['name']} (solar loan {$home['loan_id']})"]];
        } catch (BankError $e) {
            if ($e->outcomeUnknown()) {
                throw $e; // stays pending; a retry replays the same key and body safely
            }
            Ledger::append('loan.repayment_failed', ['loan' => $home['loan_id'], 'site' => $siteId, 'amount_kobo' => $kobo, 'ref' => $payout['reference']]);
            $wallet = $bank->fundWallet($home['wallet_id'], Settings::OPERATING_ACCOUNT, $kobo, $payout['reference'], self::bankKey($payout));
            return [$wallet + ['loan_repayment_error' => $e->getMessage()], []];
        }
    }

    private function payInstaller(int $orderId, int $kobo, BankApi $bank, bool $force): void
    {
        $installer = $this->sites->firstInstaller();
        $payout = $this->payouts->ensure(['order_id' => $orderId, 'role' => 'installer', 'recipient' => $installer['name'], 'site_id' => null, 'amount_kobo' => $kobo,
            'idempotency_key' => self::key('payout', $orderId, 'installer', $installer['id']), 'reference' => "KXP-$orderId-INST", 'status' => 'pending']);
        if (!$this->due($payout, $force) || !$this->payouts->claim((int) $payout['id'])) {
            return;
        }
        $previous = $payout['status'];
        [$status, $response, $payout] = $this->sendToAccount($payout, $installer['bank_code'], $installer['account_number'],
            $kobo, "KlimateX installer share, order $orderId", $bank);
        $this->saveResult($payout, $previous, $status, $response, []);
    }

    /**
     * Pays a bank account from the operating account: name enquiry, then the transfer quoting it.
     * Xtradot accounts (NIP 000014) must use the intrabank endpoints. A payout already sent with an unknown
     * outcome is requeried, never sent again.
     * @return array{0:string,1:array,2:array} status, bank response, the (possibly re-referenced) payout row
     */
    private function sendToAccount(array $payout, string $bankCode, string $account, int $kobo, string $narration, BankApi $bank): array
    {
        try {
            if ($payout['status'] === 'pending' && $payout['sent_at'] !== null) {
                $response = $bank->requery($payout['reference']);
                $this->payouts->update((int) $payout['id'], ['sent_at' => now_iso()]);
                $status = ($response['status'] ?? '') === 'not_found' ? 'failed' : Bank::outcome($response);
                return [$status, ['channel' => 'bank'] + $response, $payout];
            }
            $payout = $this->prepareAttempt($payout);
            $this->payouts->update((int) $payout['id'], ['sent_at' => now_iso()]);
            if ($bankCode === self::XTRADOT_NIP) {
                $enquiry = $bank->intraNameEnquiry($account);
                $response = $bank->intraTransfer(Settings::OPERATING_ACCOUNT, $account, $enquiry['name_enquiry_ref'] ?? '', $kobo,
                    $narration, $payout['reference'], self::bankKey($payout));
            } else {
                $enquiry = $bank->nameEnquiry($bankCode, $account);
                $response = $bank->interbankTransfer(Settings::OPERATING_ACCOUNT, $bankCode, $account, $enquiry['name_enquiry_ref'] ?? '', $kobo,
                    $narration, $payout['reference'], self::bankKey($payout));
            }
            return [Bank::outcome($response), ['channel' => 'bank', 'resolved_name' => $enquiry['account_name'] ?? null] + $response, $payout];
        } catch (BankError $e) {
            return [$e->outcomeUnknown() ? 'pending' : 'failed', ['channel' => 'bank', 'error' => $e->getMessage()], $payout];
        }
    }

    /** A payout already in flight keeps the channel it was sent on, even if the family changes its choice meanwhile. */
    private static function channelFor(array $payout, array $home): string
    {
        if ($payout['status'] === 'pending' && $payout['sent_at'] !== null) {
            return (jdec($payout['bank_response'])['channel'] ?? null) === 'bank' ? 'bank' : 'wallet';
        }
        return ($home['payout_method'] ?? 'wallet') === 'bank' && !empty($home['payout_account']) && !empty($home['payout_bank_code']) ? 'bank' : 'wallet';
    }

    /** Audit and platform shares stay in KlimateX accounts, so they're booked rather than sent. */
    private function book(int $orderId, string $role, string $label, int $kobo): void
    {
        $created = $this->payouts->findByKey(self::key('payout', $orderId, $role)) === null;
        if ($created) {
            $this->payouts->ensure(['order_id' => $orderId, 'role' => $role, 'recipient' => $label, 'site_id' => null, 'amount_kobo' => $kobo,
                'idempotency_key' => self::key('payout', $orderId, $role), 'reference' => "KXP-$orderId-" . strtoupper($role),
                'status' => 'paid', 'bank_response' => jenc(['note' => 'held in KlimateX accounts'])]);
            Ledger::append('payout', ['order' => $orderId, 'role' => $role, 'amount_kobo' => $kobo, 'status' => 'paid']);
        }
    }

    private function finish(int $orderId): void
    {
        if ($this->payouts->openCount($orderId) === 0) {
            $this->orders->transition($orderId, 'retired', 'settled');
        }
        $order = $this->orders->find($orderId);
        if ($order['split_at'] === null) {
            $this->orders->update($orderId, ['split_at' => now_iso()]);
            Ledger::append('order.split', ['order' => $orderId, 'pots_kobo' => $this->pots((int) $order['amount_kobo']),
                'households' => $this->payouts->householdCount($orderId), 'status' => $order['status']]);
        }
    }

    private function due(array $payout, bool $force): bool
    {
        if ($payout['status'] === 'paid' || $payout['status'] === 'reversed') {
            return false;
        }
        if ($payout['status'] === 'failed' && (int) $payout['attempts'] >= Settings::MAX_PAYOUT_ATTEMPTS) {
            return false;
        }
        if ($force || $payout['sent_at'] === null) {
            return true;
        }
        $gap = match (true) {
            $payout['status'] === 'failed' => self::RETRY_GAP_SECONDS,
            $payout['role'] === 'household' => self::REPLAY_GAP_SECONDS,
            default => self::REQUERY_GAP_SECONDS, // installer: a cheap status lookup, never a resend
        };
        return $payout['sent_at'] < gmdate('Y-m-d\TH:i:s\Z', time() - $gap);
    }

    /** After a definitive failure the bank would reject or replay the old key, so a retry needs new ones. */
    private function prepareAttempt(array $payout): array
    {
        if ($payout['status'] !== 'failed') {
            return $payout;
        }
        $attempts = (int) $payout['attempts'] + 1;
        $reference = preg_replace('/-R\d+$/', '', $payout['reference']) . "-R$attempts";
        $this->payouts->update((int) $payout['id'], ['attempts' => $attempts, 'reference' => $reference]);
        return ['attempts' => $attempts, 'reference' => $reference] + $payout;
    }

    private function saveResult(array $payout, string $previous, string $status, array $response, array $extra): void
    {
        $row = ['status' => $status, 'bank_response' => jenc($response), 'claimed_at' => null];
        if (isset($extra['recipient'])) {
            $row['recipient'] = $extra['recipient'];
        }
        $this->payouts->update((int) $payout['id'], $row);
        if ($status !== $previous) {
            Ledger::append('payout', ['order' => (int) $payout['order_id'], 'role' => $payout['role']] + (isset($extra['site']) ? ['site' => $extra['site']] : [])
                + ['amount_kobo' => (int) $payout['amount_kobo'], 'status' => $status, 'ref' => $payout['reference']]);
        }
    }

    /**
     * The live sandbox answers a wallet funding with 200 and the new balances but no "status", so a 2xx
     * without a status means the money moved. An explicit status (e.g. pending after a timeout) still wins.
     */
    private static function fundingOutcome(array $response): string
    {
        return array_key_exists('status', $response) ? Bank::outcome($response) : 'paid';
    }

    private static function key(...$parts): string
    {
        return substr(hash('sha256', implode('/', $parts)), 0, 32);
    }

    private static function bankKey(array $payout): string
    {
        return (int) $payout['attempts'] === 0 ? $payout['idempotency_key'] : self::key($payout['idempotency_key'], $payout['attempts']);
    }
}
