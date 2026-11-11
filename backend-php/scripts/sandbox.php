<?php
/**
 * Operator commands, run inside the pod (kubectl exec deploy/app -- php scripts/sandbox.php <command>).
 *   check             proves the pod can reach the bank sandbox with the team key
 *   register-webhook  registers our webhook; the secret in the reply is shown once
 */
require dirname(__DIR__) . '/vendor/autoload.php';

use App\Config\Env;
use App\Config\Settings;
use App\Services\Bank\Bank;

Env::load(dirname(__DIR__));

$result = match ($argv[1] ?? '') {
    'check' => ['mode' => Settings::mode(), 'key_present' => Settings::gatewayKey() !== '', 'tariff' => Bank::client()->tariff()],
    'register-webhook' => Bank::client()->registerWebhook(Settings::webhookUrl()),
    default => null,
};
if ($result === null) {
    fwrite(STDERR, "usage: php scripts/sandbox.php check|register-webhook\n");
    exit(1);
}
echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
