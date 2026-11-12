<?php
/**
 * php scripts/demo_sale.php  A buyer buys the listed credits and pays, so households are paid
 * and linked Telegram chats get their payout alert. For a live demo after `demo.php --no-sale`.
 */
require dirname(__DIR__) . '/vendor/autoload.php';

App\Config\Env::load(dirname(__DIR__));
$result = (new App\Services\Simulator\DemoService())->sell();
$money = $result['settled']['money'] ?? [];
echo 'order ' . ($result['order']['order'] ?? '?') . ': ' . ($result['settled']['status'] ?? '?')
    . (isset($money['received_naira']) ? ', received ₦' . number_format($money['received_naira']) : '') . PHP_EOL;
