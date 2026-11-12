<?php

namespace App\Services\Ai;

use App\Config\Settings;
use Closure;
use CURLStringFile;
use Throwable;

/**
 * Speech to text for voice notes, through a whisper.cpp server (WHISPER_URL, e.g.
 * http://host.docker.internal:8178). Off when WHISPER_URL is empty. Audio and words are
 * never logged or stored; the audio lives only for the length of the request.
 */
final class Transcriber
{
    /** Whisper has no Igbo model, so Igbo is detected; Pidgin is transcribed as English. */
    private const WHISPER_LANG = ['en' => 'en', 'pcm' => 'en', 'yo' => 'yo', 'ha' => 'ha', 'ig' => 'auto'];

    /** Replaced in tests: fn (string $audio, string $lang): ?string */
    public static ?Closure $fake = null;

    public static function configured(): bool
    {
        return self::$fake !== null || Settings::whisperUrl() !== '';
    }

    /** The words in the recording, or null when nothing clear was heard or the server is down. */
    public static function transcribe(string $audio, string $lang, string $filename = 'voice.ogg'): ?string
    {
        if (self::$fake) {
            return (self::$fake)($audio, $lang);
        }
        try {
            $ch = curl_init(rtrim(Settings::whisperUrl(), '/') . '/inference');
            curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 90, CURLOPT_POSTFIELDS => [
                'file' => new CURLStringFile($audio, $filename, 'audio/ogg'),
                'language' => self::WHISPER_LANG[$lang] ?? 'auto',
                'response_format' => 'json',
                'temperature' => '0.0',
            ]]);
            $raw = curl_exec($ch);
            $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            curl_close($ch);
            if (!is_string($raw) || $status >= 400) {
                error_log("transcriber: HTTP $status");
                return null;
            }
            $text = trim(preg_replace('/\s+/u', ' ', (string) (json_decode($raw, true)['text'] ?? '')));
            // Whisper marks silence and noise like "[BLANK_AUDIO]" or "(music)".
            $text = trim(preg_replace('/[\[(][^\])]*[\])]/u', '', $text));
            return mb_strlen($text) >= 2 ? $text : null;
        } catch (Throwable $e) {
            error_log('transcriber: ' . get_class($e));
            return null;
        }
    }
}
