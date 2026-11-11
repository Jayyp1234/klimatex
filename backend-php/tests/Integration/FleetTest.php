<?php

namespace Tests\Integration;

use App\Services\Simulator\DemoService;
use App\Services\Simulator\Simulator;
use Tests\Support\ApiTestCase;

final class FleetTest extends ApiTestCase
{
    public function testTheInstallerSeesItsOwnFleetWithStatusAndEarnings(): void
    {
        Simulator::seed();
        (new DemoService())->run();
        $res = $this->call('GET', '/api/fleet', null, 'installer');
        $this->assertSame(200, $res->status);
        $data = $res->body['data'];
        $this->assertSame('installer', $data['scope']);
        $this->assertCount(20, $data['homes']);
        $t = $data['totals'];
        $this->assertSame(20, $t['eligible'] + $t['held'] + $t['excluded']);
        $this->assertGreaterThan(0, $t['installer_earnings_naira']);
        $this->assertGreaterThan(0, $t['kwh_period']);
        $this->assertSame(20, array_sum($data['grades']));
        $this->assertNotEmpty($data['monthly']);

        $adaeze = array_values(array_filter($data['homes'], fn ($h) => $h['id'] === 12))[0];
        $this->assertSame('loan_demo_12', $adaeze['loan']);
        $this->assertSame($adaeze['paid_naira'], $adaeze['loan_repaid_naira']);
        $this->assertSame('2026-06-30', $adaeze['last_reading']);
    }

    public function testTheLenderSeesEveryHomeAndFamiliesAndBuyersSeeNone(): void
    {
        Simulator::seed();
        (new DemoService())->run();
        $data = $this->call('GET', '/api/fleet', null, 'lender')->body['data'];
        $this->assertSame('all', $data['scope']);
        $this->assertContains('loan_demo_12', array_column($data['homes'], 'loan'));
        $this->assertSame(count(array_filter(array_column($data['homes'], 'loan'))), $data['totals']['loans']);
        $this->assertGreaterThan(0, $data['totals']['loan_repaid_naira']);
        $this->assertSame(403, $this->call('GET', '/api/fleet', null, 'household')->status);
        $this->assertSame(403, $this->call('GET', '/api/fleet', null, 'buyer')->status);
        $this->assertSame(401, $this->call('GET', '/api/fleet')->status);
    }
}
