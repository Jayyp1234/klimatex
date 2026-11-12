<?php
/**
 * php scripts/telegram.php   Points the Telegram bot at this server and sets its commands.
 * Needs TELEGRAM_BOT_TOKEN. Safe to run again. Never prints the token.
 */
require dirname(__DIR__) . '/vendor/autoload.php';

use App\Config\Settings;
use App\Models\KvStore;
use App\Services\Telegram\TelegramService as T;

App\Config\Env::load(dirname(__DIR__));
if (!T::configured()) {
    fwrite(STDERR, "TELEGRAM_BOT_TOKEN is not set.\n");
    exit(1);
}
$me = T::api('getMe');
if (!($me['ok'] ?? false)) {
    fwrite(STDERR, "Telegram refused the token (getMe failed). Check it with @BotFather.\n");
    exit(1);
}
KvStore::set('telegram:bot', $me['result']['username']);
$url = rtrim(Settings::publicBase(), '/') . '/api/telegram/webhook';
$hook = T::api('setWebhook', ['url' => $url, 'secret_token' => T::webhookSecret(), 'allowed_updates' => ['message', 'callback_query'],
    'drop_pending_updates' => true, 'max_connections' => 5]);
T::api('setMyCommands', ['commands' => [
    ['command' => 'login', 'description' => 'Sign in with your KlimateX phone and PIN, or email'],
    ['command' => 'help', 'description' => 'What I can do'],
    ['command' => 'stop', 'description' => 'Disconnect this chat from your home'],
]]);
T::api('setMyDescription', ['description' => 'KlimateX: ask about your home\'s solar, carbon credits, payouts and loan. Sign in with /login, or connect from the KlimateX app.']);
$info = T::api('getWebhookInfo')['result'] ?? [];
echo 'bot: @' . $me['result']['username'] . PHP_EOL;
echo 'webhook set: ' . (($hook['ok'] ?? false) ? 'yes' : 'NO') . " ($url)" . PHP_EOL;
echo 'pending updates: ' . ($info['pending_update_count'] ?? '?') . ', last error: ' . ($info['last_error_message'] ?? 'none') . PHP_EOL;
