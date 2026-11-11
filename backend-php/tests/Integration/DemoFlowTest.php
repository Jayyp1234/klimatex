<?php

namespace Tests\Integration;

use App\Config\Database;
use App\Services\Ledger\Ledger;
use App\Services\Simulator\Simulator;
use Tests\Support\ApiTestCase;

final class DemoFlowTest extends ApiTestCase
{
    public function testTheWholeStoryRunsAndAddsUp(): void
    {
        Simulator::seed();
        $response = $this->call('POST', '/api/demo/run', null, 'admin');
        $this->assertSame(200, $response->status, jenc($response->body));
        $demo = $response->body['data'];

        $sites = $this->call('GET', '/api/periods/1', null, 'auditor')->body['data']['sites'];
        $status = array_column($sites, 'status', 'label');
        $this->assertSame('excluded', $status['Home 17'], 'Home 17 beats the sun');
        $this->assertSame('held', $status['Home 04']);
        $this->assertSame('held', $status['Home 19'], 'clone pair');
        $this->assertCount(17, array_filter($status, fn ($s) => $s === 'eligible'));

        $this->assertSame([3, 4, 7, 9, 12, 19], $demo['sample']['sample']);
        $this->assertSame(8, $demo['signoff']['credits_minted'], 'the registry issues 8 at 0.53 t/MWh');
        $this->assertSame(18.098, $demo['signoff']['methodology_t'], 'our JUST estimate after meter and baseline deductions, kept alongside');
        $this->assertSame(0.0975, $demo['signoff']['carried_t']);

        $settled = $demo['settled'];
        $this->assertSame('settled', $settled['status']);
        $this->assertEquals(120000, $settled['total_naira']);
        $this->assertEquals(['household' => 60000, 'installer' => 18000, 'audit' => 24000, 'klimatex' => 18000], $settled['by_role_naira']);
        $this->assertEquals(120000, array_sum(array_column($settled['payouts'], 'naira')));
        $this->assertCount(17, array_filter($settled['payouts'], fn ($p) => $p['role'] === 'household'));

        $retired = $this->call('GET', '/api/credits', null, null, ['status' => 'retired'])->body['data'];
        $this->assertSame(8, $retired['count']);
        $verified = $this->call('GET', '/api/verify/' . $retired['serials'][0])->body['data'];
        $this->assertSame('Mama Nkechi Provisions Ltd', $verified['retired_for']);
        $this->assertEqualsWithDelta(1.0, array_sum(array_column($verified['home_months'], 't')), 0.01);

        $again = $this->call('POST', '/api/orders/1/confirm', null, 'admin')->body['data'];
        $this->assertEquals(120000, array_sum(array_column($again['payouts'], 'naira')), 'confirming twice never pays twice');

        $certificate = $this->call('GET', '/api/homes/12/certificate', null, 'household')->body['data'];
        $this->assertSame('F', $certificate['grade_before']);
        $this->assertSame('B', $certificate['grade_now']);
        $this->assertEquals(3054, $certificate['payouts_naira'], 'whole naira, paid off her loan (her baseline is still surveyed)');
        $this->assertStringStartsWith('Hi Adaeze', $this->call('GET', '/api/homes/12/message', null, 'household')->body['data']['text']);

        $this->assertTrue(Ledger::verify()['ok']);
    }

    public function testTheLedgerRefusesEditsAndDetectsTamperingIfForced(): void
    {
        $this->signedPeriod();
        try {
            Database::run("UPDATE ledger SET payload = '{}' WHERE id = 2");
            $this->fail('the database should refuse to change the ledger');
        } catch (\PDOException) {
            $this->addToAssertionCount(1);
        }
        Database::reset();
        Database::pdo()->exec(Database::isSqlite() ? 'DROP TRIGGER ledger_no_update' : 'DROP TRIGGER ledger_no_change ON ledger');
        Database::run("UPDATE ledger SET payload = ? WHERE id = 2", [jenc(['tampered' => true])]);
        $this->assertFalse(Ledger::verify()['ok']);
    }
}
