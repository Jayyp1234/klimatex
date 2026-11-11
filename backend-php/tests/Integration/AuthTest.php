<?php

namespace Tests\Integration;

use App\Services\Simulator\Simulator;
use Tests\Support\ApiTestCase;

final class AuthTest extends ApiTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Simulator::seed();
    }

    public function testLoginReturnsTokensAndTheUser(): void
    {
        $session = $this->login('auditor');
        $this->assertSame('auditor', $session['user']['role']);
        $this->assertArrayNotHasKey('password_hash', $session['user']);
        $this->assertSame('auditor', $this->call('GET', '/api/auth/me', null, 'auditor')->body['data']['role']);
    }

    public function testWrongPasswordIsRefusedThenLockedOut(): void
    {
        $body = ['email' => 'buyer@demo.klimatex.test', 'password' => 'wrong'];
        for ($i = 0; $i < 5; $i++) {
            $this->assertSame(401, $this->call('POST', '/api/auth/login', $body)->status);
        }
        $this->assertSame(429, $this->call('POST', '/api/auth/login', ['email' => $body['email'], 'password' => self::PASSWORD])->status);
    }

    public function testRefreshRotatesAndReplayEndsTheSession(): void
    {
        $first = $this->login('buyer');
        $second = $this->call('POST', '/api/auth/refresh', ['refresh_token' => $first['refresh_token']]);
        $this->assertSame(200, $second->status);
        $this->assertNotSame($first['refresh_token'], $second->body['data']['refresh_token']);

        $this->assertSame(401, $this->call('POST', '/api/auth/refresh', ['refresh_token' => $first['refresh_token']])->status, 'spent token');
        $this->assertSame(401, $this->call('POST', '/api/auth/refresh', ['refresh_token' => $second->body['data']['refresh_token']])->status, 'replay ends every session');
    }

    public function testATamperedTokenIsRejected(): void
    {
        $token = $this->token('buyer');
        $request = new \App\Core\Request('GET', '/api/auth/me', [], '', ['Authorization' => 'Bearer ' . $token . 'x']);
        $this->assertSame(401, $this->kernel->handle($request)->status);
    }
}
