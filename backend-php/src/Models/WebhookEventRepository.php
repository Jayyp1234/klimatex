<?php

namespace App\Models;

use App\Config\Database;

final class WebhookEventRepository
{
    public function isProcessed(string $eventId): bool
    {
        return Database::val("SELECT event_id FROM webhook_events WHERE event_id = ? AND status = 'processed'", [$eventId]) !== false;
    }

    public function record(string $eventId, string $type, string $body): void
    {
        Database::insertIgnore('webhook_events', ['event_id' => $eventId, 'event_type' => $type, 'status' => 'received',
            'received_at' => now_iso(), 'body' => $body]);
    }

    public function markStatus(string $eventId, string $status): void
    {
        Database::update('webhook_events', $eventId, ['status' => $status], 'event_id');
    }
}
