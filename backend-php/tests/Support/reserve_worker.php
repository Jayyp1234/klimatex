<?php
// One competing buyer in the concurrency test. argv: start time, buyer name, tonnes
require dirname(__DIR__, 2) . '/vendor/autoload.php';
while (microtime(true) < (float) $argv[1]) {
}
try {
    $order = (new App\Services\Market\MarketService())->createOrder($argv[2], (int) $argv[3]);
    echo 'reserved:' . $order['order'];
} catch (App\Core\HttpException $e) {
    echo 'refused:' . $e->status;
}
