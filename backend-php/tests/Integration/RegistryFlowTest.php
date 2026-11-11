<?php

namespace Tests\Integration;

use App\Config\Database;
use App\Models\CreditRepository;
use App\Services\Bank\Bank;
use App\Services\Market\MarketService;
use App\Services\Period\PeriodService;
use App\Services\Simulator\Simulator;
use Tests\Support\ApiTestCase;
use Tests\Support\ScriptedBank;

/** Option 1: buyers pay the registry, the registry issues and retires, KlimateX pays the split. */
final class RegistryFlowTest extends ApiTestCase
{
    private ScriptedBank $bank;

    protected function setUp(): void
    {
        parent::setUp();
        $this->bank = new ScriptedBank();
        Bank::swap($this->bank);
    }

    public function testNoMoreCreditsAreListedThanTheRegistryIssued(): void
    {
        $id = $this->signedPeriod();
        $period = (new PeriodService())->get($id);
        $this->assertSame(8, (int) $period['registry_credits'], '15,976 kWh x 0.53 t/MWh = 8.47 t');
        $this->assertSame(8, (new CreditRepository())->countAll());
        $this->assertGreaterThan(18, (float) $period['total_t'], 'our methodology estimate is kept alongside');
        $this->assertStringStartsWith('NG-KLX-2026-000001 to', $period['registry_serial_range']);
    }

    public function testBuyersPayTheRegistryMerchantAndOnlyAFullPaymentCounts(): void
    {
        $this->signedPeriod();
        $order = $this->paidOrder(2);
        $checkout = $this->bank->checkouts[0];
        $this->assertSame('mer_900', $checkout['merchantId']);
        $this->assertSame('Mama Nkechi Provisions Ltd', $checkout['customer']['name']);
        $this->assertSame('buyer@demo.klimatex.test', $checkout['customer']['email']);

        $this->bank->paidNaira = 29999.99;
        $this->assertSame('waiting', (new MarketService())->confirm($order)['action'], 'a partial payment must not retire anything');
        $this->bank->paidNaira = null;
        $this->assertSame('settled', (new MarketService())->confirm($order)['status']);
    }

    public function testRetirementRecordsTheRegistryCertificateAndOwnerPayout(): void
    {
        $this->signedPeriod();
        $order = $this->paidOrder(4);
        (new MarketService())->confirm($order);
        $row = Database::one('SELECT * FROM orders WHERE id = ?', [$order]);
        $this->assertStringStartsWith('ret_', $row['registry_certificate_id']);
        $this->assertStringStartsWith('/v1/carbon/certificates/', $row['registry_certificate_url']);
        $this->assertSame(5880000, (int) $row['registry_payout_kobo'], '98% of 4 x NGN 15,000 goes to the project owner');
        $this->assertSame(120000, (int) $row['registry_fee_kobo']);

        $mine = $this->call('GET', '/api/market/orders', null, 'buyer')->body['data']['orders'][0];
        $this->assertSame($row['registry_certificate_url'], $mine['certificate_url']);
        $this->assertStringStartsWith('NG-KLX-2026-', $mine['serial_range']);
        $this->assertSame('successful', $mine['payment_status']);
    }

    public function testEveryPayoutIsWholeNairaFromTheOperatingAccount(): void
    {
        $this->signedPeriod();
        (new MarketService())->confirm($this->paidOrder(7));
        $amounts = array_map('intval', array_column(Database::all('SELECT amount_kobo FROM payouts'), 'amount_kobo'));
        foreach ($amounts as $kobo) {
            $this->assertSame(0, $kobo % 100, "NGN " . ($kobo / 100) . ' would risk a sandbox trigger');
        }
        $this->assertSame(7 * 1500000, array_sum($amounts));
        foreach ([...$this->bank->walletFundings, ...$this->bank->loanRepayments] as $call) {
            $this->assertSame('0123456790', $call['sourceAccount']);
        }
    }

    public function testAHomeWithALoanIsPaidOnceThroughTheLoan(): void
    {
        $this->signedPeriod();
        (new MarketService())->confirm($this->paidOrder());
        $adaezeWallet = Database::val('SELECT h.wallet_id FROM sites s JOIN households h ON h.id = s.household_id WHERE s.id = 12');
        $this->assertCount(1, $this->bank->loanRepayments);
        $this->assertSame([], array_filter($this->bank->walletFundings, fn ($f) => $f['walletId'] === $adaezeWallet));
    }

    /** Regression from the first live run: the order stuck at "retired" with every family payout pending. */
    public function testLiveShapedRepliesSettleTheOrder(): void
    {
        $this->bank->liveShapes = true;
        $this->signedPeriod();
        $order = $this->paidOrder();
        $this->assertSame('settled', (new MarketService())->confirm($order)['status']);
        $statuses = array_column(Database::all("SELECT status FROM payouts WHERE order_id = ? AND role = 'household'", [$order]), 'status');
        $this->assertSame(array_fill(0, 17, 'paid'), $statuses);
        $this->assertSame('paid', Database::val('SELECT status FROM payouts WHERE order_id = ? AND site_id = 12', [$order]), 'loan repayment counts as paid');
    }

    /** Regression from the first live run: the worker replayed 17 fundings every 15 s, over the 60/min limit. */
    public function testTheWorkerDoesNotHammerPendingPayouts(): void
    {
        $this->bank->fundingPending = true;
        $this->signedPeriod();
        $order = $this->paidOrder();
        $market = new MarketService();
        $market->confirm($order);
        $sent = count($this->bank->walletFundings);
        $this->assertSame(16, $sent, 'every family without a loan was attempted once');
        foreach (range(1, 5) as $tick) {
            $market->sweep();
        }
        $this->assertSame($sent, count($this->bank->walletFundings), 'back-to-back sweeps must not resend');
        $this->assertSame('retired', $market->order($order)['status']);
    }

    public function testCreditsFromTwoPeriodsCannotShareOneOrder(): void
    {
        Simulator::seed();
        $periods = new PeriodService();
        foreach ([['2026-01-01', '2026-03-31'], ['2026-04-01', '2026-06-30']] as [$start, $end]) {
            $id = $periods->create($start, $end);
            $periods->compute($id);
            foreach ($periods->sample($id, 42)['sample'] as $site) {
                $periods->review($id, $site, 'ok');
            }
            $periods->signOff($id, 'Test Auditor');
        }
        $first = (new CreditRepository())->search(['status' => 'listed'], 200, 0);
        $byPeriod = [];
        foreach ($first as $credit) {
            $byPeriod[Database::val('SELECT period_id FROM credits WHERE serial = ?', [$credit['serial']])][] = $credit['serial'];
        }
        $this->assertCount(2, $byPeriod);
        $mixed = [end($byPeriod[1]), $byPeriod[2][0]];
        $this->assertSame(409, $this->call('POST', '/api/orders', ['serials' => $mixed], 'buyer')->status);
    }
}
