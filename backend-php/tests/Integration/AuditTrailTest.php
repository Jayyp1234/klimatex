<?php

namespace Tests\Integration;

use App\Services\Simulator\DemoService;
use App\Services\Simulator\Simulator;
use Tests\Support\ApiTestCase;

final class AuditTrailTest extends ApiTestCase
{
    public function testTheAuditorSeesEveryPeriodWithItsSampleCreditsAndLedger(): void
    {
        Simulator::seed();
        (new DemoService())->run();
        $res = $this->call('GET', '/api/periods', null, 'auditor');
        $this->assertSame(200, $res->status);
        $data = $res->body['data'];
        $this->assertTrue($data['ledger']['ok']);
        $period = $data['periods'][0];
        $this->assertSame('signed', $period['status']);
        $this->assertSame(42, $period['sample_seed']);
        $this->assertNotEmpty($period['sample']);
        $this->assertSame(20, $period['homes']['eligible'] + $period['homes']['held'] + $period['homes']['excluded']);
        $this->assertGreaterThan(0, $period['credits']['issued']);
    }

    public function testThePeriodTrailListsOnlyThatPeriodsLedgerEntriesInOrder(): void
    {
        Simulator::seed();
        (new DemoService())->run();
        $id = $this->call('GET', '/api/periods', null, 'auditor')->body['data']['periods'][0]['id'];
        $events = $this->call('GET', "/api/periods/$id/trail", null, 'auditor')->body['data']['events'];
        $types = array_column($events, 'type');
        $this->assertSame('period.created', $types[0]);
        $this->assertSame('period.signed', end($types));
        $this->assertContains('site.reviewed', $types);
        foreach ($events as $e) {
            $this->assertSame($id, $e['payload']['period']);
            $this->assertMatchesRegularExpression('/^[0-9a-f]{64}$/', $e['hash']);
        }
        $this->assertSame(404, $this->call('GET', '/api/periods/999/trail', null, 'auditor')->status);
    }

    public function testOnlyAuditorsAndOperationsCanReadIt(): void
    {
        Simulator::seed();
        foreach (['household', 'buyer', 'installer', 'lender'] as $role) {
            $this->assertSame(403, $this->call('GET', '/api/periods', null, $role)->status, $role);
        }
        $this->assertSame(200, $this->call('GET', '/api/periods', null, 'admin')->status);
    }
}
