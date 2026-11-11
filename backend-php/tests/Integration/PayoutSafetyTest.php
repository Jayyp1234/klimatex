<?php

namespace Tests\Integration;

use App\Config\Database;
use App\Models\PayoutRepository;
use App\Services\Bank\Bank;
use App\Services\Bank\BankError;
use App\Services\Market\MarketService;
use App\Services\Webhook\WebhookService;
use Tests\Support\ApiTestCase;
use Tests\Support\ScriptedBank;

final class PayoutSafetyTest extends ApiTestCase
{
    private ScriptedBank $bank;
    private MarketService $market;

    protected function setUp(): void
    {
        parent::setUp();
        $this->bank = new ScriptedBank();
        Bank::swap($this->bank);
        $this->market = new MarketService();
        $this->signedPeriod();
    }

    private function installerPayout(int $order): array
    {
        return current(array_filter((new PayoutRepository())->forOrder($order), fn ($p) => $p['role'] === 'installer'));
    }

    public function testAPendingTransferIsRequeriedAndNeverResent(): void
    {
        $this->bank->interbank = [['status' => 'pending']];
        $order = $this->paidOrder();
        $this->assertSame('retired', $this->market->confirm($order)['status']);
        $this->assertCount(1, $this->bank->interbankCalls);

        $this->market->confirm($order);
        $this->assertCount(1, $this->bank->interbankCalls, 'still pending: must not send again');
        $this->assertSame(1, $this->bank->requeries);

        $this->bank->requeryResponse = ['status' => 'successful'];
        $this->assertSame('settled', $this->market->confirm($order)['status']);
        $this->assertCount(1, $this->bank->interbankCalls);
    }

    public function testATimeoutCountsAsUnknownNotFailed(): void
    {
        $this->bank->interbank = [new BankError(504, ['code' => 'TIMEOUT'])];
        $order = $this->paidOrder();
        $this->market->confirm($order);
        $this->assertSame('pending', $this->installerPayout($order)['status']);
    }

    public function testADefinitiveFailureRetriesWithANewKeyAndReference(): void
    {
        $this->bank->interbank = [new BankError(402, ['code' => 'INSUFFICIENT_FUNDS'])];
        $order = $this->paidOrder();
        $this->market->confirm($order);
        $this->assertSame('failed', $this->installerPayout($order)['status']);

        $this->assertSame('settled', $this->market->confirm($order)['status']);
        [$first, $second] = $this->bank->interbankCalls;
        $this->assertNotSame($first['idem'], $second['idem']);
        $this->assertNotSame($first['ref'], $second['ref']);
    }

    public function testATransferNotFoundOnRequeryCanBeRetried(): void
    {
        $this->bank->interbank = [['status' => 'pending']];
        $this->bank->requeryResponse = ['status' => 'not_found'];
        $order = $this->paidOrder();
        $this->market->confirm($order);
        $this->market->confirm($order);
        $this->assertSame('failed', $this->installerPayout($order)['status']);
    }

    public function testAFailedLoanRepaymentPaysTheSameMoneyIntoTheWalletInstead(): void
    {
        $this->bank->loanFails = true;
        $order = $this->paidOrder();
        $this->assertSame('settled', $this->market->confirm($order)['status']);
        $this->assertGreaterThan(0, (int) Database::val("SELECT COUNT(*) FROM ledger WHERE event_type = 'loan.repayment_failed'"));
        $adaeze = Database::one("SELECT * FROM payouts WHERE order_id = ? AND site_id = 12", [$order]);
        $wallet = Database::val('SELECT h.wallet_id FROM sites s JOIN households h ON h.id = s.household_id WHERE s.id = 12');
        $funded = array_values(array_filter($this->bank->walletFundings, fn ($f) => $f['walletId'] === $wallet));
        $this->assertCount(1, $funded);
        $this->assertSame((int) $adaeze['amount_kobo'], $funded[0]['kobo']);
    }

    public function testATransferWebhookFinishesTheOrder(): void
    {
        $this->bank->interbank = [['status' => 'pending']];
        $order = $this->paidOrder();
        $this->market->confirm($order);
        $reference = $this->installerPayout($order)['reference'];
        $this->assertSame(200, $this->call('POST', '/hooks/forge', ['event_id' => 'evt-t1', 'event' => 'transfer.successful', 'data' => ['reference' => $reference]])->status);
        $this->assertSame('settled', $this->market->order($order)['status']);
    }

    public function testAPaymentWebhookRetiresButLeavesPayoutsToTheWorker(): void
    {
        $order = $this->paidOrder();
        $reference = $this->market->order($order)['payment_reference'];
        $this->assertSame(200, $this->call('POST', '/hooks/forge', ['event_id' => 'evt-p1', 'event' => 'payment.successful', 'data' => ['reference' => $reference]])->status);
        $this->assertSame('retired', $this->market->order($order)['status']);
        $this->assertSame([], (new PayoutRepository())->forOrder($order));

        $this->market->sweep();
        $this->assertSame('settled', $this->market->order($order)['status']);
    }

    public function testAFailedWebhookCanBeRedelivered(): void
    {
        $order = $this->paidOrder();
        $reference = $this->market->order($order)['payment_reference'];
        Database::update('orders', $order, ['status' => 'blip']);
        $event = ['event_id' => 'evt-p2', 'event' => 'payment.successful', 'data' => ['reference' => $reference]];
        $this->assertSame(409, $this->call('POST', '/hooks/forge', $event)->status);

        Database::update('orders', $order, ['status' => 'reserved']);
        $redelivery = $this->call('POST', '/hooks/forge', $event);
        $this->assertSame(200, $redelivery->status);
        $this->assertArrayNotHasKey('duplicate', $redelivery->body['data']);
        $this->assertSame('retired', $this->market->order($order)['status']);
        $this->assertTrue($this->call('POST', '/hooks/forge', $event)->body['data']['duplicate']);
    }

    public function testWebhookSignaturesAreChecked(): void
    {
        $now = (string) time();
        $good = 'sha256=' . hash_hmac('sha256', "$now.{}", 'secret');
        WebhookService::assertSigned('{}', $now, $good, 'secret');
        $this->addToAssertionCount(1);
        foreach ([['{}', $now, 'sha256=bad', 'secret'], ['{}', '1000', $good, 'secret'], ['{}', $now, $good, '']] as $case) {
            try {
                WebhookService::assertSigned(...$case);
                $this->fail('should have been rejected');
            } catch (\App\Core\HttpException $e) {
                $this->assertSame(401, $e->status);
            }
        }
    }
}
