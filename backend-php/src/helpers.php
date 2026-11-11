<?php

function now_iso(): string
{
    return gmdate('Y-m-d\TH:i:s\Z');
}

function jenc($value): string
{
    return json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

function jdec(?string $json)
{
    return $json === null ? null : json_decode($json, true);
}

/** The bank API takes NGN with two decimals; everything internal is integer kobo. */
function naira(int $kobo): float
{
    return round($kobo / 100, 2);
}
