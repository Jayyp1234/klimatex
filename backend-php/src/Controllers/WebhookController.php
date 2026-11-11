<?php

namespace App\Controllers;

use App\Core\Request;
use App\Services\Webhook\WebhookService;

final class WebhookController
{
    public function forge(Request $request): array
    {
        return (new WebhookService())->handle($request);
    }
}
