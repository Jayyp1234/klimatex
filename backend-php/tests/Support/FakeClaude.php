<?php

namespace Tests\Support;

use GuzzleHttp\Psr7\Response;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;

/** Stands in for api.anthropic.com: replies with scripted Messages API bodies and records each request body. */
final class FakeClaude implements ClientInterface
{
    /** @var array<int, array> decoded request bodies, in order */
    public array $requests = [];

    /** @var string[] raw request bodies, to check JSON shapes such as {} versus [] */
    public array $raw = [];

    /** @param array<int, array> $replies Messages API response bodies, in order */
    public function __construct(private array $replies)
    {
    }

    public function sendRequest(RequestInterface $request): ResponseInterface
    {
        $this->raw[] = (string) $request->getBody();
        $this->requests[] = json_decode(end($this->raw), true);
        $reply = array_shift($this->replies) ?? ['type' => 'error', 'error' => ['type' => 'api_error', 'message' => 'no scripted reply']];
        $status = ($reply['type'] ?? '') === 'error' ? 500 : 200;
        return new Response($status, ['content-type' => 'application/json'], json_encode($reply));
    }

    public static function message(array $content, string $stop): array
    {
        return ['id' => 'msg_test', 'type' => 'message', 'role' => 'assistant', 'model' => 'claude-opus-5-5',
            'content' => $content, 'stop_reason' => $stop, 'stop_sequence' => null,
            'usage' => ['input_tokens' => 10, 'output_tokens' => 10]];
    }
}
