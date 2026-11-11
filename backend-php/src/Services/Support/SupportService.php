<?php

namespace App\Services\Support;

use App\Config\Database;
use App\Core\HttpException;
use App\Models\SupportRequestRepository;

/** Help requests from the household app. Short, validated, and rate-limited so a stuck button can't flood the queue. */
final class SupportService
{
    public const TOPICS = ['system', 'payment', 'loan', 'certificate', 'account', 'other'];
    private const CONTACTS = ['app', 'sms', 'call'];
    private const PER_HOUR = 5;

    public function __construct(private SupportRequestRepository $requests = new SupportRequestRepository())
    {
    }

    public function create(array $user, array $input): array
    {
        $topic = (string) ($input['topic'] ?? '');
        $subject = trim((string) ($input['subject'] ?? ''));
        $message = trim((string) ($input['message'] ?? ''));
        $contact = (string) ($input['contact'] ?? 'app');

        $fields = [];
        if (!in_array($topic, self::TOPICS, true)) {
            $fields['topic'] = 'Choose what this is about.';
        }
        if (mb_strlen($subject) < 3 || mb_strlen($subject) > 120) {
            $fields['subject'] = 'Give it a short title (3 to 120 characters).';
        }
        if (mb_strlen($message) < 10 || mb_strlen($message) > 2000) {
            $fields['message'] = 'Tell us a little more (10 to 2,000 characters).';
        }
        if (!in_array($contact, self::CONTACTS, true)) {
            $fields['contact'] = 'Choose how we should reply.';
        }
        if ($fields) {
            throw new HttpException(422, 'Some details need fixing.', $fields);
        }

        $since = gmdate('Y-m-d\TH:i:s\Z', time() - 3600);
        if ($this->requests->countSince((int) $user['id'], $since) >= self::PER_HOUR) {
            throw new HttpException(429, 'You have sent several requests in the last hour. We will reply to those first.');
        }

        $householdId = $user['household_id'] ?? null;
        $siteId = $householdId ? Database::val('SELECT id FROM sites WHERE household_id = ? ORDER BY id LIMIT 1', [$householdId]) : null;

        $row = $this->requests->create([
            'reference' => 'SUP-' . strtoupper(bin2hex(random_bytes(3))),
            'user_id' => (int) $user['id'],
            'household_id' => $householdId,
            'site_id' => $siteId !== null ? (int) $siteId : null,
            'topic' => $topic,
            'subject' => $subject,
            'message' => $message,
            'contact' => $contact,
            'share_readings' => !empty($input['share_readings']) ? 1 : 0,
        ]);
        return ['request' => self::present($row)];
    }

    public function list(array $user): array
    {
        $rows = in_array($user['role'], ['admin', 'installer'], true) ? $this->requests->all() : $this->requests->forUser((int) $user['id']);
        return ['requests' => array_map([self::class, 'present'], $rows)];
    }

    private static function present(array $r): array
    {
        return [
            'id' => (int) $r['id'],
            'reference' => $r['reference'],
            'topic' => $r['topic'],
            'subject' => $r['subject'],
            'message' => $r['message'],
            'contact' => $r['contact'],
            'share_readings' => (bool) $r['share_readings'],
            'site_id' => $r['site_id'] !== null ? (int) $r['site_id'] : null,
            'status' => $r['status'],
            'created_at' => $r['created_at'],
            'updated_at' => $r['updated_at'],
        ];
    }
}
