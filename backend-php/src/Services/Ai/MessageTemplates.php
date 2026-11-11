<?php

namespace App\Services\Ai;

/**
 * The monthly family message without the model: short, factual, one per language.
 * Used on a laptop and whenever MaaS is unavailable, so a family always gets its message.
 * The Yoruba, Igbo and Hausa wording should be checked by a native speaker before real use.
 */
final class MessageTemplates
{
    private const TEXT = [
        'en' => [
            'body' => 'Hi %1$s, your home is grade %2$s. You avoided about %3$d L of petrol (%4$s t of CO2) this month.',
            'eligible' => 'Your payout comes after the audit and the credit sale.',
            'held' => 'This month is on hold because %s. Nothing is lost.',
            'excluded' => 'This month can\'t earn credits because %s. Open the app to see why.',
        ],
        'pcm' => [
            'body' => '%1$s, your house na grade %2$s. This month you no burn about %3$d litres of petrol (%4$s t CO2).',
            'eligible' => 'Your money go come after the audit and dem sell the credits.',
            'held' => 'This month dey on hold because %s. Nothing go loss.',
            'excluded' => 'This month no fit earn because %s. Open the app make you see why.',
        ],
        'yo' => [
            'body' => '%1$s, ilé rẹ wà ní ipele %2$s. Ní oṣù yìí, o yàgò fún bíi lítà %3$d epo bẹntiróòlù (%4$s t CO2).',
            'eligible' => 'Owó rẹ yóò dé lẹ́yìn àyẹ̀wò àti títà àwọn kirẹ́dìtì.',
            'held' => 'A ń ṣàyẹ̀wò oṣù yìí. Kò sí ohun tó sọnù.',
            'excluded' => 'Oṣù yìí kò lè mú owó wá. Ṣí àpù náà láti mọ ìdí.',
        ],
        'ig' => [
            'body' => '%1$s, ụlọ gị nọ n\'ọkwa %2$s. N\'ọnwa a, ị zeere ihe dị ka lita %3$d nke mmanụ ụgbọala (%4$s t CO2).',
            'eligible' => 'Ego gị ga-abịa mgbe nyocha na ire kredit gachara.',
            'held' => 'Anyị na-enyocha ọnwa a. Ọ dịghị ihe furu efu.',
            'excluded' => 'Ọnwa a enweghị ike ịkpata ego. Mepee ngwa ahụ ka ị mara ihe kpatara ya.',
        ],
        'ha' => [
            'body' => '%1$s, gidanka yana matsayi na %2$s. A wannan watan ka guji kusan lita %3$d na man fetur (%4$s t CO2).',
            'eligible' => 'Kuɗinka zai zo bayan bincike da sayar da kiredit.',
            'held' => 'Muna duba wannan watan. Babu abin da ya ɓace.',
            'excluded' => 'Wannan watan ba zai kawo kuɗi ba. Buɗe manhajar don ganin dalili.',
        ],
    ];

    public static function familyMessage(string $name, string $grade, float $litres, float $t, string $status, ?string $reason, string $lang): string
    {
        $text = self::TEXT[$lang] ?? self::TEXT['en'];
        $state = in_array($status, ['eligible', 'held', 'excluded'], true) ? $status : 'held';
        $why = $reason ? implode(', ', array_map(fn ($c) => AssistantTools::CHECKS[trim($c)] ?? str_replace('_', ' ', trim($c)), explode(',', $reason))) : 'some readings need a closer look';
        return sprintf($text['body'], $name, $grade, (int) round($litres), number_format($t, 2)) . ' '
            . ($state === 'eligible' ? $text['eligible'] : sprintf($text[$state], $why));
    }
}
