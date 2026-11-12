<?php

namespace App\Services\Ai;

use Anthropic\Client;
use App\Config\Settings;
use RuntimeException;

/**
 * Claude (Anthropic Messages API) through the official PHP SDK. Used when ANTHROPIC_API_KEY is set;
 * otherwise the app falls back to Huawei MaaS, then to ready-written answers.
 *
 * Every request opts into server-side refusal fallbacks, so a declined request is retried on another
 * model instead of failing. The family's words are never logged.
 */
final class Claude
{
    private const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

    public function __construct(private ?Client $client = null)
    {
    }

    public static function configured(): bool
    {
        return Settings::anthropicKey() !== '';
    }

    private function client(): Client
    {
        return $this->client ??= new Client(apiKey: Settings::anthropicKey(), baseUrl: Settings::anthropicBaseUrl(),
            requestOptions: ['timeout' => 45.0, 'maxRetries' => 2]);
    }

    /** One short piece of text, e.g. the monthly family message. */
    public function write(string $system, string $prompt, int $maxTokens = 1024): string
    {
        $message = $this->client()->beta->messages->create(
            model: Settings::anthropicModel(),
            maxTokens: $maxTokens,
            system: $system,
            messages: [['role' => 'user', 'content' => $prompt]],
            outputConfig: ['effort' => 'low'],
            fallbacks: 'default',
            betas: [self::FALLBACK_BETA],
        );
        return self::text($message);
    }

    /**
     * A conversation with read-only tools. $runTool(name) returns the tool's result as an array.
     * @param array<int, array{role:string, content:string}> $turns earlier user and assistant turns, then the question
     * @param array<int, array{name:string, description:string}> $tools
     * @return array{0:string, 1:string[]} the answer and the tools that were read
     */
    public function converse(string $system, array $turns, array $tools, callable $runTool, int $maxRounds = 4): array
    {
        $definitions = array_map(fn ($t) => ['name' => $t['name'], 'description' => $t['description'],
            'inputSchema' => ['type' => 'object', 'properties' => new \stdClass(), 'additionalProperties' => false]], $tools);
        $messages = self::alternate($turns);
        $used = [];
        for ($round = 0; $round < $maxRounds; $round++) {
            $response = $this->client()->beta->messages->create(
                model: Settings::anthropicModel(),
                maxTokens: 4096,
                system: $system,
                messages: $messages,
                tools: $definitions,
                outputConfig: ['effort' => 'low'],
                fallbacks: 'default',
                betas: [self::FALLBACK_BETA],
            );
            if ($response->stopReason !== 'tool_use') {
                if ($response->stopReason === 'refusal') {
                    throw new RuntimeException('refused');
                }
                return [self::text($response), array_values(array_unique($used))];
            }
            $results = [];
            foreach ($response->content as $block) {
                if ($block->type === 'tool_use') {
                    $used[] = $block->name;
                    $results[] = ['type' => 'tool_result', 'toolUseID' => $block->id, 'content' => jenc($runTool($block->name))];
                }
            }
            $messages[] = ['role' => 'assistant', 'content' => $response->content];
            $messages[] = ['role' => 'user', 'content' => $results];
        }
        throw new RuntimeException('too many tool rounds');
    }

    /** The API needs turns that start with the user and alternate; merge or drop anything else. */
    private static function alternate(array $turns): array
    {
        $out = [];
        foreach ($turns as $turn) {
            if (!$out && $turn['role'] !== 'user') {
                continue;
            }
            if ($out && end($out)['role'] === $turn['role']) {
                $out[count($out) - 1]['content'] .= "\n\n" . $turn['content'];
                continue;
            }
            $out[] = $turn;
        }
        return $out;
    }

    private static function text(object $message): string
    {
        if ($message->stopReason === 'refusal') {
            throw new RuntimeException('refused');
        }
        $text = '';
        foreach ($message->content as $block) {
            if ($block->type === 'text') {
                $text .= $block->text;
            }
        }
        $text = trim($text);
        return $text !== '' ? $text : throw new RuntimeException('empty answer');
    }
}
