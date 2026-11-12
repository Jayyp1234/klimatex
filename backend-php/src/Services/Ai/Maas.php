<?php

namespace App\Services\Ai;

use App\Config\Settings;
use App\Services\Bank\BankError;
use App\Services\Bank\Http;
use Throwable;

/** Huawei MaaS (OpenAI-compatible). Writes plain-language messages only; never decides a credit. */
final class Maas
{
    private const LANGS = ['en' => 'plain English', 'pcm' => 'Nigerian Pidgin', 'yo' => 'Yoruba', 'ig' => 'Igbo', 'ha' => 'Hausa'];

    /**
     * The monthly family message. Written by the model when it answers; otherwise a ready-written
     * template with the same facts, so the family always gets a message and the app never shows an error.
     * @return array{text:string, source:string} source is "model" or "template"
     */
    public static function familyMessage(string $name, string $grade, float $litres, float $t, string $status,
                                         ?string $reason, string $lang = 'en'): array
    {
        $template = ['text' => MessageTemplates::familyMessage($name, $grade, $litres, $t, $status, $reason, $lang), 'source' => 'template'];
        if (Claude::configured()) {
            try {
                $facts = sprintf('Name: %s. Home grade: %s. Petrol avoided this month: %d litres. CO2 avoided: %.2f tonnes. Status: %s.%s',
                    $name, $grade, round($litres), $t, $status, $reason ? " Reason held: $reason." : '');
                $text = (new Claude())->write('You write short, warm SMS messages for solar households in Lagos, Nigeria. Use only the facts given. '
                    . 'Never promise amounts or dates. Reply with the message text only, under 300 characters.',
                    'Write this month\'s message in ' . (self::LANGS[$lang] ?? 'plain English') . ". Facts: $facts");
                return ['text' => $text, 'source' => 'model'];
            } catch (Throwable $e) {
                error_log('claude: family message falls back to template: ' . get_class($e));
                return $template;
            }
        }
        if (!Settings::live()) {
            return $template;
        }
        $facts = sprintf('Name: %s. Home grade: %s. Petrol avoided this month: %d litres. CO2 avoided: %.2f tonnes. Status: %s.%s',
            $name, $grade, round($litres), $t, $status, $reason ? " Reason held: $reason." : '');
        $prompt = 'Write one short SMS (under 300 characters) in ' . (self::LANGS[$lang] ?? 'plain English')
            . " for a Lagos household, using only these facts, no promises of amounts: $facts";
        try {
            [$code, $body] = Http::call('POST', Settings::maasBase() . '/chat/completions', ['model' => Settings::maasModel(),
                'max_tokens' => 200, 'messages' => [['role' => 'user', 'content' => $prompt]],
                'chat_template_kwargs' => ['thinking' => false]],
                ['apikey' => Settings::gatewayKey(), 'Authorization' => 'Bearer unused'], 60);
            if ($code >= 400) {
                throw new BankError($code, $body);
            }
            $text = trim($body['choices'][0]['message']['content'] ?? '');
            return $text === '' ? $template : ['text' => $text, 'source' => 'model'];
        } catch (Throwable $e) {
            error_log('maas: family message falls back to template: ' . ($e instanceof BankError ? "HTTP {$e->status}" : get_class($e)));
            return $template;
        }
    }
}
