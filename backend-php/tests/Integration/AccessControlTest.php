<?php

namespace Tests\Integration;

use App\Services\Simulator\Simulator;
use FastRoute\DataGenerator\GroupCountBased as Generator;
use FastRoute\RouteCollector;
use FastRoute\RouteParser\Std;
use Tests\Support\ApiTestCase;

final class AccessControlTest extends ApiTestCase
{
    /** A new route is private unless someone deliberately adds it here. */
    public function testOnlyTheseRoutesArePublic(): void
    {
        $collector = new class(new Std(), new Generator()) extends RouteCollector {
            public array $public = [];
            public function addRoute($httpMethod, $route, $handler): void
            {
                if ($handler[2] === null) {
                    $this->public[] = "$httpMethod $route";
                }
            }
        };
        (require dirname(__DIR__, 2) . '/src/Routes/api.php')($collector);
        sort($collector->public);
        $this->assertSame([
            'GET /api/credits', 'GET /api/ledger/verify', 'GET /api/streets', 'GET /api/verify/{serial:[A-Za-z0-9\-]+}', 'GET /healthz',
            'POST /api/auth/login', 'POST /api/auth/logout', 'POST /api/auth/phone/complete', 'POST /api/auth/phone/login',
            'POST /api/auth/phone/start', 'POST /api/auth/phone/verify', 'POST /api/auth/refresh', 'POST /api/telegram/webhook', 'POST /hooks/forge',
        ], $collector->public);
    }

    public function testSignInIsRequired(): void
    {
        foreach ([['GET', '/api/homes/12'], ['POST', '/api/periods/1/signoff'], ['POST', '/api/demo/run'], ['POST', '/api/sandbox/register-webhook'], ['POST', '/api/orders']] as [$method, $path]) {
            $this->assertSame(401, $this->call($method, $path)->status, $path);
        }
    }

    public function testRolesAreEnforced(): void
    {
        Simulator::seed();
        $this->assertSame(403, $this->call('POST', '/api/periods', ['start' => '2026-01-01', 'end' => '2026-01-31'], 'buyer')->status);
        $this->assertSame(403, $this->call('POST', '/api/demo/run', null, 'auditor')->status);
        $this->assertSame(403, $this->call('POST', '/api/orders', ['tonnes' => 1], 'household')->status);
        $this->assertSame(403, $this->call('GET', '/api/homes', null, 'household')->status);
    }

    public function testAHouseholdSeesOnlyItsOwnHome(): void
    {
        Simulator::seed();
        $this->assertSame(200, $this->call('GET', '/api/homes/12', null, 'household')->status);
        $this->assertSame(403, $this->call('GET', '/api/homes/3', null, 'household')->status);
        $this->assertSame(403, $this->call('GET', '/api/homes/3/certificate', null, 'household')->status);
    }

    public function testASignOffCarriesTheSignedInAuditorsName(): void
    {
        Simulator::seed();
        $periods = new \App\Services\Period\PeriodService();
        $id = $periods->create(Simulator::START, Simulator::END);
        $periods->compute($id);
        foreach ($periods->sample($id, 42)['sample'] as $site) {
            $periods->review($id, $site, 'ok');
        }
        $this->call('POST', "/api/periods/$id/signoff", null, 'auditor', ['auditor' => 'Someone Else']);
        $this->assertSame('Demo Auditor (team member)', $periods->get($id)['signed_by']);
    }

    public function testBuyersSeeOnlyTheirOrdersAndNoPayeeNames(): void
    {
        $this->signedPeriod();
        $mine = $this->paidOrder();
        $stranger = (new \App\Services\Market\MarketService())->createOrder('Another Buyer', 1, 9999);
        $view = $this->call('GET', "/api/orders/$mine", null, 'buyer');
        $this->assertSame(200, $view->status);
        $this->assertArrayNotHasKey('payouts', $view->body['data']);
        $this->assertSame(404, $this->call('GET', "/api/orders/{$stranger['order']}", null, 'buyer')->status);
    }
}
