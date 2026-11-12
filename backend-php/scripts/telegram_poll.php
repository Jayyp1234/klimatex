<?php
/**
 * php scripts/telegram_poll.php
 *
 * Runs the Telegram bot without a public URL: removes the webhook, then long-polls Telegram
 * and hands each update to the same handler the webhook uses. For a laptop demo when the
 * hosted API can't be reached. Stop with Ctrl-C; run scripts/telegram.php afterwards to put
 * the webhook back.
 */
require dirname(__DIR__) . '/vendor/autoload.php';

use App\Services\Telegram\TelegramService;

App\Config\Env::load(dirname(__DIR__));
App\Migrations\Migrator::run();

if (!TelegramService::configured()) {
    fwrite(STDERR, "TELEGRAM_BOT_TOKEN is not set.\n");
    exit(1);
}
$me = TelegramService::api('getMe');
if (!($me['ok'] ?? false)) {
    fwrite(STDERR, "Telegram refused the token.\n");
    exit(1);
}
App\Models\KvStore::set('telegram:bot', $me['result']['username']);
TelegramService::api('deleteWebhook', ['drop_pending_updates' => false]);
echo 'polling as @' . $me['result']['username'] . PHP_EOL;

$bot = new TelegramService();
$offset = 0;
while (true) {
    try {
        $res = App\Services\Bank\Http::call('POST', 'https://api.telegram.org/bot' . App\Config\Settings::telegramToken() . '/getUpdates',
            ['offset' => $offset, 'timeout' => 25, 'allowed_updates' => ['message', 'callback_query']], [], 35)[1] ?? [];
    } catch (Throwable $e) {
        // A dropped connection or timeout: wait a moment and poll again.
        echo date('H:i:s') . ' poll failed (' . get_class($e) . '), retrying' . PHP_EOL;
        sleep(3);
        continue;
    }
    if (!($res['ok'] ?? false)) {
        sleep(2);
        continue;
    }
    foreach ($res['result'] as $update) {
        $offset = $update['update_id'] + 1;
        $kind = isset($update['callback_query']) ? 'button' : 'message';
        try {
            $bot->handle($update, TelegramService::webhookSecret());
            echo date('H:i:s') . " $kind handled" . PHP_EOL;
        } catch (Throwable $e) {
            echo date('H:i:s') . " $kind failed: " . get_class($e) . ' ' . $e->getMessage() . PHP_EOL;
        }
    }
}
