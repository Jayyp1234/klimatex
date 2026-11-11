<?php

namespace App\Core;

final class Request
{
    public string $id;
    public float $startedAt;
    public array $body;

    /** The authenticated user's token claims, set by AuthMiddleware. */
    public ?array $user = null;

    public function __construct(
        public string $method,
        public string $path,
        public array $query = [],
        public string $raw = '',
        public array $headers = [],
        public string $ip = '',
    ) {
        $this->id = bin2hex(random_bytes(8));
        $this->startedAt = microtime(true);
        $decoded = json_decode($raw ?: '{}', true);
        $this->body = is_array($decoded) ? $decoded : [];
        $this->headers = array_change_key_case($headers, CASE_LOWER);
    }

    public static function fromGlobals(): self
    {
        $headers = function_exists('getallheaders') ? (getallheaders() ?: []) : [];
        foreach ($_SERVER as $key => $value) {
            if (str_starts_with($key, 'HTTP_')) {
                $headers[str_replace('_', '-', substr($key, 5))] = $value;
            }
        }
        if (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $headers['Authorization'] = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        }
        $path = rtrim(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/', '/') ?: '/';
        return new self(
            $_SERVER['REQUEST_METHOD'] ?? 'GET',
            rawurldecode($path),
            $_GET,
            file_get_contents('php://input') ?: '',
            $headers,
            $_SERVER['REMOTE_ADDR'] ?? '',
        );
    }

    public function input(string $key, $default = null)
    {
        return $this->body[$key] ?? $default;
    }

    public function query(string $key, $default = null)
    {
        return $this->query[$key] ?? $default;
    }

    public function header(string $name, string $default = ''): string
    {
        return (string) ($this->headers[strtolower($name)] ?? $default);
    }

    public function bearerToken(): ?string
    {
        $value = trim($this->header('authorization'));
        return str_starts_with($value, 'Bearer ') ? trim(substr($value, 7)) ?: null : null;
    }
}
