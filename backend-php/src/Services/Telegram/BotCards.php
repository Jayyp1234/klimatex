<?php

namespace App\Services\Telegram;

use App\Services\Ai\AssistantTools;

/**
 * Instant, formatted answers for the menu buttons (Telegram HTML), from the same read-only
 * tools the assistant uses. No model is involved, so they are fast and never invent a figure.
 */
final class BotCards
{
    private const BARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

    public function __construct(private AssistantTools $tools, private string $lang)
    {
    }

    public function home(): string
    {
        $o = $this->tools->run('home_overview');
        if (isset($o['unavailable'])) {
            return self::e($o['unavailable']);
        }
        $energy = $this->tools->run('energy');
        $lines = [
            '🏠 <b>' . self::e($o['home']) . '</b> · ' . self::e($o['area']),
            '',
            '⚡ ' . $this->t('grade') . ': <b>' . self::e($o['grade_before']) . '</b> ' . $this->t('before') . ' → <b>' . self::e($o['grade_now']) . '</b> ' . $this->t('now'),
            '🌍 ' . $this->t('co2') . ': <b>' . self::num($o['tonnes_credited_this_period'], 3) . ' t</b>',
            '⛽ ' . $this->t('petrol') . ': <b>' . self::num($o['petrol_litres_avoided_this_period']) . ' L</b>',
            '💸 ' . $this->t('paid_total') . ': <b>' . self::naira($o['total_paid_naira']) . '</b>',
            '🛡 ' . $this->t('trust') . ': <b>' . (int) $o['trust_score'] . '/100</b>',
        ];
        $months = $energy['audited_months'] ?? [];
        if ($months) {
            $kwh = array_column($months, 'solar_kwh');
            $lines[] = '';
            $lines[] = '☀️ ' . $this->t('solar_months') . ':';
            $lines[] = '<code>' . self::spark($kwh) . '</code>  <b>' . self::num(array_sum($kwh)) . ' kWh</b>';
            $lines[] = '<code>' . implode('', array_map(fn ($m) => mb_substr(date('M', strtotime($m['month'] . '-01')), 0, 1), $months)) . '</code>';
        }
        if (!empty($o['next_step'])) {
            $lines[] = '';
            $lines[] = '🔋 ' . $this->t('next_step') . ': ' . self::e($o['next_step']);
        }
        return implode("\n", $lines);
    }

    public function payouts(): string
    {
        $p = $this->tools->run('payouts');
        if (isset($p['unavailable'])) {
            return self::e($p['unavailable']);
        }
        $lines = ['💸 <b>' . $this->t('payouts_title') . '</b>: ' . self::naira($p['total_paid_naira']), ''];
        foreach (array_slice($p['payouts'] ?? [], -5) as $row) {
            $icon = $row['status'] === 'paid' ? '✅' : '⏳';
            $lines[] = "$icon " . self::e($row['date']) . ' · <b>' . self::naira($row['amount_naira']) . '</b> ' . $this->destination((string) $row['sent_to'])
                . ' · ' . self::num($row['tonnes'], 3) . ' t CO₂';
        }
        if (empty($p['payouts'])) {
            $lines[] = $this->t('no_payouts');
        }
        if (!empty($p['next_payment']['estimate_naira'])) {
            $lines[] = '';
            $lines[] = '📅 ' . $this->t('next_pay', self::naira($p['next_payment']['estimate_naira']), self::e($p['next_payment']['after_audit_closing']));
        }
        $loan = $this->tools->run('loan');
        if (!empty($loan['has_loan'])) {
            $lines[] = '🏦 ' . self::e($loan['lender']) . ': ' . self::naira($loan['repaid_from_carbon_naira']) . ' ' . $this->t('to_loan');
        }
        return implode("\n", $lines);
    }

    public function audit(): string
    {
        $a = $this->tools->run('audit_status');
        if (isset($a['unavailable'])) {
            return self::e($a['unavailable']);
        }
        $status = in_array($a['status'], ['eligible', 'held', 'excluded'], true) ? $this->t($a['status']) : self::e($a['status']);
        $lines = [
            '🔍 <b>' . $this->t('audit_title') . '</b>',
            '',
            $status,
            '☑️ ' . $this->t('checks') . ': <b>' . (int) $a['checks_passed'] . '/' . (int) $a['checks_total'] . '</b>',
            '🛡 ' . $this->t('trust') . ': <b>' . (int) $a['trust_score'] . '/100</b>',
            '🌍 ' . $this->t('co2') . ': <b>' . self::num($a['tonnes'], 3) . ' t</b>',
        ];
        foreach ($a['needs_attention'] ?? [] as $c) {
            $lines[] = '⚠️ ' . self::e($c['meaning']);
        }
        $todo = (int) ($this->tools->run('credit_tips')['things_to_do'] ?? 0);
        if ($todo > 0) {
            $lines[] = '';
            $lines[] = $this->t('todo', $todo);
        }
        return implode("\n", $lines);
    }

    private function destination(string $sentTo): string
    {
        return match (true) {
            str_contains($sentTo, 'loan') => $this->t('to_loan'),
            str_contains($sentTo, 'wallet') => $this->t('to_wallet'),
            default => $this->t('to_bank'),
        };
    }

    private function t(string $key, ...$args): string
    {
        return BotText::t($this->lang, $key, ...$args);
    }

    /** One bar per value, scaled between the smallest and largest. */
    public static function spark(array $values): string
    {
        if (!$values) {
            return '';
        }
        [$min, $max] = [min($values), max($values)];
        return implode('', array_map(fn ($v) => self::BARS[$max > $min ? (int) round(($v - $min) / ($max - $min) * 7) : 4], $values));
    }

    public static function naira(float|int $amount): string
    {
        return '₦' . number_format((float) $amount, 0);
    }

    private static function num(float|int $value, int $decimals = 0): string
    {
        return number_format((float) $value, $decimals);
    }

    public static function e(?string $text): string
    {
        return htmlspecialchars((string) $text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
