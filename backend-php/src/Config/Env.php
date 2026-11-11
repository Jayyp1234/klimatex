<?php

namespace App\Config;

use Dotenv\Dotenv;

final class Env
{
    /**
     * Loads .env for laptops and mirrors it into the process environment, so every reader
     * goes through getenv(). A variable set by the server or Kubernetes always wins.
     */
    public static function load(string $basePath): void
    {
        if (!is_file($basePath . '/.env')) {
            return;
        }
        foreach (Dotenv::createArrayBacked($basePath)->safeLoad() as $key => $value) {
            if (getenv($key) === false) {
                putenv($key . '=' . $value);
            }
        }
    }

    public static function get(string $key, ?string $default = null): ?string
    {
        $value = getenv($key);
        return ($value === false || $value === '') ? $default : $value;
    }
}
