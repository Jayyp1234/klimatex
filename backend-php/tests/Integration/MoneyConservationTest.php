<?php

namespace Tests\Integration;

use App\Config\Settings;
use App\Models\KvStore;
use App\Services\Bank\Bank;
use App\Services\Market\MarketService;
use App\Services\Registry\Registry;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\ApiTestCase;
use Tests\Support\ScriptedBank;

/**
 * Every naira a buyer pays is accounted for: the registry keeps its fee, pays the rest to KlimateX (the
 * project owner), and KlimateX pays families, the installer, the audit reserve and itself from exactly that.
 */
final class MoneyConservationTest extends ApiTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Bank::swap(new ScriptedBank());
    }

    public function testTheRegistryPaysKlimateXNotTheInstaller(): void
    {
        $this->assertSame(Settings::OPERATING_ACCOUNT, Settings::PROJECT_OWNER['payout_account']);
        $this->assertNotSame(Settings::INSTALLER_ACCOUNT, Settings::PROJECT_OWNER['payout_account']);
        $this->signedPeriod();
        (new MarketService())->confirm($this->paidOrder(2));
        $retirements = jdec(KvStore::get('mock_registry'))['retirements'];
        $this->assertNotEmpty($retirements);
        foreach ($retirements as $retirement) {
            $this->assertSame(Settings::OPERATING_ACCOUNT, $retirement['payout']['destination_account'], 'sale proceeds land with KlimateX');
        }
    }

    #[DataProvider('orderSizes')]
    public function testWhatKlimateXReceivesEqualsWhatItPaysOut(int $credits): void
    {
        $this->signedPeriod();
        $order = $this->paidOrder($credits);
        (new MarketService())->confirm($order);

        $money = $this->call('GET', "/api/orders/$order", null, 'buyer')->body['data']['money'];
        $gross = $credits * 15000;
        $fee = $gross * Registry::REGISTRY_FEE_RATE;
        $this->assertEquals($gross, $money['buyer_paid_naira']);
        $this->assertEquals($fee, $money['registry_fee_naira']);
        $this->assertEquals($gross - $fee, $money['received_naira'], 'the registry pays KlimateX the sale less its fee');
        $this->assertTrue($money['balanced'], 'difference: ₦' . $money['difference_naira']);
        $this->assertEquals(0, $money['difference_naira']);
        $out = $money['paid_out_naira'];
        $this->assertEquals($money['received_naira'], $out['families'] + $out['installer'] + $out['audit_reserve_after_registry_fee'] + $out['klimatex']);
        $this->assertEquals($gross * 0.5, $out['families']);
        $this->assertEquals($gross * 0.15, $out['installer']);
    }

    public static function orderSizes(): array
    {
        return ['the live demo order' => [8], 'one credit' => [1], 'an odd size' => [7]];
    }
}
