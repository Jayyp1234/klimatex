<?php

namespace App\Controllers;

use App\Core\Request;
use App\Services\Ai\Assistant;

final class AssistantController
{
    public function __construct(private Assistant $assistant = new Assistant())
    {
    }

    public function ask(Request $request): array
    {
        return $this->assistant->ask($request->user, $request->body ?? []);
    }
}
