<?php

namespace App\Services\Bank;

final class Http
{
    /** @return array{0:int,1:array,2:array<string,string>} status, decoded body, lower-cased response headers */
    public static function call(string $method, string $url, ?array $json, array $headers, int $timeout = 35): array
    {
        $ch = curl_init($url);
        $h = ['Content-Type: application/json'];
        foreach ($headers as $k => $v) $h[] = "$k: $v";
        $responseHeaders = [];
        curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $h, CURLOPT_TIMEOUT => $timeout,
            CURLOPT_HEADERFUNCTION => function ($curl, string $line) use (&$responseHeaders) {
                if (str_contains($line, ':')) {
                    [$name, $value] = explode(':', $line, 2);
                    $responseHeaders[strtolower(trim($name))] = trim($value);
                }
                return strlen($line);
            }]);
        if ($json !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, jenc($json));
        $raw = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if ($raw === false) throw new BankError(0, ['error' => $err]);
        return [$status, json_decode($raw, true) ?? ['raw' => $raw], $responseHeaders];
    }
}
