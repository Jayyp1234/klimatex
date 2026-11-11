<?php

namespace App\Core;

/**
 * A response is a returned value, not an echo-and-exit, so the whole request cycle can run
 * in-process under test. Every body uses one envelope: { meta, data, error }.
 */
final class Response
{
    public function __construct(
        public int $status,
        public array $body,
        public array $headers = [],
    ) {
    }

    public static function json(Request $request, int $status, ?array $data = null, ?array $error = null): self
    {
        return new self($status, [
            'meta' => [
                'request_id' => $request->id,
                'status' => $status,
                'success' => $status < 400,
                'path' => $request->path,
                'method' => $request->method,
                'duration_ms' => (int) ((microtime(true) - $request->startedAt) * 1000),
            ],
            'data' => $data,
            'error' => $error,
        ]);
    }

    public static function fail(Request $request, int $status, string $message, array $fields = []): self
    {
        return self::json($request, $status, null, array_filter(['message' => $message, 'fields' => $fields]));
    }

    public function withHeaders(array $headers): self
    {
        $this->headers = array_merge($this->headers, $headers);
        return $this;
    }

    public function send(): void
    {
        http_response_code($this->status);
        header('Content-Type: application/json');
        foreach ($this->headers as $name => $value) {
            header("$name: $value");
        }
        if ($this->status !== 204) {
            echo jenc($this->body);
        }
    }
}
