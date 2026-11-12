<?php

namespace Tests\Integration;

use App\Config\Database;
use App\Core\Request;
use App\Services\Simulator\Simulator;
use App\Services\Telegram\TelegramService;
use Tests\Support\ApiTestCase;

final class TelegramTest extends ApiTestCase
{
    private array $sent = [];
    private int $updateId = 1000;
    private string $audio = '';

    protected function setUp(): void
    {
        parent::setUp();
        putenv('TELEGRAM_BOT_TOKEN=123456:test-token');
        putenv('TELEGRAM_BOT_USERNAME=KlimateXTestBot');
        TelegramService::$send = function (string $method, array $params) {
            $this->sent[] = [$method, $params];
            return ['ok' => true, 'result' => []];
        };
        Simulator::seed();
        $this->assertSame(200, $this->call('POST', '/api/demo/run', null, 'admin')->status);
    }

    protected function tearDown(): void
    {
        TelegramService::$send = null;
        putenv('TELEGRAM_BOT_TOKEN');
        putenv('TELEGRAM_BOT_USERNAME');
        parent::tearDown();
    }

    private function hook(array $update, ?string $secret = null, ?int $id = null): int
    {
        $update = ['update_id' => $id ?? ++$this->updateId] + $update;
        $headers = ['X-Telegram-Bot-Api-Secret-Token' => $secret ?? TelegramService::webhookSecret()];
        return $this->kernel->handle(new Request('POST', '/api/telegram/webhook', [], jenc($update), $headers, '149.154.167.1'))->status;
    }

    private function text(string $text, int $chat = 555, string $type = 'private'): int
    {
        return $this->hook(['message' => ['message_id' => 1, 'chat' => ['id' => $chat, 'type' => $type], 'text' => $text]]);
    }

    private function lastReply(): array
    {
        $replies = array_values(array_filter($this->sent, fn ($s) => $s[0] === 'sendMessage'));
        return end($replies)[1] ?? [];
    }

    private function linkCode(): string
    {
        $link = $this->call('POST', '/api/telegram/link', null, 'household');
        $this->assertSame(200, $link->status, jenc($link->body));
        $this->assertStringStartsWith('https://t.me/KlimateXTestBot?start=', $link->body['data']['url']);
        return substr($link->body['data']['url'], strlen('https://t.me/KlimateXTestBot?start='));
    }

    public function testAFamilyLinksWithOneTapAndAsksQuestions(): void
    {
        $code = $this->linkCode();
        $this->assertSame(200, $this->text("/start $code"));
        $this->assertStringContainsString('KX-0012', $this->lastReply()['text']);
        $this->assertArrayHasKey('inline_keyboard', $this->lastReply()['reply_markup']);
        $this->assertSame(1, $this->call('GET', '/api/telegram', null, 'household')->body['data']['linked_chats']);

        $this->text('How can I earn more?');
        $this->assertStringContainsString('fuel receipts', $this->lastReply()['text']);
        $this->assertContains('sendChatAction', array_column($this->sent, 0), 'shows typing while it thinks');

        $this->hook(['callback_query' => ['id' => 'cb1', 'data' => 'ask:payouts', 'message' => ['chat' => ['id' => 555, 'type' => 'private']]]]);
        $this->assertStringContainsString('₦', $this->lastReply()['text']);
        $this->assertContains('answerCallbackQuery', array_column($this->sent, 0));

        $this->hook(['callback_query' => ['id' => 'cb2', 'data' => 'lang:pcm', 'message' => ['chat' => ['id' => 555, 'type' => 'private']]]]);
        $this->assertSame('pcm', Database::val("SELECT lang FROM telegram_links WHERE chat_id = '555'"));

        $this->text('/stop');
        $this->assertSame(0, (int) Database::val('SELECT COUNT(*) FROM telegram_links'));
        $this->text('How much have I been paid?');
        $this->assertStringContainsString('Connect Telegram', $this->lastReply()['text'], 'an unlinked chat sees nothing about the home');
    }

    public function testCodesWorkOnceAndOnlyWithTheSecret(): void
    {
        $code = $this->linkCode();
        $this->assertSame(403, $this->hook(['message' => ['chat' => ['id' => 9, 'type' => 'private'], 'text' => "/start $code"]], 'wrong-secret'));
        $this->assertSame(0, (int) Database::val('SELECT COUNT(*) FROM telegram_links'));

        $this->text("/start $code", 777);
        $this->text("/start $code", 888);
        $this->assertStringContainsString('expired or was already used', $this->lastReply()['text']);
        $this->assertSame(['777'], array_column(Database::all('SELECT chat_id FROM telegram_links'), 'chat_id'));

        Database::run('UPDATE telegram_codes SET expires_at = ?', [time() - 1]);
        $stale = $this->linkCode();
        Database::run('UPDATE telegram_codes SET expires_at = ? WHERE code = ?', [time() - 1, $stale]);
        $this->text("/start $stale", 999);
        $this->assertStringContainsString('expired', $this->lastReply()['text']);
    }

    public function testRetriesAndGroupChatsAreIgnored(): void
    {
        $code = $this->linkCode();
        $this->hook(['message' => ['chat' => ['id' => 555, 'type' => 'private'], 'text' => "/start $code"]], null, 42);
        $before = count($this->sent);
        $this->hook(['message' => ['chat' => ['id' => 555, 'type' => 'private'], 'text' => 'How can I earn more?']], null, 42);
        $this->assertSame($before, count($this->sent), 'the same update_id is handled once');

        $this->text('How much have I been paid?', -100123, 'group');
        $this->assertSame($before, count($this->sent), 'group chats get nothing');
    }

    public function testTheBotIsOffWithoutAToken(): void
    {
        putenv('TELEGRAM_BOT_TOKEN');
        $this->assertSame(404, $this->hook(['message' => ['chat' => ['id' => 1, 'type' => 'private'], 'text' => '/start']]));
        $this->assertSame(503, $this->call('POST', '/api/telegram/link', null, 'household')->status);
        $this->assertFalse($this->call('GET', '/api/telegram', null, 'household')->body['data']['configured']);
    }

    public function testAFamilySignsInInsideTheChatWithEmailAndPassword(): void
    {
        $this->text('/login', 600);
        $this->assertStringContainsString('phone number', $this->lastReply()['text']);
        $this->text('adaeze@demo.klimatex.test', 600);
        $this->assertStringContainsString('password', $this->lastReply()['text']);

        $this->hook(['message' => ['message_id' => 41, 'chat' => ['id' => 600, 'type' => 'private'], 'text' => 'wrong-password']]);
        $this->assertContains(['deleteMessage', ['chat_id' => '600', 'message_id' => 41]], $this->sent, 'the password message is removed from the chat');
        $this->assertSame(0, (int) Database::val("SELECT COUNT(*) FROM telegram_links WHERE chat_id = '600'"));

        $this->text(self::PASSWORD, 600);
        $this->assertStringContainsString('Hi Adaeze', $this->lastReply()['text']);
        $this->assertSame(1, (int) Database::val("SELECT COUNT(*) FROM telegram_links WHERE chat_id = '600'"));
    }

    public function testAFamilySignsInWithTheirSharedPhoneNumberAndPin(): void
    {
        Database::run("UPDATE users SET phone = '+2348031234567', pin_hash = ? WHERE email = 'adaeze@demo.klimatex.test'", [password_hash('4826', PASSWORD_DEFAULT)]);
        $this->text('/login', 601);
        // A forwarded contact card is refused: only the sender's own number counts.
        $this->hook(['message' => ['message_id' => 2, 'from' => ['id' => 601], 'chat' => ['id' => 601, 'type' => 'private'],
            'contact' => ['phone_number' => '2348031234567', 'user_id' => 999]]]);
        $this->assertStringContainsString('your own number', $this->lastReply()['text']);

        $this->hook(['message' => ['message_id' => 3, 'from' => ['id' => 601], 'chat' => ['id' => 601, 'type' => 'private'],
            'contact' => ['phone_number' => '2348031234567', 'user_id' => 601]]]);
        $this->assertStringContainsString('PIN', $this->lastReply()['text']);
        $this->text('4826', 601);
        $this->assertStringContainsString('Hi Adaeze', $this->lastReply()['text']);
    }

    public function testStaffAccountsCannotLinkAChat(): void
    {
        $this->text('/login', 602);
        $this->text('installer@demo.klimatex.test', 602);
        $this->text(self::PASSWORD, 602);
        $this->assertStringContainsString('families', $this->lastReply()['text']);
        $this->assertSame(0, (int) Database::val("SELECT COUNT(*) FROM telegram_links WHERE chat_id = '602'"));
    }

    public function testTheWelcomeOffersSignIn(): void
    {
        $this->text('hello', 603);
        $this->assertSame('login', $this->lastReply()['reply_markup']['inline_keyboard'][0][0]['callback_data']);
    }

    private function button(string $data, int $chat = 555): void
    {
        $this->hook(['callback_query' => ['id' => 'cb', 'data' => $data, 'from' => ['id' => $chat], 'message' => ['chat' => ['id' => $chat, 'type' => 'private']]]]);
    }

    public function testTheMenuCardsAndLanguagesWork(): void
    {
        $code = $this->linkCode();
        $this->hook(['message' => ['message_id' => 1, 'from' => ['id' => 555, 'language_code' => 'yo'], 'chat' => ['id' => 555, 'type' => 'private'], 'text' => "/start $code"]]);
        $this->assertSame('yo', Database::val("SELECT lang FROM telegram_links WHERE chat_id = '555'"), 'a Yoruba phone starts in Yoruba');
        $this->assertStringContainsString('Ẹ n lẹ́ o', $this->lastReply()['text']);
        $this->assertSame('🏠 Ilé mi', $this->lastReply()['reply_markup']['inline_keyboard'][0][0]['text']);

        $this->button('card:home');
        $card = $this->lastReply();
        $this->assertSame('HTML', $card['parse_mode']);
        $this->assertStringContainsString('Ipele agbára', $card['text']);
        $this->assertMatchesRegularExpression('/[▁▂▃▄▅▆▇█]{3,}/u', $card['text'], 'a month-by-month solar chart');

        $this->button('langs');
        $this->assertCount(2, $this->lastReply()['reply_markup']['inline_keyboard']);
        $this->button('lang:ha');
        $this->assertStringContainsString('Hausa', $this->lastReply()['text']);
        $this->button('card:payouts');
        $this->assertStringContainsString('Kuɗinka', $this->lastReply()['text']);
        $this->assertStringContainsString('₦', $this->lastReply()['text']);
        $this->button('card:audit');
        $this->assertStringContainsString('9/9', $this->lastReply()['text']);
    }

    public function testTheCertificateArrivesAsAPdf(): void
    {
        $this->text('/start ' . $this->linkCode());
        $this->button('cert');
        $docs = array_values(array_filter($this->sent, fn ($s) => $s[0] === 'sendDocument'));
        $this->assertCount(1, $docs);
        $this->assertSame('application/pdf', $docs[0][1]['document']['mime']);
        $this->assertStringStartsWith('KX-HEC-', $docs[0][1]['document']['filename']);
        $this->assertGreaterThan(5000, $docs[0][1]['document']['bytes']);

        $homes = new \App\Services\Home\HomeService();
        $siteId = (int) Database::val('SELECT id FROM sites WHERE household_id = (SELECT household_id FROM users WHERE email = ?)', ['adaeze@demo.klimatex.test']);
        $pdf = \App\Services\Telegram\CertificatePdf::render($homes->certificate($siteId), $homes->detail($siteId), '2026-06-30');
        $this->assertStringStartsWith('%PDF-1.4', $pdf);
        $this->assertStringEndsWith("%%EOF\n", $pdf);
        $this->assertStringContainsString('Home Energy Certificate', $pdf);
        $this->assertStringContainsString('valid to 30 Jun 2027', $pdf);
    }

    public function testAPayoutPingsTheLinkedChat(): void
    {
        $this->text('/start ' . $this->linkCode());
        $siteId = (int) Database::val('SELECT site_id FROM payouts WHERE role = ? LIMIT 1', ['household']);
        Database::run("UPDATE telegram_links SET household_id = (SELECT household_id FROM sites WHERE id = ?), lang = 'pcm'", [$siteId]);
        TelegramService::notifyPayout($siteId, 305400, 'loan');
        $this->assertStringContainsString('₦3,054', $this->lastReply()['text']);
        $this->assertStringContainsString('solar loan', $this->lastReply()['text']);
        $this->assertStringContainsString('Better news', $this->lastReply()['text']);
    }

    public function testAVoiceNoteIsTranscribedAndAnswered(): void
    {
        $this->text('/start ' . $this->linkCode());
        $heard = [];
        \App\Services\Ai\Transcriber::$fake = function (string $audio, string $lang) use (&$heard) {
            $heard[] = [$audio, $lang];
            return $audio === 'OggS-silence' ? null : 'How can I earn more?';
        };
        TelegramService::$send = function (string $method, array $params) {
            $this->sent[] = [$method, $params];
            return match ($method) {
                'getFile' => ['ok' => true, 'result' => ['file_path' => 'voice/file_7.oga']],
                'downloadFile' => ['bytes' => $this->audio],
                default => ['ok' => true, 'result' => []],
            };
        };
        try {
            $this->audio = 'OggS-voice';
            $this->hook(['message' => ['message_id' => 9, 'from' => ['id' => 555], 'chat' => ['id' => 555, 'type' => 'private'],
                'voice' => ['file_id' => 'abc', 'duration' => 4, 'mime_type' => 'audio/ogg']]]);
            $replies = array_values(array_filter($this->sent, fn ($s) => $s[0] === 'sendMessage'));
            $this->assertStringContainsString('I heard: “How can I earn more?”', $replies[count($replies) - 2][1]['text']);
            $this->assertStringContainsString('fuel receipts', $this->lastReply()['text'], 'then it answers the question');
            $this->assertSame([['OggS-voice', 'en']], $heard);

            $this->audio = 'OggS-silence';
            $this->hook(['message' => ['message_id' => 10, 'from' => ['id' => 555], 'chat' => ['id' => 555, 'type' => 'private'], 'voice' => ['file_id' => 'abd', 'duration' => 2]]]);
            $this->assertStringContainsString("couldn't make out", $this->lastReply()['text']);

            $this->hook(['message' => ['message_id' => 11, 'from' => ['id' => 555], 'chat' => ['id' => 555, 'type' => 'private'], 'voice' => ['file_id' => 'abe', 'duration' => 300]]]);
            $this->assertStringContainsString('under 2 minutes', $this->lastReply()['text']);
        } finally {
            \App\Services\Ai\Transcriber::$fake = null;
        }
    }

    public function testVoiceNotesSayTheyAreOffWithoutAServer(): void
    {
        $this->text('/start ' . $this->linkCode());
        $this->hook(['message' => ['message_id' => 9, 'from' => ['id' => 555], 'chat' => ['id' => 555, 'type' => 'private'], 'voice' => ['file_id' => 'abc', 'duration' => 4]]]);
        $this->assertStringContainsString("can't listen to voice notes", $this->lastReply()['text']);
    }
}
