<?php

namespace App\Services\Bank;

use RuntimeException;

final class BankError extends RuntimeException
{
    public function __construct(public int $status, public array $body)
    {
        parent::__construct("$status: " . jenc($body));
    }

    /** The request may or may not have reached the bank: requery, never treat as failed. */
    public function outcomeUnknown(): bool
    {
        return $this->status === 0 || $this->status === 504;
    }

    /** The sandbox's error code, for example INSUFFICIENT_FUNDS. */
    public function code(): ?string
    {
        return $this->body['error']['code'] ?? $this->body['code'] ?? null;
    }

    /** Quote this to the platform team when reporting a sandbox problem. */
    public function requestId(): ?string
    {
        return $this->body['request_id'] ?? null;
    }
}
