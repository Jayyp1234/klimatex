<?php
/** php scripts/streets.php  Puts already-seeded demo homes on their Surulere streets. Safe to run repeatedly. */
require dirname(__DIR__) . '/vendor/autoload.php';

App\Config\Env::load(dirname(__DIR__));
echo 'homes assigned to a street: ' . App\Services\Street\StreetService::assignDemo() . PHP_EOL;
