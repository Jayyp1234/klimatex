<?php

namespace Tests\Integration;

use App\Config\Database;
use App\Services\Simulator\DemoService;
use App\Services\Simulator\Simulator;
use Tests\Support\ApiTestCase;

final class HouseholdApiTest extends ApiTestCase
{
    public function testAHouseholdFindsItsOwnHome(): void
    {
        Simulator::seed();
        $this->assertSame(12, $this->call('GET', '/api/homes/mine', null, 'household')->body['data']['site_id']);
        $this->assertSame(403, $this->call('GET', '/api/homes/mine', null, 'buyer')->status);
    }

    public function testDailyReadingsCarryTheSunlightCeiling(): void
    {
        Simulator::seed();
        $daily = $this->call('GET', '/api/homes/12', null, 'household')->body['data']['daily'];
        $this->assertCount(181, $daily);
        foreach ($daily as $day) {
            $this->assertNotNull($day['ceiling']);
            $this->assertLessThanOrEqual($day['ceiling'], $day['generated'], $day['day']);
        }
    }

    public function testPayoutsShowWhereTheMoneyWentAndWhichCreditsPaidIt(): void
    {
        Simulator::seed();
        (new DemoService())->run();
        $data = $this->call('GET', '/api/homes/12/payouts', null, 'household')->body['data'];
        $this->assertCount(1, $data['payouts']);
        $payout = $data['payouts'][0];
        $this->assertSame('solar_loan', $payout['destination']);
        $this->assertSame('paid', $payout['status']);
        $this->assertGreaterThan(0, $payout['amount_naira']);
        $this->assertSame($data['paid_naira'], $payout['amount_naira']);
        $this->assertGreaterThan(0, $payout['tonnes']);
        $this->assertSame(['start' => '2026-01-01', 'end' => '2026-06-30'], $payout['period']);
        $this->assertNotEmpty($payout['serials']);

        $other = $this->call('GET', '/api/homes/3/payouts', null, 'auditor')->body['data']['payouts'][0];
        $this->assertSame('wallet', $other['destination']);
    }

    public function testAlertsReportPayoutsAndProblemsOnly(): void
    {
        Simulator::seed();
        (new DemoService())->run();
        $kinds = array_column($this->call('GET', '/api/homes/12/alerts', null, 'household')->body['data']['alerts'], 'kind');
        $this->assertSame(['payout'], $kinds);

        Database::run("DELETE FROM readings WHERE inverter_id = (SELECT id FROM inverters WHERE site_id = 12) AND day > '2026-06-27'");
        $kinds = array_column($this->call('GET', '/api/homes/12/alerts', null, 'household')->body['data']['alerts'], 'kind');
        $this->assertContains('no_data', $kinds);

        $this->assertContains('held', array_column($this->call('GET', '/api/homes/17/alerts', null, 'auditor')->body['data']['alerts'], 'kind'));
    }

    public function testHouseholdsSeeOnlyTheirOwnPayoutsAndAlerts(): void
    {
        Simulator::seed();
        $this->assertSame(403, $this->call('GET', '/api/homes/3/payouts', null, 'household')->status);
        $this->assertSame(403, $this->call('GET', '/api/homes/3/alerts', null, 'household')->status);
        $this->assertSame(401, $this->call('GET', '/api/homes/12/payouts')->status);
    }
}
