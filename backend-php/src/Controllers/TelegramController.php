<?php

namespace App\Controllers;

use App\Core\Request;
use App\Services\Telegram\TelegramService;

final class TelegramController
{
    public function __construct(private TelegramService $telegram = new TelegramService())
    {
    }

    public function status(Request $request): array
    {
        return $this->telegram->status($request->user);
    }

    public function link(Request $request): array
    {
        return $this->telegram->createLink($request->user);
    }

    public function unlink(Request $request): array
    {
        return $this->telegram->unlinkAll($request->user);
    }

    /** Telegram's webhook. Public, but refused without the secret header set by scripts/telegram.php. */
    public function webhook(Request $request): array
    {
        $this->telegram->handle($request->body, $request->header('X-Telegram-Bot-Api-Secret-Token'));
        return ['ok' => true];
    }
}
