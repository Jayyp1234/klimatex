<?php

namespace App\Services\Telegram;

use App\Config\Database;
use App\Config\Settings;
use App\Core\HttpException;
use App\Models\KvStore;
use App\Models\SiteRepository;
use App\Models\UserRepository;
use App\Services\Ai\Assistant;
use App\Services\Auth\AuthService;
use App\Services\Auth\PhoneAuthService;
use App\Services\Bank\Http;
use App\Services\Ai\AssistantTools;
use App\Services\Ai\Transcriber;
use App\Services\Home\HomeService;
use CURLStringFile;
use Closure;
use Throwable;

/**
 * The KlimateX bot on Telegram: the same read-only assistant as the app, for one linked home.
 *
 * Linking, two ways:
 * 1. The household app asks for a one-time code and opens t.me/<bot>?start=<code>.
 *    Telegram sends "/start <code>" to our webhook, and that chat is linked to the home.
 * 2. Sign in inside the chat (/login): the phone number and PIN, or email and password, that the
 *    family uses in the app. The same login services check them, with the same lockout after
 *    repeated failures, and the PIN or password message is deleted from the chat at once.
 * Either way nobody can link a home without proving they can sign in to it.
 *
 * Every webhook call carries a secret header derived from our JWT secret and the bot token;
 * calls without it are refused. Messages are never logged.
 */
final class TelegramService
{
    public const CODE_TTL_SECONDS = 900;
    public const LOGIN_TTL_SECONDS = 600;
    private const HISTORY = 6;
    private const QUICK = ['ask:tips' => 'How can I earn more?'];
    /** Buttons that answer instantly from the records; the old ask: names still work on earlier messages. */
    private const CARDS = ['card:home' => 'home', 'card:payouts' => 'payouts', 'card:audit' => 'audit',
        'ask:payouts' => 'payouts', 'ask:audit' => 'audit'];

    /** The sender's Telegram language, used to pick the chat language when it is linked. */
    private ?string $fromLang = null;

    /** Replaced in tests: fn (string $method, array $params): array */
    public static ?Closure $send = null;

    public function __construct(
        private ?Assistant $assistant = null,
        private SiteRepository $sites = new SiteRepository(),
        private UserRepository $users = new UserRepository(),
    ) {
    }

    public static function configured(): bool
    {
        return Settings::telegramToken() !== '';
    }

    /** The value Telegram must send in X-Telegram-Bot-Api-Secret-Token. */
    public static function webhookSecret(): string
    {
        return substr(hash_hmac('sha256', 'telegram-webhook:' . Settings::telegramToken(), Settings::jwtSecret()), 0, 48);
    }

    public static function botUsername(): string
    {
        return Settings::telegramBot() ?: (KvStore::get('telegram:bot') ?? '');
    }

    /** One Bot API call. Failures come back as ['ok' => false]; they never reach the family's request. */
    public static function api(string $method, array $params = []): array
    {
        if (self::$send) {
            return (self::$send)($method, $params);
        }
        try {
            [, $body] = Http::call('POST', 'https://api.telegram.org/bot' . Settings::telegramToken() . "/$method", $params, [], 20);
            return $body;
        } catch (Throwable $e) {
            error_log("telegram: $method failed: " . get_class($e));
            return ['ok' => false];
        }
    }

    /** Sends a file (multipart). Same failure rule as api(). */
    public static function upload(string $method, array $params, string $field, string $filename, string $bytes, string $mime): array
    {
        if (self::$send) {
            return (self::$send)($method, $params + [$field => ['filename' => $filename, 'bytes' => strlen($bytes), 'mime' => $mime]]);
        }
        try {
            $fields = array_map(fn ($v) => is_array($v) ? jenc($v) : (string) $v, $params);
            $fields[$field] = new CURLStringFile($bytes, $filename, $mime);
            $ch = curl_init('https://api.telegram.org/bot' . Settings::telegramToken() . "/$method");
            curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $fields, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 40]);
            $raw = curl_exec($ch);
            curl_close($ch);
            return is_string($raw) ? (json_decode($raw, true) ?? ['ok' => false]) : ['ok' => false];
        } catch (Throwable $e) {
            error_log("telegram: $method upload failed: " . get_class($e));
            return ['ok' => false];
        }
    }

    /**
     * Tells every chat linked to this home that a payout has landed. Called after the money moved;
     * a failure here is logged and never touches the payout.
     *
     * @param string $where loan, wallet or bank
     */
    public static function notifyPayout(int $siteId, int $kobo, string $where): void
    {
        if (!self::configured()) {
            return;
        }
        try {
            $householdId = (int) Database::val('SELECT household_id FROM sites WHERE id = ?', [$siteId]);
            foreach (Database::all('SELECT chat_id, user_id, lang FROM telegram_links WHERE household_id = ?', [$householdId]) as $chat) {
                $name = explode(' ', (new UserRepository())->find((int) $chat['user_id'])['name'] ?? '')[0];
                self::api('sendMessage', ['chat_id' => $chat['chat_id'], 'reply_markup' => self::menu($chat['lang']),
                    'text' => BotText::t($chat['lang'], "alert_$where", $name, BotCards::naira($kobo / 100))]);
            }
        } catch (Throwable $e) {
            error_log('telegram: payout alert failed: ' . get_class($e));
        }
    }

    // ----- Household app side -----

    public function status(array $user): array
    {
        $householdId = (int) ($user['household_id'] ?? 0);
        $chats = (int) Database::val('SELECT COUNT(*) FROM telegram_links WHERE household_id = ?', [$householdId]);
        return ['configured' => self::configured() && self::botUsername() !== '', 'bot' => self::botUsername() ?: null, 'linked_chats' => $chats];
    }

    public function createLink(array $user): array
    {
        if (!self::configured() || self::botUsername() === '') {
            throw new HttpException(503, 'The Telegram bot is not switched on yet.');
        }
        $householdId = (int) ($user['household_id'] ?? 0);
        if (!$householdId || !$this->sites->idForHousehold($householdId)) {
            throw new HttpException(404, 'No home is linked to this account yet.');
        }
        $code = rtrim(strtr(base64_encode(random_bytes(18)), '+/', '-_'), '=');
        Database::run('DELETE FROM telegram_codes WHERE expires_at < ?', [time()]);
        Database::insert('telegram_codes', ['code' => $code, 'user_id' => (int) $user['id'], 'household_id' => $householdId,
            'expires_at' => time() + self::CODE_TTL_SECONDS], '');
        return ['url' => 'https://t.me/' . self::botUsername() . "?start=$code", 'bot' => self::botUsername(), 'expires_in' => self::CODE_TTL_SECONDS];
    }

    public function unlinkAll(array $user): array
    {
        $chats = Database::all('SELECT chat_id FROM telegram_links WHERE household_id = ?', [(int) ($user['household_id'] ?? 0)]);
        Database::run('DELETE FROM telegram_links WHERE household_id = ?', [(int) ($user['household_id'] ?? 0)]);
        foreach ($chats as $chat) {
            self::api('sendMessage', ['chat_id' => $chat['chat_id'], 'text' => 'This chat was disconnected from your KlimateX home in the app.']);
        }
        return ['linked_chats' => 0];
    }

    // ----- Webhook -----

    public function handle(array $update, string $secret): void
    {
        if (!self::configured()) {
            throw new HttpException(404, 'Not found.');
        }
        if (!hash_equals(self::webhookSecret(), $secret)) {
            throw new HttpException(403, 'Forbidden.');
        }
        $updateId = $update['update_id'] ?? null;
        if (!is_int($updateId) || !Database::insertIgnore('telegram_updates', ['update_id' => $updateId, 'received_at' => now_iso()])) {
            return; // a retry of an update already handled
        }

        if (isset($update['callback_query'])) {
            $query = $update['callback_query'];
            self::api('answerCallbackQuery', ['callback_query_id' => (string) ($query['id'] ?? '')]);
            $this->fromLang = $query['from']['language_code'] ?? null;
            $chat = $query['message']['chat'] ?? null;
            if (($chat['type'] ?? '') === 'private') {
                $this->onButton((string) $chat['id'], (string) ($query['data'] ?? ''));
            }
            return;
        }
        $message = $update['message'] ?? null;
        if (!$message || ($message['chat']['type'] ?? '') !== 'private') {
            return;
        }
        $chatId = (string) $message['chat']['id'];
        $this->fromLang = $message['from']['language_code'] ?? null;
        if (isset($message['contact'])) {
            $this->onContact($chatId, $message);
            return;
        }
        if (isset($message['voice']) || isset($message['audio'])) {
            $this->onVoice($chatId, $message['voice'] ?? $message['audio']);
            return;
        }
        $text = trim((string) ($message['text'] ?? ''));
        if ($text === '') {
            $link = $this->link($chatId);
            $this->reply($chatId, BotText::t($link['lang'] ?? 'en', 'text_only'), $link);
            return;
        }
        $this->onText($chatId, $text, (int) ($message['message_id'] ?? 0));
    }

    private function onText(string $chatId, string $text, int $messageId = 0): void
    {
        if (preg_match('~^/start(?:@\w+)?(?:\s+([A-Za-z0-9_-]{8,64}))?$~', $text, $m)) {
            $this->start($chatId, $m[1] ?? null);
            return;
        }
        if (preg_match('~^/(stop|unlink)(?:@\w+)?$~', $text)) {
            Database::run('DELETE FROM telegram_links WHERE chat_id = ?', [$chatId]);
            $this->reply($chatId, 'Disconnected. Your home\'s details are no longer available in this chat. To connect again, use Connect Telegram in the KlimateX app.');
            return;
        }
        if (preg_match('~^/(login|signin)(?:@\w+)?$~', $text)) {
            $this->startLogin($chatId);
            return;
        }
        if (preg_match('~^/cancel(?:@\w+)?$~', $text)) {
            $this->clearLogin($chatId);
            $this->reply($chatId, 'Cancelled.', $this->link($chatId), ['remove_keyboard' => true]);
            return;
        }
        if ($this->loginState($chatId)) {
            $this->continueLogin($chatId, $text, $messageId);
            return;
        }
        $link = $this->link($chatId);
        if (!$link) {
            $this->notLinked($chatId);
            return;
        }
        if (preg_match('~^/help(?:@\w+)?$~', $text)) {
            $this->reply($chatId, BotText::t($link['lang'], 'help'), $link);
            return;
        }
        $this->answer($chatId, $link, $text);
    }

    private function onButton(string $chatId, string $data): void
    {
        if ($data === 'login') {
            $this->startLogin($chatId);
            return;
        }
        $link = $this->link($chatId);
        if (!$link) {
            $this->notLinked($chatId);
            return;
        }
        if ($data === 'langs') {
            $current = $link['lang'];
            $button = fn ($code) => ['text' => ($code === $current ? '✓ ' : '') . BotText::LANGS[$code], 'callback_data' => "lang:$code"];
            $this->reply($chatId, BotText::t($current, 'pick_lang'), null,
                ['inline_keyboard' => [[$button('en'), $button('pcm')], [$button('yo'), $button('ig'), $button('ha')]]]);
            return;
        }
        if (str_starts_with($data, 'lang:') && isset(BotText::LANGS[substr($data, 5)])) {
            $lang = substr($data, 5);
            Database::run('UPDATE telegram_links SET lang = ? WHERE chat_id = ?', [$lang, $chatId]);
            KvStore::set("telegram:history:$chatId", '[]'); // earlier answers were in the old language
            $link['lang'] = $lang;
            $this->reply($chatId, BotText::t($lang, 'lang_set'), $link);
            return;
        }
        if (isset(self::CARDS[$data])) {
            $siteId = (int) $this->sites->idForHousehold((int) $link['household_id']);
            $cards = new BotCards(new AssistantTools($siteId), $link['lang']);
            $this->reply($chatId, $cards->{self::CARDS[$data]}(), $link, null, true);
            return;
        }
        if ($data === 'cert') {
            $this->sendCertificate($chatId, $link);
            return;
        }
        if ($data === 'msg') {
            $siteId = $this->sites->idForHousehold((int) $link['household_id']);
            try {
                $text = (new HomeService())->message((int) $siteId, $link['lang'])['text'];
            } catch (HttpException $e) {
                $text = $e->getMessage();
            }
            $this->reply($chatId, $text, $link);
            return;
        }
        if (isset(self::QUICK[$data])) {
            $this->answer($chatId, $link, self::QUICK[$data]);
        }
    }

    /** A voice note: transcribe it, show what was heard, then answer it like a typed question. */
    private function onVoice(string $chatId, array $voice): void
    {
        $link = $this->link($chatId);
        if (!$link) {
            $this->notLinked($chatId);
            return;
        }
        $lang = $link['lang'];
        if (!Transcriber::configured()) {
            $this->reply($chatId, BotText::t($lang, 'voice_off'), $link);
            return;
        }
        if ((int) ($voice['duration'] ?? 0) > 120) {
            $this->reply($chatId, BotText::t($lang, 'voice_long'), $link);
            return;
        }
        self::api('sendChatAction', ['chat_id' => $chatId, 'action' => 'typing']);
        $path = self::api('getFile', ['file_id' => (string) ($voice['file_id'] ?? '')])['result']['file_path'] ?? null;
        $audio = $path ? self::download($path) : null;
        $text = $audio ? Transcriber::transcribe($audio, $lang, basename($path)) : null;
        if ($text === null) {
            $this->reply($chatId, BotText::t($lang, 'voice_unclear'), $link);
            return;
        }
        $this->reply($chatId, BotText::t($lang, 'voice_heard', mb_substr($text, 0, 300)));
        $this->answer($chatId, $link, $text);
    }

    /** A file the family sent, fetched from Telegram (voice notes are well under the 20 MB limit). */
    public static function download(string $path): ?string
    {
        if (self::$send) {
            return (self::$send)('downloadFile', ['path' => $path])['bytes'] ?? null;
        }
        try {
            $ch = curl_init('https://api.telegram.org/file/bot' . Settings::telegramToken() . '/' . $path);
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30, CURLOPT_FOLLOWLOCATION => false]);
            $bytes = curl_exec($ch);
            $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            curl_close($ch);
            return is_string($bytes) && $status === 200 && strlen($bytes) < 20_000_000 ? $bytes : null;
        } catch (Throwable $e) {
            error_log('telegram: download failed: ' . get_class($e));
            return null;
        }
    }

    private function sendCertificate(string $chatId, array $link): void
    {
        self::api('sendChatAction', ['chat_id' => $chatId, 'action' => 'upload_document']);
        $homes = new HomeService();
        $siteId = (int) $this->sites->idForHousehold((int) $link['household_id']);
        try {
            $c = $homes->certificate($siteId);
            $pdf = CertificatePdf::render($c, $homes->detail($siteId), $homes->alerts($siteId)['data_as_of'] ?? null);
        } catch (HttpException $e) {
            $this->reply($chatId, $e->getMessage(), $link);
            return;
        }
        self::upload('sendDocument', ['chat_id' => $chatId, 'reply_markup' => self::menu($link['lang']),
            'caption' => BotText::t($link['lang'], 'cert_caption', $c['household'], $c['grade_before'], $c['grade_now'])],
            'document', $c['certificate'] . '.pdf', $pdf, 'application/pdf');
    }

    private function start(string $chatId, ?string $code): void
    {
        if ($code === null) {
            $link = $this->link($chatId);
            $link ? $this->reply($chatId, BotText::t($link['lang'], 'ready'), $link) : $this->notLinked($chatId);
            return;
        }
        $row = Database::tx(function () use ($code) {
            $row = Database::one('SELECT * FROM telegram_codes WHERE code = ?', [$code]);
            if (!$row || $row['used_at'] !== null || (int) $row['expires_at'] < time()) {
                return null;
            }
            Database::run('UPDATE telegram_codes SET used_at = ? WHERE code = ? AND used_at IS NULL', [now_iso(), $code]);
            return $row;
        });
        if (!$row) {
            $this->reply($chatId, 'That link has expired or was already used. Open the KlimateX app and tap Connect Telegram again.');
            return;
        }
        $this->connect($chatId, (int) $row['user_id'], (int) $row['household_id']);
    }

    private function connect(string $chatId, int $userId, int $householdId): void
    {
        Database::run('DELETE FROM telegram_links WHERE chat_id = ?', [$chatId]);
        Database::insert('telegram_links', ['chat_id' => $chatId, 'user_id' => $userId, 'household_id' => $householdId,
            'lang' => BotText::lang($this->fromLang), 'linked_at' => now_iso()], '');
        $link = $this->link($chatId);
        $siteId = $this->sites->idForHousehold($householdId);
        $name = $this->users->find($userId)['name'] ?? 'there';
        $this->reply($chatId, BotText::t($link['lang'], 'connected', $name, sprintf('KX-%04d', (int) $siteId)), $link);
    }

    // ----- Sign in inside the chat -----

    private function startLogin(string $chatId): void
    {
        $this->saveLogin($chatId, ['step' => 'id']);
        $this->reply($chatId, 'Sign in with the details you use in the KlimateX app. Send your phone number (like 0803 123 4567) or your email address, or tap Share my phone number below. Send /cancel to stop.',
            null, ['keyboard' => [[['text' => 'Share my phone number', 'request_contact' => true]]], 'resize_keyboard' => true, 'one_time_keyboard' => true]);
    }

    private function onContact(string $chatId, array $message): void
    {
        $contact = $message['contact'];
        if (!$this->loginState($chatId)) {
            $this->startLogin($chatId);
            return;
        }
        // Only the sender's own number counts; a forwarded contact card proves nothing.
        if ((string) ($contact['user_id'] ?? '') !== (string) ($message['from']['id'] ?? '-')) {
            $this->reply($chatId, 'Please share your own number with the button, or type it.');
            return;
        }
        $this->continueLogin($chatId, (string) ($contact['phone_number'] ?? ''), 0);
    }

    private function continueLogin(string $chatId, string $text, int $messageId): void
    {
        $state = $this->loginState($chatId);
        if ($state['step'] === 'id') {
            if (str_contains($text, '@')) {
                $this->saveLogin($chatId, ['step' => 'secret', 'kind' => 'email', 'id' => strtolower(trim($text))]);
                $this->reply($chatId, 'Now send your KlimateX password. I\'ll delete it from this chat straight away.', null, ['remove_keyboard' => true]);
                return;
            }
            try {
                $phone = PhoneAuthService::normalise($text);
            } catch (HttpException $e) {
                $this->reply($chatId, 'That doesn\'t look like a phone number or email. Send the 11-digit number you use in the app, like 0803 123 4567, or your email.');
                return;
            }
            $this->saveLogin($chatId, ['step' => 'secret', 'kind' => 'phone', 'id' => $phone]);
            $this->reply($chatId, 'Now send your 4-digit KlimateX PIN. I\'ll delete it from this chat straight away.', null, ['remove_keyboard' => true]);
            return;
        }

        if ($messageId) {
            self::api('deleteMessage', ['chat_id' => $chatId, 'message_id' => $messageId]);
        }
        try {
            $session = $state['kind'] === 'phone'
                ? (new PhoneAuthService())->login($state['id'], $text, 'telegram')
                : (new AuthService())->login($state['id'], $text, 'telegram');
        } catch (HttpException $e) {
            $tip = $state['kind'] === 'phone' ? ' Send your PIN again, or /cancel.' : ' Send your password again, or /cancel.';
            $this->reply($chatId, $e->getMessage() . ($e->getCode() === 429 ? '' : $tip));
            if ($e->getCode() === 429) {
                $this->clearLogin($chatId);
            }
            return;
        }
        $this->clearLogin($chatId);
        $user = $session['user'];
        if ($user['role'] !== 'household' || !$user['household_id']) {
            $this->reply($chatId, 'You\'re signed in, but this chat is for families with a KlimateX home. Staff accounts use the web dashboard.');
            return;
        }
        $this->connect($chatId, (int) $user['id'], (int) $user['household_id']);
    }

    private function loginState(string $chatId): ?array
    {
        $state = jdec(KvStore::get("telegram:login:$chatId") ?? '') ?: null;
        return $state && ($state['exp'] ?? 0) >= time() ? $state : null;
    }

    private function saveLogin(string $chatId, array $state): void
    {
        KvStore::set("telegram:login:$chatId", jenc($state + ['exp' => time() + self::LOGIN_TTL_SECONDS]));
    }

    private function clearLogin(string $chatId): void
    {
        KvStore::set("telegram:login:$chatId", '{}');
    }

    private function answer(string $chatId, array $link, string $text): void
    {
        $user = $this->users->find((int) $link['user_id']);
        if (!$user || (int) $user['household_id'] !== (int) $link['household_id']) {
            Database::run('DELETE FROM telegram_links WHERE chat_id = ?', [$chatId]);
            $this->notLinked($chatId);
            return;
        }
        self::api('sendChatAction', ['chat_id' => $chatId, 'action' => 'typing']);
        $historyKey = "telegram:history:$chatId";
        $history = jdec(KvStore::get($historyKey) ?? '[]') ?: [];
        try {
            $reply = ($this->assistant ?? new Assistant())->ask($user, ['message' => mb_substr($text, 0, Assistant::MAX_MESSAGE), 'lang' => $link['lang'], 'history' => $history]);
            $answer = $reply['answer'];
            $history = array_slice([...$history, ['role' => 'user', 'content' => $text], ['role' => 'assistant', 'content' => $answer]], -self::HISTORY);
            KvStore::set($historyKey, jenc($history));
        } catch (HttpException $e) {
            $answer = $e->getMessage();
        }
        $this->reply($chatId, $answer, $link);
    }

    private function notLinked(string $chatId): void
    {
        $this->reply($chatId, 'Welcome to KlimateX. To connect your home, tap Sign in below (or send /login) and use the phone number and PIN, or email and password, you use in the KlimateX app. You can also tap Connect Telegram in the app.',
            null, ['inline_keyboard' => [[['text' => 'Sign in', 'callback_data' => 'login']]]]);
    }

    private function link(string $chatId): ?array
    {
        return Database::one('SELECT * FROM telegram_links WHERE chat_id = ?', [$chatId]);
    }

    /** Plain text by default (no Markdown parsing); cards are Telegram HTML. The menu comes along once the chat is linked. */
    private function reply(string $chatId, string $text, ?array $link = null, ?array $markup = null, bool $html = false): void
    {
        $params = ['chat_id' => $chatId, 'text' => mb_substr($text, 0, 4000), 'disable_web_page_preview' => true];
        if ($html) {
            $params['parse_mode'] = 'HTML';
        }
        if ($markup !== null && !($link && isset($markup['remove_keyboard']))) {
            $params['reply_markup'] = $markup;
        } elseif ($link) {
            $params['reply_markup'] = self::menu($link['lang']);
        }
        self::api('sendMessage', $params);
    }

    private static function menu(string $lang): array
    {
        $b = fn (string $key, string $data) => ['text' => BotText::t($lang, $key), 'callback_data' => $data];
        return ['inline_keyboard' => [
            [$b('btn_home', 'card:home'), $b('btn_payouts', 'card:payouts')],
            [$b('btn_tips', 'ask:tips'), $b('btn_audit', 'card:audit')],
            [$b('btn_cert', 'cert'), $b('btn_msg', 'msg')],
            [$b('btn_lang', 'langs')],
        ]];
    }
}
