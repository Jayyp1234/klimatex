<?php

namespace App\Services\Bank;

use App\Config\Settings;

/** Resolves the active bank client, and maps every bank status onto our three payout states. */
final class Bank
{
    private static ?BankApi $client = null;

    public static function client(): BankApi
    {
        return self::$client ??= Settings::live() ? new LiveBank() : new MockBank();
    }

    /** Replaces the client; tests use this to script sandbox behaviour. Null restores the default. */
    public static function swap(?BankApi $client): void
    {
        self::$client = $client;
    }

    /** @return 'paid'|'failed'|'pending' anything unrecognised stays pending, never paid */
    public static function outcome(array $response): string
    {
        return match ($response['status'] ?? '') {
            'successful', 'success', 'completed' => 'paid',
            'failed', 'reversed' => 'failed',
            default => 'pending',
        };
    }
}
