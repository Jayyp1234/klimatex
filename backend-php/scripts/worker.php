<?php
/**
 * Background worker: finishes payouts, requeries pending transfers and expires reservations.
 * Runs as its own Deployment so webhooks can answer inside the sandbox's 10-second limit.
 */
require dirname(__DIR__) . '/vendor/autoload.php';

App\Config\Env::load(dirname(__DIR__));

$market = new App\Services\Market\MarketService();
pcntl_async_signals(true);
$running = true;
foreach ([SIGTERM, SIGINT] as $signal) {
    pcntl_signal($signal, function () use (&$running) { $running = false; });
}

while ($running) {
    try {
        $market->sweep();
    } catch (Throwable $e) {
        error_log('worker: ' . $e->getMessage());
    }
    sleep(3);
}
