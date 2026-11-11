<?php

namespace App\Core;

use RuntimeException;

/** An expected failure that maps directly to an HTTP response. */
final class HttpException extends RuntimeException
{
    public function __construct(public int $status, string $message, public array $fields = [])
    {
        parent::__construct($message);
    }
}
