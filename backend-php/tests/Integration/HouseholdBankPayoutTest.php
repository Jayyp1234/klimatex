<?php

namespace Tests\Integration;

use App\Config\Database;
use App\Services\Bank\Bank;
use App\Services\Market\MarketService;
use Tests\Support\ApiTestCase;
use Tests\Support\ScriptedBank;

/** Families can choose a bank account for payouts; the loan rule and the never-resend rule still hold. */
final class HouseholdBankPayoutTest extends ApiTestCase
{
    private ScriptedBank $bank;

    protected function setUp(): void
    {
        parent::setUp();
        $this->bank = new ScriptedBank();
        Bank::swap($this->bank);
        $this->signedPeriod();
    }

    private function chooseBank(int $siteId, string $bankCode, string $account): void
    {
        Database::run("UPDATE households SET payout_method = 'bank', payout_bank_code = ?, payout_account = ?, payout_account_name = 'TEST'
            WHERE id = (SELECT household_id FROM sites WHERE id = ?)", [$bankCode, $account, $siteId]);
    }

    private function walletOf(int $siteId): string
    {
        return (string) Database::val('SELECT h.wallet_id FROM sites s JOIN households h ON h.id = s.household_id WHERE s.id = ?', [$siteId]);
    }

    private function payoutFor(int $order, int $siteId): array
    {
        return Database::one('SELECT * FROM payouts WHERE order_id = ? AND site_id = ?', [$order, $siteId]);
    }

    public function testAnotherBanksAccountIsPaidByNipInsteadOfTheWallet(): void
    {
        $this->chooseBank(3, '000013', '0123987001');
        $order = $this->paidOrder();
        $this->assertSame('settled', (new MarketService())->confirm($order)['status']);

        $toHome = array_values(array_filter($this->bank->interbankCalls, fn ($c) => $c['account'] === '0123987001'));
        $this->assertCount(1, $toHome);
        $this->assertSame('0123456790', $toHome[0]['src']);
        $this->assertSame((int) $this->payoutFor($order, 3)['amount_kobo'], $toHome[0]['kobo']);
        $this->assertSame([], array_filter($this->bank->walletFundings, fn ($f) => $f['walletId'] === $this->walletOf(3)));
        $this->assertStringContainsString('bank account ···7001', $this->payoutFor($order, 3)['recipient']);
    }

    public function testAnXtradotAccountUsesTheIntrabankEndpoints(): void
    {
        $this->chooseBank(3, '000014', '0987654321');
        $order = $this->paidOrder();
        (new MarketService())->confirm($order);
        $this->assertCount(1, array_filter($this->bank->intraCalls, fn ($c) => $c['account'] === '0987654321'));
        $this->assertSame([], array_filter($this->bank->interbankCalls, fn ($c) => $c['account'] === '0987654321'));
        $this->assertSame('paid', $this->payoutFor($order, 3)['status']);
    }

    public function testALoanStillComesFirst(): void
    {
        $this->chooseBank(12, '000013', '0123987001');
        (new MarketService())->confirm($this->paidOrder());
        $this->assertCount(1, $this->bank->loanRepayments);
        $this->assertSame([], array_filter($this->bank->interbankCalls, fn ($c) => $c['account'] === '0123987001'));
    }

    public function testAPendingBankPayoutIsRequeriedNeverResent(): void
    {
        $this->chooseBank(3, '000013', '0123987001');
        $this->bank->interbank = [['status' => 'pending']]; // site 3 is the first interbank call
        $order = $this->paidOrder();
        $market = new MarketService();
        $market->confirm($order);
        $this->assertSame('pending', $this->payoutFor($order, 3)['status']);

        $this->chooseBank(3, '000013', '0123987002'); // changing the choice mid-flight must not redirect the money
        $market->confirm($order);
        $toHome = array_filter($this->bank->interbankCalls, fn ($c) => in_array($c['account'], ['0123987001', '0123987002'], true));
        $this->assertCount(1, $toHome, 'never sent twice');
        $this->assertSame(1, $this->bank->requeries);
    }
}
