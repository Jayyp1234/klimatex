<?php

namespace Tests\Integration;

use App\Config\Database;
use App\Core\Request;
use App\Core\Response;
use App\Services\Simulator\Simulator;
use App\Services\Telegram\TelegramService;
use Tests\Support\ApiTestCase;

/** Family self-onboarding on the website and in Telegram (docs/ONBOARDING_FLOW.md). */
final class OnboardingTest extends ApiTestCase
{
    private array $sent = [];
    private int $updateId = 5000;

    protected function setUp(): void
    {
        parent::setUp();
        Simulator::seed();
    }

    protected function tearDown(): void
    {
        TelegramService::$send = null;
        putenv('TELEGRAM_BOT_TOKEN');
        parent::tearDown();
    }

    private function as(string $token, string $method, string $path, ?array $body = null): Response
    {
        return $this->kernel->handle(new Request($method, $path, [], $body === null ? '' : jenc($body), ['Authorization' => "Bearer $token"], '127.0.0.1'));
    }

    private function catalog(): array
    {
        $r = $this->call('GET', '/api/onboarding/installers');
        $this->assertSame(200, $r->status, jenc($r->body));
        return $r->body['data'];
    }

    /** Phone → code → verify → account, the website's way. Returns the session. */
    private function signUp(string $phone, array $answers): array
    {
        $start = $this->call('POST', '/api/onboarding/phone', ['phone' => $phone]);
        $this->assertSame('code', $start->body['data']['next'], jenc($start->body));
        $verify = $this->call('POST', '/api/auth/phone/verify', ['phone' => $phone, 'code' => $start->body['data']['demo_code']]);
        $this->assertSame(200, $verify->status, jenc($verify->body));
        $account = $this->call('POST', '/api/onboarding/account', ['setup_token' => $verify->body['data']['setup_token'], 'pin' => '4826',
            'name' => 'Chioma Okafor', 'area' => 'Yaba'] + $answers);
        $this->assertSame(200, $account->status, jenc($account->body));
        return $account->body['data'];
    }

    public function testTheCatalogListsEveryInstallerWithPricesAndEstimates(): void
    {
        $c = $this->catalog();
        $this->assertCount(4, $c['installers']);
        $this->assertSame('Arewa Solar Co-operative Society', $c['installers'][0]['name']);
        $this->assertSame(20, $c['installers'][0]['metered_homes'], 'judged on the homes it already fitted');
        $this->assertSame(0, $c['installers'][1]['metered_homes']);
        $this->assertSame([1300000, 6800000], $c['price_range_naira']);
        $p = $c['installers'][0]['packages'][0];
        $this->assertGreaterThan(1500, $p['estimate']['solar_kwh_year']);
        $this->assertGreaterThan(0, $p['estimate']['family_carbon_naira_year']);
        $this->assertStringContainsString('Sample prices', $c['note']);
        $this->assertCount(3, $c['options']['income_bands']);
    }

    public function testANewFamilyBuysSolarOnALoanAndGoesLive(): void
    {
        $package = $this->catalog()['installers'][0]['packages'][1]; // Arewa, Family 3.5 kVA
        $session = $this->signUp('0812 555 0101', ['path' => 'need', 'package_id' => $package['id'], 'payment' => 'loan']);
        $token = $session['access_token'];
        $this->assertSame('household', $session['user']['role']);
        $this->assertSame('loan_check', $session['onboarding']['next']['action']);
        $this->assertSame(404, $this->as($token, 'GET', '/api/homes/mine')->status, 'no dashboard before certification');

        $this->assertSame(409, $this->as($token, 'POST', '/api/onboarding/mine/submit')->status, 'loan check comes first');
        $view = $this->as($token, 'POST', '/api/onboarding/mine/answers', ['income_band' => 'mid'])->body['data'];
        $this->assertSame(1680000, $view['loan']['limit_naira']);
        $view = $this->as($token, 'POST', '/api/onboarding/mine/submit')->body['data'];
        $this->assertSame('requested', $view['status']);
        $this->assertSame('installer', $view['next']['by']);

        // The installer moves it along; another installer can't see it.
        $requests = $this->call('GET', '/api/onboarding/requests', null, 'installer')->body['data']['requests'];
        $this->assertCount(1, $requests);
        $id = $requests[0]['id'];
        $this->assertSame(['accept'], $requests[0]['actions']);
        $this->assertSame(409, $this->call('POST', "/api/onboarding/requests/$id/quote", ['amount_naira' => 3200000], 'installer')->status, 'steps run in order');
        $this->assertSame(200, $this->call('POST', "/api/onboarding/requests/$id/accept", [], 'installer')->status);
        $this->assertSame(200, $this->call('POST', "/api/onboarding/requests/$id/survey", ['date' => '2026-11-20'], 'installer')->status);
        $this->assertSame(422, $this->call('POST', "/api/onboarding/requests/$id/quote", ['amount_naira' => 5], 'installer')->status);
        $this->assertSame(200, $this->call('POST', "/api/onboarding/requests/$id/quote", ['amount_naira' => 3200000], 'installer')->status);

        $view = $this->as($token, 'GET', '/api/onboarding/mine')->body['data'];
        $this->assertSame('accept_quote', $view['next']['action']);
        $this->assertSame(3200000, $view['quote_naira']);
        $view = $this->as($token, 'POST', '/api/onboarding/mine/accept-quote')->body['data'];
        $this->assertSame('approved', $view['status']);
        $this->assertSame('approved', $view['loan']['status']);
        $this->assertSame(1000000, $view['loan']['limit_naira'], 'the sandbox lends up to ₦1,000,000; the rest is the deposit');
        $this->assertNotNull(Database::val('SELECT loan_id FROM households WHERE id = ?', [$session['user']['household_id']]));

        $done = $this->call('POST', "/api/onboarding/requests/$id/complete", [], 'installer');
        $this->assertSame(200, $done->status, jenc($done->body));
        $this->assertTrue($done->body['data']['certified']);

        $siteId = $this->as($token, 'GET', '/api/homes/mine')->body['data']['site_id'];
        $home = $this->as($token, 'GET', "/api/homes/$siteId")->body['data'];
        $this->assertCount(7, $home['daily'], 'readings start at certification');
        $this->assertNotNull($home['generator']['scrapped_on'], 'the generator was traded in');
        $this->assertSame(409, $this->as($token, 'GET', "/api/homes/$siteId/certificate")->status, 'the grade waits for the first audit');
        $this->assertSame('home_certified', Database::val('SELECT event_type FROM ledger ORDER BY id DESC LIMIT 1'));
        $this->assertTrue($this->call('GET', '/api/ledger/verify')->body['data']['ok']);
    }

    public function testAFamilyWithSolarConnectsAndAnyInstallerVerifies(): void
    {
        $session = $this->signUp('0813 555 0102', ['path' => 'have']);
        $token = $session['access_token'];
        $this->assertSame('link_inverter', $session['onboarding']['next']['action']);
        $this->assertSame('Inverter linked', $session['onboarding']['steps'][1]['label']);

        $this->assertSame(409, $this->as($token, 'POST', '/api/onboarding/mine/answers', ['inverter_serial' => 'INV-SIM-0004'])->status, 'one inverter, one home');
        $this->as($token, 'POST', '/api/onboarding/mine/answers', ['inverter_brand' => 'Growatt', 'inverter_serial' => 'gw5048d-123456']);
        $view = $this->as($token, 'POST', '/api/onboarding/mine/answers', ['generator' => 'backup'])->body['data'];
        $this->assertSame('GW5048D-123456', $view['inverter']['serial']);
        $this->assertSame('pick_installer', $view['next']['action']);

        $yaba = $this->catalog()['installers'][1]['id'];
        $this->assertSame(404, $this->as($token, 'POST', '/api/onboarding/mine/submit', ['installer_id' => 99999])->status);
        $view = $this->as($token, 'POST', '/api/onboarding/mine/submit', ['installer_id' => $yaba])->body['data'];
        $this->assertSame('Yaba Solar Works', $view['installer']['name']);

        $this->assertCount(0, $this->call('GET', '/api/onboarding/requests', null, 'installer')->body['data']['requests'], "Arewa doesn't see Yaba's request");
        $id = $this->call('GET', '/api/onboarding/requests', null, 'admin')->body['data']['requests'][0]['id'];
        $this->assertSame(404, $this->call('POST', "/api/onboarding/requests/$id/accept", [], 'installer')->status);
        $this->assertSame('visit', $this->call('POST', "/api/onboarding/requests/$id/accept", ['date' => '2026-11-18'], 'admin')->body['data']['status']);
        $this->assertTrue($this->call('POST', "/api/onboarding/requests/$id/verify", [], 'admin')->body['data']['certified']);

        $siteId = $this->as($token, 'GET', '/api/homes/mine')->body['data']['site_id'];
        $home = $this->as($token, 'GET', "/api/homes/$siteId")->body['data'];
        $this->assertSame('GW5048D-123456', $home['inverter']['serial']);
        $this->assertNull($home['generator']['scrapped_on'], 'a kept backup generator is not scrapped, so its tonnes are held');
    }

    public function testANumberThatAlreadyHasAHomeSignsInInstead(): void
    {
        $this->assertSame('signin', $this->call('POST', '/api/onboarding/phone', ['phone' => '+2347000010012'])->body['data']['next']);
        $this->assertSame(422, $this->call('POST', '/api/onboarding/phone', ['phone' => '123'])->status);
        $this->assertSame(401, $this->call('POST', '/api/onboarding/account', ['setup_token' => 'nope', 'pin' => '4826', 'name' => 'X Y', 'area' => 'Yaba', 'path' => 'have'])->status);
        $this->assertSame(401, $this->call('GET', '/api/onboarding/mine')->status);
        $this->assertSame(404, $this->call('GET', '/api/onboarding/mine', null, 'household')->status, 'seeded homes have no sign-up to track');
    }

    public function testAFamilyCanChangeTheirMindUntilTheQuoteIsAccepted(): void
    {
        $installers = $this->catalog()['installers'];
        [$arewa, $yaba] = [$installers[0]['packages'][0], $installers[1]['packages'][0]];
        $token = $this->signUp('0814 555 0105', ['path' => 'need', 'package_id' => $arewa['id'], 'payment' => 'cash'])['access_token'];
        $this->as($token, 'POST', '/api/onboarding/mine/submit');
        $id = $this->call('GET', '/api/onboarding/requests', null, 'installer')->body['data']['requests'][0]['id'];
        foreach (['accept' => [], 'survey' => [], 'quote' => ['amount_naira' => 1500000]] as $action => $body) {
            $this->call('POST', "/api/onboarding/requests/$id/$action", $body, 'installer');
        }
        $this->assertTrue($this->as($token, 'GET', '/api/onboarding/mine')->body['data']['can_change']);

        // A different package from another installer: a fresh request, quote dropped.
        $view = $this->as($token, 'POST', '/api/onboarding/mine/change', ['package_id' => $yaba['id']])->body['data'];
        $this->assertSame('requested', $view['status']);
        $this->assertNull($view['quote_naira']);
        $this->assertSame('Yaba Solar Works', $view['installer']['name']);
        $this->assertStringContainsString('Changed to Home 3 kVA', array_column($view['events'], 'note', 'status')['changed']);
        $this->assertCount(0, $this->call('GET', '/api/onboarding/requests', null, 'installer')->body['data']['requests'], 'Arewa no longer has it');
        $this->assertSame(422, $this->as($token, 'POST', '/api/onboarding/mine/change', ['package_id' => $yaba['id']])->status, 'nothing changed');

        // Switching to a loan brings the pre-check back first.
        $view = $this->as($token, 'POST', '/api/onboarding/mine/change', ['payment' => 'loan'])->body['data'];
        $this->assertSame('loan_check', $view['next']['action']);

        $view = $this->as($token, 'POST', '/api/onboarding/mine/profile', ['name' => 'Chioma Eze', 'area' => 'Ikeja'])->body['data'];
        $this->assertSame('Ikeja', $view['area']);
        $this->assertSame('Chioma Eze', Database::val('SELECT name FROM households WHERE phone = ?', ['+2348145550105']));

        $view = $this->as($token, 'POST', '/api/onboarding/mine/cancel')->body['data'];
        $this->assertSame('cancelled', $view['status']);
        $this->assertSame('restart', $view['next']['action']);
        $this->assertSame(409, $this->call('POST', "/api/onboarding/requests/$id/accept", [], 'admin')->status, 'installers cannot act on a cancelled request');
        $this->as($token, 'POST', '/api/onboarding/mine/answers', ['income_band' => 'high']); // refused: not open
        $view = $this->as($token, 'POST', '/api/onboarding/mine/change', ['payment' => 'cash'])->body['data'];
        $this->assertSame('requested', $view['status'], 'choosing again restarts it');

        // Once the quote is accepted, choices lock; the name can still change.
        $this->call('POST', "/api/onboarding/requests/$id/accept", [], 'admin');
        $this->call('POST', "/api/onboarding/requests/$id/survey", [], 'admin');
        $this->call('POST', "/api/onboarding/requests/$id/quote", ['amount_naira' => 2800000], 'admin');
        $this->as($token, 'POST', '/api/onboarding/mine/accept-quote');
        $this->assertFalse($this->as($token, 'GET', '/api/onboarding/mine')->body['data']['can_change']);
        $this->assertSame(409, $this->as($token, 'POST', '/api/onboarding/mine/change', ['package_id' => $arewa['id']])->status);
        $this->assertSame(409, $this->as($token, 'POST', '/api/onboarding/mine/cancel')->status);
        $this->assertSame(200, $this->as($token, 'POST', '/api/onboarding/mine/profile', ['name' => 'Chioma Okafor-Eze'])->status);
    }

    public function testAFamilyWithSolarCanSwitchInstallerAndGeneratorAnswer(): void
    {
        $token = $this->signUp('0815 555 0106', ['path' => 'have'])['access_token'];
        $this->as($token, 'POST', '/api/onboarding/mine/answers', ['inverter_brand' => 'Deye', 'inverter_serial' => 'SUN8KSG04LP3']);
        $this->as($token, 'POST', '/api/onboarding/mine/answers', ['generator' => 'backup']);
        $installers = $this->catalog()['installers'];
        $this->as($token, 'POST', '/api/onboarding/mine/submit', ['installer_id' => $installers[0]['id']]);
        $id = $this->call('GET', '/api/onboarding/requests', null, 'installer')->body['data']['requests'][0]['id'];
        $this->call('POST', "/api/onboarding/requests/$id/accept", [], 'installer');

        $view = $this->as($token, 'POST', '/api/onboarding/mine/change', ['generator' => 'trade_in'])->body['data'];
        $this->assertSame('trade_in', $view['generator']);
        $this->assertSame('requested', $view['status'], 'the visit is booked again');
        $view = $this->as($token, 'POST', '/api/onboarding/mine/change', ['installer_id' => $installers[2]['id']])->body['data'];
        $this->assertSame('Ikeja PowerHome', $view['installer']['name']);
        $this->assertSame(409, $this->as($token, 'POST', '/api/onboarding/mine/change', ['inverter_serial' => 'INV-SIM-0003'])->status, 'still one inverter per home');
    }

    public function testTheAssistantHelpsAFamilyThatIsStillSigningUp(): void
    {
        $package = $this->catalog()['installers'][0]['packages'][0];
        $token = $this->signUp('0816 555 0107', ['path' => 'need', 'package_id' => $package['id'], 'payment' => 'loan'])['access_token'];
        $r = $this->as($token, 'POST', '/api/assistant/ask', ['message' => 'How does the loan work?', 'lang' => 'en']);
        $this->assertSame(200, $r->status, jenc($r->body));
        $this->assertStringContainsString('Access', $r->body['data']['answer']);
        $r = $this->as($token, 'POST', '/api/assistant/ask', ['message' => 'What should I do now?', 'lang' => 'en']);
        $this->assertStringContainsString('loan check', $r->body['data']['answer']);
    }

    // ----- Telegram -----

    private function bot(): void
    {
        putenv('TELEGRAM_BOT_TOKEN=123456:test-token');
        TelegramService::$send = function (string $method, array $params) {
            $this->sent[] = [$method, $params];
            return ['ok' => true, 'result' => []];
        };
    }

    private function hook(array $update): void
    {
        $update = ['update_id' => ++$this->updateId] + $update;
        $r = $this->kernel->handle(new Request('POST', '/api/telegram/webhook', [], jenc($update), ['X-Telegram-Bot-Api-Secret-Token' => TelegramService::webhookSecret()], '149.154.167.1'));
        $this->assertSame(200, $r->status, jenc($r->body));
    }

    private function tap(string $data, int $chat = 777): array
    {
        $this->hook(['callback_query' => ['id' => 'q' . $this->updateId, 'data' => $data, 'from' => ['id' => $chat], 'message' => ['chat' => ['id' => $chat, 'type' => 'private']]]]);
        return $this->last();
    }

    private function say(string $text, int $chat = 777): array
    {
        $this->hook(['message' => ['message_id' => 1, 'from' => ['id' => $chat, 'first_name' => 'Tunde'], 'chat' => ['id' => $chat, 'type' => 'private'], 'text' => $text]]);
        return $this->last();
    }

    private function last(): array
    {
        $replies = array_values(array_filter($this->sent, fn ($s) => $s[0] === 'sendMessage'));
        return end($replies)[1] ?? [];
    }

    private static function buttons(array $reply): array
    {
        return array_column(array_merge(...($reply['reply_markup']['inline_keyboard'] ?? [[]])), 'callback_data');
    }

    public function testAFamilySignsUpInTelegramAndIsToldEachStep(): void
    {
        $this->bot();
        $this->assertSame(['o:start', 'o:what', 'login'], self::buttons($this->say('/start')));
        $this->assertContains('o:need', self::buttons($this->tap('o:start')));
        $list = $this->tap('o:need');
        $this->assertStringContainsString('Yaba Solar Works', $list['text']);
        $this->assertStringContainsString('₦1,300,000–₦1,600,000', $list['text']);
        $package = (int) substr(self::buttons($list)[1], 6); // Arewa, Family 3.5 kVA
        $card = $this->tap("o:pkg:$package");
        $this->assertStringContainsString('Family 3.5 kVA', $card['text']);
        $this->assertSame(['o:pay:cash', 'o:pay:loan', 'o:need'], self::buttons($card));
        $share = $this->tap('o:pay:loan');
        $this->assertTrue($share['reply_markup']['keyboard'][0][0]['request_contact']);

        // A contact card for someone else proves nothing.
        $this->hook(['message' => ['message_id' => 2, 'from' => ['id' => 777], 'chat' => ['id' => 777, 'type' => 'private'],
            'contact' => ['phone_number' => '2348145550103', 'user_id' => 888]]]);
        $this->assertStringContainsString('your own number', $this->last()['text']);
        $this->hook(['message' => ['message_id' => 3, 'from' => ['id' => 777, 'first_name' => 'Tunde'], 'chat' => ['id' => 777, 'type' => 'private'],
            'contact' => ['phone_number' => '2348145550103', 'user_id' => 777, 'first_name' => 'Tunde']]]);
        $this->assertSame(['o:nm'], self::buttons($this->last()));
        $this->assertContains('o:area:Surulere', self::buttons($this->tap('o:nm')));
        $loan = $this->tap('o:area:Surulere');
        $this->assertSame(['o:inc:low', 'o:inc:mid', 'o:inc:high'], self::buttons($loan), 'account made; loan check next');
        $this->assertSame(1, (int) Database::val("SELECT COUNT(*) FROM telegram_links WHERE chat_id = '777'"));
        $this->assertSame('telegram', Database::val("SELECT channel FROM onboardings o JOIN households h ON h.id = o.household_id WHERE h.phone = '+2348145550103'"));

        $send = $this->tap('o:inc:high');
        $this->assertStringContainsString('Access could lend you up to about ₦3,050,000', $send['text']);
        $tracker = $this->tap('o:send');
        $this->assertStringContainsString('Request sent', $tracker['text']);
        $this->assertStringContainsString('unlock when your home is certified', $tracker['text']);
        $this->assertStringContainsString('audited period', $this->say('How do families get paid?')['text'], 'the AI answers while they wait');

        // The installer acts on the website; the family hears about each step in the chat.
        $id = (int) Database::val("SELECT id FROM onboardings WHERE channel = 'telegram'");
        $this->call('POST', "/api/onboarding/requests/$id/accept", [], 'installer');
        $this->assertStringContainsString('accepted your request', $this->last()['text']);
        $this->call('POST', "/api/onboarding/requests/$id/survey", [], 'installer');
        $this->call('POST', "/api/onboarding/requests/$id/quote", ['amount_naira' => 3400000], 'installer');
        $this->assertStringContainsString('₦3,400,000', $this->last()['text']);
        $this->assertContains('o:accept', self::buttons($this->last()));
        $this->tap('o:accept');
        $this->assertStringContainsString('Access approved your solar loan of ₦1,000,000', $this->last()['text']);
        $this->call('POST', "/api/onboarding/requests/$id/complete", [], 'installer');
        $live = $this->last();
        $this->assertStringContainsString('certified and live', $live['text']);
        $this->assertContains('card:home', self::buttons($live), 'the full menu unlocks');
    }

    public function testAnExistingSolarHomeConnectsInTelegram(): void
    {
        $this->bot();
        $this->tap('o:have', 778);
        $this->tap('o:hgo', 778);
        $this->hook(['message' => ['message_id' => 4, 'from' => ['id' => 778], 'chat' => ['id' => 778, 'type' => 'private'],
            'contact' => ['phone_number' => '+2348165550104', 'user_id' => 778]]]);
        $this->say('Ngozi Eze', 778);
        $this->assertContains('o:brand:Growatt', self::buttons($this->say('Ikorodu', 778)), 'typed area works too');
        $this->assertStringContainsString('serial number', $this->tap('o:brand:Deye', 778)['text']);
        $this->assertStringContainsString('already linked', $this->say('INV-SIM-0007', 778)['text']);
        $this->assertContains('o:gen:trade_in', self::buttons($this->say('SUN-8K-SG04LP3', 778)));
        $installers = self::buttons($this->tap('o:gen:trade_in', 778));
        $this->assertCount(4, $installers);
        $this->assertStringContainsString('Visit requested', $this->tap($installers[2], 778)['text']);
    }

    public function testAFamilyChangesItsMindInTelegram(): void
    {
        $this->bot();
        $list = $this->tap('o:need', 780);
        $package = (int) substr(self::buttons($list)[0], 6);
        $this->tap("o:pkg:$package", 780);
        $this->tap('o:pay:cash', 780);
        $this->hook(['message' => ['message_id' => 6, 'from' => ['id' => 780], 'chat' => ['id' => 780, 'type' => 'private'],
            'contact' => ['phone_number' => '+2348175550108', 'user_id' => 780]]]);
        $this->say('Bisi Ade', 780);
        $this->tap('o:area:Yaba', 780);
        $this->tap('o:send', 780);

        $menu = self::buttons($this->tap('o:chg', 780));
        $this->assertSame(['o:cpkl', 'o:cpay:loan', 'o:prof', 'o:cxl', 'o:track'], $menu);
        $choices = self::buttons($this->tap('o:cpkl', 780));
        $this->assertStringStartsWith('o:cpk:', $choices[0]);
        $this->tap($choices[4], 780);
        $this->assertStringContainsString('Request sent', $this->last()['text']);
        $this->assertSame('Ikeja PowerHome', Database::val('SELECT i.name FROM onboardings o JOIN installers i ON i.id = o.installer_id WHERE o.channel = ?', ['telegram']));

        $this->tap('o:prof', 780);
        $this->say('Bisi Adeyemi', 780);
        $this->assertSame('Bisi Adeyemi', Database::val("SELECT name FROM households WHERE phone = '+2348175550108'"));

        $this->tap('o:cxl', 780);
        $cancelled = $this->tap('o:cxly', 780);
        $this->assertStringStartsWith('o:cpk:', self::buttons($cancelled)[0], 'offers the packages to start again');
        $this->assertContains('o:go', self::buttons($this->tap('o:track', 780)), 'and the tracker has Start again');
        $this->assertStringStartsWith('o:cpk:', self::buttons($this->tap('o:go', 780))[0]);
    }

    public function testANumberWithAnAccountIsAskedForItsPin(): void
    {
        $this->bot();
        $this->tap('o:have', 779);
        $this->tap('o:hgo', 779);
        $this->hook(['message' => ['message_id' => 5, 'from' => ['id' => 779], 'chat' => ['id' => 779, 'type' => 'private'],
            'contact' => ['phone_number' => '+2347000010007', 'user_id' => 779]]]);
        $this->assertStringContainsString('already has a KlimateX account', $this->last()['text']);
        $this->assertSame(0, (int) Database::val('SELECT COUNT(*) FROM onboardings'));
    }
}
