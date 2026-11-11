<?php

namespace Tests\Integration;

use App\Config\Database;
use App\Config\Settings;
use App\Core\HttpException;
use App\Models\CreditRepository;
use App\Services\Bank\Bank;
use App\Services\Market\MarketService;
use App\Services\Period\PeriodService;
use App\Services\Simulator\Simulator;
use Tests\Support\ApiTestCase;
use Tests\Support\ScriptedBank;

final class MarketSafetyTest extends ApiTestCase
{
    public function testTheSameMonthsCannotBeCreditedTwice(): void
    {
        $this->signedPeriod();
        $this->assertSame(409, $this->call('POST', '/api/periods', ['start' => '2026-03-01', 'end' => '2026-08-31'], 'auditor')->status);
        $this->assertSame(200, $this->call('POST', '/api/periods', ['start' => '2026-07-01', 'end' => '2026-12-31'], 'auditor')->status);
        $this->assertSame(8, (new CreditRepository())->countAll());
    }

    public function testBadPeriodDatesAreRejected(): void
    {
        Simulator::seed();
        foreach ([['not-a-date', '2026-01-31'], ['2026-02-31', '2026-03-01'], ['2026-06-01', '2026-01-01']] as [$start, $end]) {
            $this->assertSame(422, $this->call('POST', '/api/periods', compact('start', 'end'), 'auditor')->status);
        }
    }

    public function testReviewIsValidatedAndClosedAfterSignOff(): void
    {
        Simulator::seed();
        $periods = new PeriodService();
        $id = $periods->create(Simulator::START, Simulator::END);
        $periods->compute($id);
        $sample = $periods->sample($id, 42)['sample'];
        $notSampled = current(array_diff(range(1, 20), $sample, [17]));
        $this->assertSame(422, $this->call('POST', "/api/periods/$id/sites/{$sample[0]}/review", ['decision' => 'banana'], 'auditor')->status);
        $this->assertSame(422, $this->call('POST', "/api/periods/$id/sites/{$sample[0]}/review", [], 'auditor')->status);
        $this->assertSame(409, $this->call('POST', "/api/periods/$id/sites/$notSampled/review", ['decision' => 'ok'], 'auditor')->status);
        foreach ($sample as $site) {
            $this->assertSame(200, $this->call('POST', "/api/periods/$id/sites/$site/review", ['decision' => 'ok'], 'auditor')->status);
        }
        $this->call('POST', "/api/periods/$id/signoff", null, 'auditor');
        $this->assertSame(409, $this->call('POST', "/api/periods/$id/sites/{$sample[0]}/review", ['decision' => 'exclude'], 'auditor')->status);
    }

    public function testConcurrentBuyersCannotGetTheSameCredits(): void
    {
        $this->signedPeriod();
        $start = microtime(true) + 1.0;
        $handles = [];
        foreach (range(1, 6) as $n) {
            $pipes = [];
            $worker = dirname(__DIR__) . '/Support/reserve_worker.php';
            $handles[] = [proc_open([PHP_BINARY, $worker, (string) $start, "Buyer$n", '6'], [1 => ['pipe', 'w']], $pipes), $pipes[1]];
        }
        $outcomes = [];
        foreach ($handles as [$process, $stdout]) {
            $outcomes[] = trim(stream_get_contents($stdout));
            fclose($stdout);
            proc_close($process);
        }
        $won = array_values(array_filter($outcomes, fn ($o) => str_starts_with($o, 'reserved:')));
        $this->assertCount(1, $won, implode(', ', $outcomes));
        $this->assertCount(5, array_filter($outcomes, fn ($o) => $o === 'refused:409'), implode(', ', $outcomes));

        $orderId = (int) substr($won[0], 9);
        $this->assertCount(6, (new CreditRepository())->serialsForOrder($orderId));
        $this->assertCount(6, (new CreditRepository())->serialsByStatus('reserved'));
    }

    public function testAFailedCheckoutReleasesTheCredits(): void
    {
        $this->signedPeriod();
        $bank = new ScriptedBank();
        $bank->checkoutFails = true;
        Bank::swap($bank);
        try {
            (new MarketService())->createOrder('Buyer', 5);
            $this->fail('expected the bank error to surface');
        } catch (\App\Services\Bank\BankError) {
            $this->assertCount(8, (new CreditRepository())->serialsByStatus('listed'));
        }
    }

    public function testPayingAfterExpiryFlagsARefundInsteadOfLosingTheMoney(): void
    {
        $this->signedPeriod();
        $market = new MarketService();
        $id = $this->paidOrder(3);
        Database::update('orders', $id, ['expires_at' => '2020-01-01T00:00:00Z']);
        $market->releaseExpired();
        try {
            $market->confirm($id);
            $this->fail('a late payment must not retire credits');
        } catch (HttpException $e) {
            $this->assertSame(409, $e->status);
        }
        $this->assertSame('refund_due', $market->order($id)['status']);
        $this->assertCount(8, (new CreditRepository())->serialsByStatus('listed'));
    }

    public function testACreditCanNeverBeSoldTwice(): void
    {
        $this->signedPeriod();
        $market = new MarketService();
        $first = $this->paidOrder(8);
        $market->confirm($first);
        $this->expectException(HttpException::class);
        $market->createOrder('Second Buyer', 1);
    }

    public function testSpendingAboveTheLimitIsRefused(): void
    {
        $this->signedPeriod();
        $this->assertSame(422, $this->call('POST', '/api/orders', ['tonnes' => 0], 'buyer')->status);
        $this->assertSame(422, $this->call('POST', '/api/orders', ['tonnes' => Settings::MAX_ORDER_TONNES + 1], 'buyer')->status);
    }
}
