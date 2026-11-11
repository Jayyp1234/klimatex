<?php

namespace Tests\Integration;

use App\Services\Market\MarketService;
use Tests\Support\ApiTestCase;

final class MarketplaceApiTest extends ApiTestCase
{
    private const FIRST = 'KX-NG-2026-LAG01-000001';
    private const FIFTH = 'KX-NG-2026-LAG01-000005';

    public function testCreditsCarryProjectDetailsAndHonourFilters(): void
    {
        $this->signedPeriod();
        $all = $this->call('GET', '/api/credits')->body['data'];
        $this->assertSame(8, $all['count']);
        $this->assertSame('Surulere Household Solar', $all['items'][0]['project']);
        $this->assertSame(15000, (int) $all['items'][0]['price_naira']);

        $this->assertSame(8, $this->listedTotal(['location' => 'Lagos']));
        $this->assertSame(0, $this->listedTotal(['location' => 'Ogun']));
        $this->assertSame(8, $this->listedTotal(['vintage' => '2026']));
        $this->assertSame(0, $this->listedTotal(['vintage' => '2025']));
        $this->assertSame(0, $this->listedTotal(['authorised' => 'yes']));
        $this->assertSame(8, $this->listedTotal(['authorised' => 'no']));
        $this->assertSame(1, $this->listedTotal(['q' => '000005']));
        $this->assertSame(8, $this->listedTotal(['q' => 'surulere']));
    }

    public function testABuyerCanReserveTheExactSerialTheyPicked(): void
    {
        $this->signedPeriod();
        $order = $this->call('POST', '/api/orders', ['serials' => [self::FIFTH]], 'buyer');
        $this->assertSame(200, $order->status, jenc($order->body));
        $this->assertTrue($order->body['data']['simulated_checkout']);

        $mine = $this->orders()[0];
        $this->assertSame([self::FIFTH], $mine['serials']);
        $this->assertSame('reserved', $mine['status']);
        $this->assertSame(15000, (int) $mine['amount_naira']);
        $this->assertSame(1, $this->listedTotal(['status' => 'reserved']));
    }

    public function testASerialCannotBeReservedTwice(): void
    {
        $this->signedPeriod();
        $this->call('POST', '/api/orders', ['serials' => [self::FIRST]], 'buyer');
        $this->assertSame(409, $this->call('POST', '/api/orders', ['serials' => [self::FIRST]], 'buyer')->status);
        $this->assertSame(422, $this->call('POST', '/api/orders', ['serials' => ['bad serial!']], 'buyer')->status);
    }

    public function testReleasingPutsCreditsBackOnSaleOnlyOnce(): void
    {
        $this->signedPeriod();
        $id = $this->call('POST', '/api/orders', ['tonnes' => 3], 'buyer')->body['data']['order'];
        $this->assertSame(5, $this->listedTotal([]));
        $this->assertSame(200, $this->call('POST', "/api/orders/$id/release", null, 'buyer')->status);
        $this->assertSame(8, $this->listedTotal([]));
        $this->assertSame(409, $this->call('POST', "/api/orders/$id/release", null, 'buyer')->status);
    }

    public function testSimulatedPaymentThenConfirmRetiresAndSettles(): void
    {
        $this->signedPeriod();
        $id = $this->call('POST', '/api/orders', ['serials' => [self::FIRST]], 'buyer')->body['data']['order'];

        $this->assertSame('waiting', $this->call('POST', "/api/orders/$id/confirm", null, 'buyer')->body['data']['action']);
        $this->assertSame(200, $this->call('POST', "/api/orders/$id/simulate-payment", null, 'buyer')->status);
        $this->assertSame('settled', $this->call('POST', "/api/orders/$id/confirm", null, 'buyer')->body['data']['status']);

        $mine = $this->orders()[0];
        $this->assertNotNull($mine['certificate']);
        $this->assertNotNull($mine['retired_on']);
        $this->assertSame(409, $this->call('POST', "/api/orders/$id/simulate-payment", null, 'buyer')->status);
    }

    public function testOverviewReportsRealSupply(): void
    {
        $this->signedPeriod();
        $this->assertSame(200, $this->call('POST', '/api/orders/' . $this->paidOrder(3) . '/confirm', null, 'buyer')->status);

        $data = $this->call('GET', '/api/market/overview', null, 'buyer')->body['data'];
        $this->assertSame(5, $data['available']);
        $this->assertSame(3, $data['retired_by_you']);
        $this->assertSame('simulated', $data['payments']);
        $this->assertSame(['Lagos'], $data['locations']);
        $this->assertCount(1, $data['projects']);
        $this->assertSame(8, $data['projects'][0]['minted']);
        $this->assertSame(17, $data['projects'][0]['homes']);
        $this->assertSame('Test Auditor', $data['projects'][0]['auditor']);
        $this->assertCount(6, $data['supply_by_month']);
        $this->assertEqualsWithDelta(5.0, array_sum(array_column($data['supply_by_month'], 'tonnes')), 0.05);
    }

    public function testBuyersCannotTouchOtherPeoplesReservations(): void
    {
        $this->signedPeriod();
        $theirs = (new MarketService())->createOrder('Another Buyer', 1, 9999)['order'];
        $this->assertSame(404, $this->call('POST', "/api/orders/$theirs/release", null, 'buyer')->status);
        $this->assertSame(404, $this->call('POST', "/api/orders/$theirs/simulate-payment", null, 'buyer')->status);
        $this->assertSame([], $this->orders());
    }

    public function testMarketplaceRoutesRequireTheBuyerRole(): void
    {
        $this->signedPeriod();
        $this->assertSame(401, $this->call('GET', '/api/market/overview')->status);
        $this->assertSame(401, $this->call('GET', '/api/market/orders')->status);
        $this->assertSame(403, $this->call('GET', '/api/market/overview', null, 'auditor')->status);
        $this->assertSame(403, $this->call('POST', '/api/orders/1/simulate-payment', null, 'household')->status);
    }

    private function listedTotal(array $query): int
    {
        return $this->call('GET', '/api/credits', null, null, $query)->body['data']['count'];
    }

    private function orders(): array
    {
        return $this->call('GET', '/api/market/orders', null, 'buyer')->body['data']['orders'];
    }
}
