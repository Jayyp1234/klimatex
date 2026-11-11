<?php
/** php scripts/evidence.php  Adds demo meter calibrations and fuel receipts to already-seeded homes. Safe to run repeatedly. */
require dirname(__DIR__) . '/vendor/autoload.php';

App\Config\Env::load(dirname(__DIR__));
$done = App\Services\Evidence\EvidenceService::assignDemo();
echo "meters recorded: {$done['meters']}, fuel receipts added: {$done['receipts']}" . PHP_EOL;
