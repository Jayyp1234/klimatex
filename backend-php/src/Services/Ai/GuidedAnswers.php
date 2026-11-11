<?php

namespace App\Services\Ai;

/**
 * Answers without a model: spot what the question is about, read the matching tool, fill a sentence.
 * Used on a laptop and whenever MaaS is down, so families always get a true answer from their records.
 * Written in English and Pidgin; other languages get English until the model is back.
 */
final class GuidedAnswers
{
    /** Checked in order; the first topic with a matching word wins. Words include Pidgin, Yoruba, Igbo and Hausa. */
    private const TOPICS = [
        'change' => ['change', 'update', 'withdraw', 'edit', 'cancel', 'delete', 'switch my', 'chenj'],
        'tips' => ['earn more', 'more credit', 'more money', 'tip', 'improve', 'increase', 'receipt', 'meter', 'calibrat', 'advice', 'how can i', 'wetin i fit do'],
        'loan' => ['loan', 'repay', 'debt', 'owe', 'gbese', 'bashi', 'instalment', 'installment'],
        'audit' => ['held', 'hold', 'why', 'audit', 'check', 'eligible', 'excluded', 'flag', 'verify', 'kilode', 'gini mere', 'saboda'],
        'payouts' => ['pay', 'paid', 'money', 'naira', '₦', 'wallet', 'cash', 'owo', 'kudi', 'ego', 'earn'],
        'grade' => ['grade', 'certificate', 'rating', 'score', 'trust'],
        'alerts' => ['problem', 'wrong', 'alert', 'issue', 'fault', 'offline', 'dust', 'not working', 'spoil'],
        'energy' => ['solar', 'energy', 'kwh', 'panel', 'reading', 'power', 'sun', 'inverter', 'light', 'generator', 'petrol', 'fuel'],
    ];

    private const TOOL = ['change' => null, 'loan' => 'loan', 'audit' => 'audit_status', 'payouts' => 'payouts',
        'grade' => 'home_overview', 'alerts' => 'alerts', 'energy' => 'energy', 'overview' => 'home_overview', 'tips' => 'credit_tips'];

    public static function topic(string $message): string
    {
        $text = mb_strtolower($message);
        foreach (self::TOPICS as $topic => $words) {
            foreach ($words as $word) {
                // Match at the start of a word: "pay" finds "payout", but "owe" doesn't find "power".
                if (preg_match('/(?<!\p{L})' . preg_quote($word, '/') . '/u', $text)) {
                    return $topic;
                }
            }
        }
        return 'overview';
    }

    /** @return array{0:string,1:string[],2:string} answer, tools read, language of the answer */
    public static function answer(string $message, string $lang, AssistantTools $tools): array
    {
        $pcm = $lang === 'pcm';
        $topic = self::topic($message);
        $tool = self::TOOL[$topic];
        $data = $tool ? $tools->run($tool) : [];
        $used = $tool ? [$tool] : [];
        if (isset($data['unavailable'])) {
            $text = $pcm ? 'I no fit find that one for your home yet. ' . $data['unavailable'] : 'I can\'t find that for your home yet. ' . $data['unavailable'];
            return [$text, $used, $pcm ? 'pcm' : 'en'];
        }
        $text = match ($topic) {
            'change' => $pcm
                ? 'I fit only explain, I no fit change anything. To change where dem dey pay you, open Settings, then Payment details. For any other thing, use Contact Support.'
                : 'I can only explain things, not change them. To change where you\'re paid, open Settings, then Payment details. For anything else, use Contact Support.',
            'loan' => self::loan($data, $pcm),
            'audit' => self::audit($data, $pcm),
            'payouts' => self::payouts($data, $pcm),
            'grade' => self::grade($data, $pcm),
            'alerts' => self::alerts($data, $pcm),
            'tips' => self::tips($data, $pcm),
            'energy' => self::energy($data, $tools, $pcm, $used),
            default => self::overview($data, $pcm),
        };
        return [$text, $used, $pcm ? 'pcm' : 'en'];
    }

    private static function naira(float $amount): string
    {
        return '₦' . number_format($amount);
    }

    private static function payouts(array $d, bool $pcm): string
    {
        $latest = $d['payouts'][0] ?? null;
        $next = $d['next_payment'];
        $audit = $next['after_audit_closing'];
        if (!$latest) {
            if ($pcm) {
                return 'No payment don land yet. Dem dey pay after the auditor sign off the period and the credits sell' . ($audit ? ", after the audit wey close on $audit." : '.');
            }
            return 'No payout yet. You\'re paid after an audited period is signed off and its credits are sold' . ($audit ? ", after the audit that closes on $audit." : '.');
        }
        $when = $latest['date'] ? " on {$latest['date']}" : '';
        $state = $latest['status'] === 'paid' ? '' : ($pcm ? " (e still dey {$latest['status']})" : " (still {$latest['status']})");
        $nextLine = $audit
            ? ($pcm ? ' Your next payment fit be about ' . self::naira($next['estimate_naira']) . ", after the audit wey close on $audit."
                : ' Your next payment should be about the same, ' . self::naira($next['estimate_naira']) . ", after the audit that closes on $audit.")
            : '';
        return $pcm
            ? 'Dem don pay you ' . self::naira($d['total_paid_naira']) . ' altogether. The last one na ' . self::naira($latest['amount_naira']) . " wey go {$latest['sent_to']}$when$state.$nextLine"
            : 'You\'ve been paid ' . self::naira($d['total_paid_naira']) . ' in total. The latest was ' . self::naira($latest['amount_naira']) . " to {$latest['sent_to']}$when$state.$nextLine";
    }

    private static function audit(array $d, bool $pcm): string
    {
        $why = implode('; ', array_column($d['needs_attention'], 'meaning'));
        return match ($d['status']) {
            'eligible' => $pcm
                ? "Your last period clear well well: {$d['checks_passed']} of {$d['checks_total']} checks pass, and {$d['tonnes']} t of carbon don count for you."
                : "Your latest period is clear: {$d['checks_passed']} of {$d['checks_total']} checks passed and {$d['tonnes']} t of carbon was credited.",
            'excluded' => $pcm
                ? "This period no go earn because $why. If you think say e no correct, use Contact Support."
                : "This period earns nothing because $why. If you think that's wrong, use Contact Support.",
            default => $pcm
                ? "Your period dey on hold because $why. Nothing lost: once the auditor clear am, dem go issue the credits and pay you."
                : "Your period is on hold because $why. Nothing is lost: once the auditor clears it, the credits are issued and you're paid.",
        };
    }

    private static function loan(array $d, bool $pcm): string
    {
        if (!$d['has_loan']) {
            return $pcm ? 'This house no get solar loan, so your money dey go your wallet or bank account.'
                : 'This home has no solar loan, so payouts go to your wallet or bank account.';
        }
        if (!$d['repayments']) {
            return $pcm ? 'You get Access solar loan. Once your credits sell, your carbon money go enter the loan first. Still pay your normal instalment.'
                : 'You have an Access solar loan. Once your credits sell, your carbon payouts go into the loan first. Keep paying your agreed instalments.';
        }
        return $pcm
            ? 'Carbon money don pay ' . self::naira($d['repaid_from_carbon_naira']) . " inside your Access solar loan ({$d['repayments']} times). Still pay your normal instalment; na the bank get the full balance."
            : 'Carbon payouts have repaid ' . self::naira($d['repaid_from_carbon_naira']) . " of your Access solar loan ({$d['repayments']} payments). Keep paying your agreed instalments; the bank holds the full balance.";
    }

    private static function grade(array $d, bool $pcm): string
    {
        return $pcm
            ? "Your house bin be grade {$d['grade_before']}, now e don be grade {$d['grade_now']}, with trust score {$d['trust_score']}. Next step: {$d['next_step']}."
            : "Your home was grade {$d['grade_before']} and is now grade {$d['grade_now']}, with a trust score of {$d['trust_score']}. Next step: {$d['next_step']}.";
    }

    private static function tips(array $d, bool $pcm): string
    {
        $todo = array_slice(array_values(array_filter($d['tips'], fn ($t) => $t['status'] === 'todo')), 0, 3);
        if (!$todo) {
            return $pcm ? 'Everything dey correct. Keep your inverter on and your panels clean.' : 'Everything checks out. Keep your inverter on and your panels clean.';
        }
        $intro = $pcm ? 'See wetin fit make you earn more:' : (count($todo) === 1 ? 'One thing would help you earn more:' : count($todo) . ' things would help you earn more:');
        return $intro . ' ' . implode(' ', array_map(fn ($t, $i) => ($i + 1) . ". {$t['title']}. {$t['detail']}", $todo, array_keys($todo)));
    }

    private static function alerts(array $d, bool $pcm): string
    {
        $alerts = array_filter($d['alerts'], fn ($a) => $a['severity'] !== 'info');
        if (!$alerts) {
            return $pcm ? 'Nothing dey wrong for now. Your system dey report well.' : 'Nothing needs your attention right now. Your system is reporting normally.';
        }
        return implode(' ', array_map(fn ($a) => "{$a['title']}: {$a['detail']}", $alerts));
    }

    private static function energy(array $d, AssistantTools $tools, bool $pcm, array &$used): string
    {
        $text = $pcm
            ? "Your panel make {$d['last_7_days_kwh']} kWh for the last 7 days (last reading na {$d['latest_reading_day']})."
            : "Your panels made {$d['last_7_days_kwh']} kWh in the last 7 days (latest reading {$d['latest_reading_day']}).";
        $used[] = 'alerts';
        $warnings = array_filter($tools->run('alerts')['alerts'] ?? [], fn ($a) => $a['severity'] !== 'info');
        return $warnings ? $text . ' ' . implode(' ', array_map(fn ($a) => "{$a['title']}: {$a['detail']}", $warnings)) : $text;
    }

    private static function overview(array $d, bool $pcm): string
    {
        $paid = $d['total_paid_naira'] > 0;
        return $pcm
            ? "Hello {$d['family']}. Your house na grade {$d['grade_now']}, {$d['tonnes_credited_this_period']} t carbon don count this period, you don save about {$d['petrol_litres_avoided_this_period']} L of petrol" . ($paid ? ', and dem don pay you ' . self::naira($d['total_paid_naira']) : ', and your first payment go come after the credits sell') . '. Ask me about your money, your audit, your loan or your solar.'
            : "Hi {$d['family']}. Your home is grade {$d['grade_now']}, with {$d['tonnes_credited_this_period']} t credited this period, about {$d['petrol_litres_avoided_this_period']} L of petrol avoided" . ($paid ? ' and ' . self::naira($d['total_paid_naira']) . ' paid so far' : '; your first payout comes once the credits sell') . '. Ask me about payouts, your audit, your loan or your solar.';
    }
}
