<?php

namespace Tests\Integration;

use App\Services\Simulator\Simulator;
use Tests\Support\ApiTestCase;

final class SupportRequestTest extends ApiTestCase
{
    private const VALID = ['topic' => 'system', 'subject' => 'Inverter light is off', 'message' => 'The Wi-Fi light went off yesterday evening.', 'contact' => 'sms', 'share_readings' => true];

    public function testAFamilyAsksForHelpAndSeesItsOwnRequests(): void
    {
        Simulator::seed();
        $res = $this->call('POST', '/api/support/requests', self::VALID, 'household');
        $this->assertSame(200, $res->status);
        $request = $res->body['data']['request'];
        $this->assertMatchesRegularExpression('/^SUP-[0-9A-F]{6}$/', $request['reference']);
        $this->assertSame('received', $request['status']);
        $this->assertSame(12, $request['site_id']);
        $this->assertTrue($request['share_readings']);

        $mine = $this->call('GET', '/api/support/requests', null, 'household')->body['data']['requests'];
        $this->assertSame([$request['reference']], array_column($mine, 'reference'));
        $this->assertCount(1, $this->call('GET', '/api/support/requests', null, 'admin')->body['data']['requests']);
    }

    public function testBadInputIsRefusedFieldByField(): void
    {
        Simulator::seed();
        $res = $this->call('POST', '/api/support/requests', ['topic' => 'nonsense', 'subject' => 'x', 'message' => 'short'], 'household');
        $this->assertSame(422, $res->status);
        $this->assertEqualsCanonicalizing(['topic', 'subject', 'message'], array_keys($res->body['error']['fields']));
    }

    public function testOnlyFamiliesOpenRequestsAndTheQueueCannotBeFlooded(): void
    {
        Simulator::seed();
        $this->assertSame(403, $this->call('POST', '/api/support/requests', self::VALID, 'buyer')->status);
        for ($i = 0; $i < 5; $i++) {
            $this->assertSame(200, $this->call('POST', '/api/support/requests', self::VALID, 'household')->status);
        }
        $this->assertSame(429, $this->call('POST', '/api/support/requests', self::VALID, 'household')->status);
    }
}
