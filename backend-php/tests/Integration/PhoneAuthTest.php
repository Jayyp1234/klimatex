<?php

namespace Tests\Integration;

use App\Config\Database;
use App\Services\Auth\PhoneAuthService;
use App\Services\Simulator\Simulator;
use Tests\Support\ApiTestCase;

final class PhoneAuthTest extends ApiTestCase
{
    private const ADAEZE = '0700 001 0012';
    private const HOME_07 = '07000010007';

    protected function setUp(): void
    {
        parent::setUp();
        Simulator::seed();
    }

    private function post(string $path, array $body, ?string $token = null): \App\Core\Response
    {
        $headers = $token ? ['Authorization' => "Bearer $token"] : [];
        return $this->kernel->handle(new \App\Core\Request('POST', $path, [], jenc($body), $headers, '127.0.0.1'));
    }

    /** Runs the first-time flow and returns the new session. */
    private function setUpPhone(string $phone, string $pin = '4826', string $name = ''): array
    {
        $start = $this->post('/api/auth/phone/start', ['phone' => $phone]);
        $this->assertSame(200, $start->status, jenc($start->body));
        $this->assertSame('code', $start->body['data']['next']);
        $verify = $this->post('/api/auth/phone/verify', ['phone' => $phone, 'code' => $start->body['data']['demo_code']]);
        $this->assertSame(200, $verify->status, jenc($verify->body));
        $done = $this->post('/api/auth/phone/complete', ['setup_token' => $verify->body['data']['setup_token'], 'pin' => $pin, 'name' => $name]);
        $this->assertSame(200, $done->status, jenc($done->body));
        return $done->body['data'];
    }

    public function testNumbersAreReadTheWayPeopleTypeThem(): void
    {
        foreach (['08031234567', '0803 123 4567', '8031234567', '2348031234567', '+234 803 123 4567'] as $input) {
            $this->assertSame('+2348031234567', PhoneAuthService::normalise($input), $input);
        }
        $this->assertSame(422, $this->post('/api/auth/phone/start', ['phone' => '12345'])->status);
    }

    public function testAnUnregisteredNumberIsSentToTheInstaller(): void
    {
        $response = $this->post('/api/auth/phone/start', ['phone' => '08099999999']);
        $this->assertSame(404, $response->status);
        $this->assertStringContainsString('installer', $response->body['error']['message']);
    }

    public function testAFamilyWithNoLoginYetSetsUpAndThenSignsInWithItsPin(): void
    {
        $session = $this->setUpPhone(self::HOME_07, '4826', 'Mama Tunde');
        $this->assertSame('household', $session['user']['role']);
        $this->assertSame('Mama Tunde', $session['user']['name']);
        $this->assertSame('+2347000010007', $session['user']['phone']);

        $mine = $this->call('GET', '/api/homes/mine', null, null);
        $this->assertSame(401, $mine->status);
        $request = new \App\Core\Request('GET', '/api/homes/mine', [], '', ['Authorization' => 'Bearer ' . $session['access_token']]);
        $this->assertSame(7, $this->kernel->handle($request)->body['data']['site_id']);

        $this->assertSame('pin', $this->post('/api/auth/phone/start', ['phone' => self::HOME_07])->body['data']['next']);
        $this->assertSame(200, $this->post('/api/auth/phone/login', ['phone' => self::HOME_07, 'pin' => '4826'])->status);
    }

    public function testTheDemoHouseholdKeepsItsAccountWhenItAddsAPhone(): void
    {
        $before = (int) Database::val("SELECT COUNT(*) FROM users WHERE role = 'household'");
        $session = $this->setUpPhone(self::ADAEZE);
        $this->assertSame('adaeze@demo.klimatex.test', $session['user']['email']);
        $this->assertSame($before, (int) Database::val("SELECT COUNT(*) FROM users WHERE role = 'household'"));
    }

    public function testWrongCodesRunOutAndANewCodeReplacesTheOld(): void
    {
        $first = $this->post('/api/auth/phone/start', ['phone' => self::HOME_07])->body['data']['demo_code'];
        $second = $this->post('/api/auth/phone/start', ['phone' => self::HOME_07])->body['data']['demo_code'];
        if ($first !== $second) {
            $this->assertSame(401, $this->post('/api/auth/phone/verify', ['phone' => self::HOME_07, 'code' => $first])->status, 'old code');
        }
        $wrong = $second === '000000' ? '111111' : '000000';
        for ($i = 0; $i < 4; $i++) {
            $this->post('/api/auth/phone/verify', ['phone' => self::HOME_07, 'code' => $wrong]);
        }
        $this->assertSame(429, $this->post('/api/auth/phone/verify', ['phone' => self::HOME_07, 'code' => $second])->status);
    }

    public function testASetupTokenWorksOnceAndWeakPinsAreRefused(): void
    {
        $code = $this->post('/api/auth/phone/start', ['phone' => self::HOME_07])->body['data']['demo_code'];
        $token = $this->post('/api/auth/phone/verify', ['phone' => self::HOME_07, 'code' => $code])->body['data']['setup_token'];
        foreach (['1234', '1111', '12a4', '123'] as $pin) {
            $this->assertSame(422, $this->post('/api/auth/phone/complete', ['setup_token' => $token, 'pin' => $pin])->status, $pin);
        }
        $this->assertSame(200, $this->post('/api/auth/phone/complete', ['setup_token' => $token, 'pin' => '4826'])->status);
        $this->assertSame(401, $this->post('/api/auth/phone/complete', ['setup_token' => $token, 'pin' => '5937'])->status, 'spent');
    }

    public function testWrongPinsLockThePhoneAndACodeResetsThePin(): void
    {
        $this->setUpPhone(self::HOME_07);
        for ($i = 0; $i < 5; $i++) {
            $this->assertSame(401, $this->post('/api/auth/phone/login', ['phone' => self::HOME_07, 'pin' => '9999'])->status);
        }
        $this->assertSame(429, $this->post('/api/auth/phone/login', ['phone' => self::HOME_07, 'pin' => '4826'])->status);

        $reset = $this->post('/api/auth/phone/start', ['phone' => self::HOME_07, 'forgot_pin' => true]);
        $this->assertSame('code', $reset->body['data']['next']);
        $token = $this->post('/api/auth/phone/verify', ['phone' => self::HOME_07, 'code' => $reset->body['data']['demo_code']])->body['data']['setup_token'];
        $this->assertSame(200, $this->post('/api/auth/phone/complete', ['setup_token' => $token, 'pin' => '7315'])->status);
        $this->assertSame(200, $this->post('/api/auth/phone/login', ['phone' => self::HOME_07, 'pin' => '7315'])->status);
    }

    public function testAFamilyChoosesWhereItIsPaidAfterTheBankConfirmsTheName(): void
    {
        $token = $this->setUpPhone(self::ADAEZE)['access_token'];
        $get = fn () => $this->kernel->handle(new \App\Core\Request('GET', '/api/homes/mine/payout-details', [], '', ['Authorization' => "Bearer $token"]))->body['data'];

        $this->assertSame('wallet', $get()['method']);
        $check = $this->post('/api/homes/mine/payout-details/check', ['bank_code' => '000014', 'account' => '0123456789'], $token);
        $this->assertSame('ADAEZE CHIAMAKA OKONKWO', $check->body['data']['account_name']);
        $this->assertSame(422, $this->post('/api/homes/mine/payout-details/check', ['bank_code' => '000014', 'account' => '0000000001'], $token)->status);
        $this->assertSame(422, $this->post('/api/homes/mine/payout-details/check', ['bank_code' => '000014', 'account' => '12345'], $token)->status);

        $saved = $this->post('/api/homes/mine/payout-details', ['method' => 'bank', 'bank_code' => '000014', 'account' => '0123456789'], $token)->body['data'];
        $this->assertSame('bank', $saved['method']);
        $this->assertSame('6789', $saved['bank']['account_ending']);
        $this->assertArrayNotHasKey('account', $saved['bank'], 'the full number is never sent back');

        $back = $this->post('/api/homes/mine/payout-details', ['method' => 'wallet'], $token)->body['data'];
        $this->assertSame('wallet', $back['method']);
        $this->assertSame('6789', $back['bank']['account_ending'], 'kept on file');
        $again = $this->post('/api/homes/mine/payout-details', ['method' => 'bank'], $token)->body['data'];
        $this->assertSame('bank', $again['method'], 'switch back without retyping');
    }

    public function testOnlyAHouseholdHasPayoutDetails(): void
    {
        $this->assertSame(403, $this->call('GET', '/api/homes/mine/payout-details', null, 'buyer')->status);
    }
}
