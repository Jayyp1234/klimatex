<?php

namespace Tests\Integration;

use App\Services\Simulator\Simulator;
use Tests\Support\ApiTestCase;

final class CreditTipsTest extends ApiTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Simulator::seed();
        $this->assertSame(200, $this->call('POST', '/api/demo/run', null, 'admin')->status);
    }

    private function tips(int $home, string $as = 'household'): array
    {
        $response = $this->call('GET', "/api/homes/$home/tips", null, $as);
        $this->assertSame(200, $response->status, jenc($response->body));
        return array_column($response->body['data']['tips'], null, 'kind') + ['_' => $response->body['data']];
    }

    public function testAdaezeIsToldToAddHerFuelReceiptsAndWhy(): void
    {
        $tips = $this->tips(12);
        $this->assertSame('todo', $tips['fuel_receipts']['status']);
        $this->assertStringContainsString('5 of 12', $tips['fuel_receipts']['title']);
        $this->assertStringContainsString('cut by 10%', $tips['fuel_receipts']['body']);
        $this->assertSame('/app/household/receipts/', $tips['fuel_receipts']['action']['href']);
        $this->assertSame('done', $tips['meter']['status'], 'her meter is class 1');
        $this->assertSame('done', $tips['generator']['status']);
        $this->assertSame(10, $tips['_']['credits_cut_pct']);
        $this->assertArrayHasKey('backup', $tips);
    }

    public function testTwelveMonthsOfReceiptsMakeTheBaselineMeasured(): void
    {
        $evidence = $this->call('GET', '/api/homes/12/evidence', null, 'household')->body['data'];
        $this->assertSame('surveyed', $evidence['baseline']['tier']);
        $this->assertCount(7, $evidence['baseline']['missing_months']);

        $outside = $this->call('POST', '/api/homes/mine/fuel-receipts', ['month' => '2026-02', 'litres' => 90, 'amount_naira' => 63000], 'household');
        $this->assertSame(422, $outside->status, 'only the year before solar counts');
        $bad = $this->call('POST', '/api/homes/mine/fuel-receipts', ['month' => $evidence['baseline']['missing_months'][0], 'litres' => -3, 'amount_naira' => 1], 'household');
        $this->assertSame(422, $bad->status);

        foreach ($evidence['baseline']['missing_months'] as $month) {
            $saved = $this->call('POST', '/api/homes/mine/fuel-receipts', ['month' => $month, 'litres' => 95, 'amount_naira' => 66500], 'household');
            $this->assertSame(200, $saved->status, jenc($saved->body));
        }
        $this->assertSame('measured', $saved->body['data']['baseline']['tier']);
        $tips = $this->tips(12);
        $this->assertSame('done', $tips['fuel_receipts']['status']);
        $this->assertSame(0, $tips['_']['credits_cut_pct']);
    }

    public function testHomesOnlySeeTheirOwnTipsAndOnlyStaffRecordMeters(): void
    {
        $this->assertSame(403, $this->call('GET', '/api/homes/9/tips', null, 'household')->status);
        $this->assertSame(403, $this->call('POST', '/api/homes/12/meter', ['accuracy_pct' => 1, 'calibrated_on' => '2026-01-10'], 'household')->status);
        $this->assertSame(403, $this->call('GET', '/api/tips', null, 'household')->status);
        $this->assertSame(401, $this->call('GET', '/api/homes/12/tips')->status);
    }

    public function testTheInstallerSeesWhatToFixAndCanRecordANewCalibration(): void
    {
        $fleet = $this->call('GET', '/api/tips', null, 'installer');
        $this->assertSame(200, $fleet->status, jenc($fleet->body));
        $byLabel = [];
        foreach ($fleet->body['data']['homes'] as $h) {
            $byLabel[$h['home']['label']] = array_column($h['tips'], null, 'kind');
        }
        $this->assertSame('high', $byLabel['Home 09']['meter']['priority']);
        $this->assertStringContainsString('±8', $byLabel['Home 09']['meter']['title']);
        $this->assertArrayHasKey('impossible_days', $byLabel['Home 17']);
        $this->assertArrayHasKey('clone', $byLabel['Home 19']);
        $this->assertArrayHasKey('fuel_receipts', $byLabel['Home 12']);
        $this->assertSame(1, $fleet->body['data']['by_kind']['meter']);

        $bad = $this->call('POST', '/api/homes/9/meter', ['accuracy_pct' => 1.0, 'calibrated_on' => '2099-01-01'], 'installer');
        $this->assertSame(422, $bad->status, 'no calibration dates in the future');
        $saved = $this->call('POST', '/api/homes/9/meter', ['accuracy_pct' => 1.0, 'calibrated_on' => '2026-03-02'], 'installer');
        $this->assertSame(200, $saved->status, jenc($saved->body));
        $this->assertTrue($saved->body['data']['meter']['within_limit']);
        $this->assertSame('done', $this->tips(9, 'installer')['meter']['status']);
    }

    public function testTheAssistantAnswersHowToEarnMoreFromTheTips(): void
    {
        $reply = $this->call('POST', '/api/assistant/ask', ['message' => 'How can I earn more?'], 'household')->body['data'];
        $this->assertSame(['credit_tips'], $reply['sources']);
        $this->assertStringContainsString('fuel receipts', $reply['answer']);
    }
}
