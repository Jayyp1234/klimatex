<?php

namespace Tests\Integration;

use Anthropic\Client;
use App\Models\UserRepository;
use App\Services\Ai\Assistant;
use App\Services\Ai\Claude;
use Tests\Support\ApiTestCase;
use Tests\Support\FakeClaude;

final class ClaudeAssistantTest extends ApiTestCase
{
    private function claude(FakeClaude $fake): Claude
    {
        return new Claude(new Client(apiKey: 'test-key', requestOptions: ['transporter' => $fake, 'maxRetries' => 0]));
    }

    public function testClaudeReadsThisHomeThroughToolsAndAnswers(): void
    {
        $this->signedPeriod();
        $fake = new FakeClaude([
            FakeClaude::message([['type' => 'tool_use', 'id' => 'toolu_1', 'name' => 'home_overview', 'input' => ['site_id' => 3]]], 'tool_use'),
            FakeClaude::message([['type' => 'text', 'text' => 'Adaeze, your home is grade B.']], 'end_turn'),
        ]);
        $user = (new UserRepository())->findByEmail('adaeze@demo.klimatex.test');
        $result = (new Assistant(null, claude: $this->claude($fake)))->ask($user, ['message' => 'How is my home?', 'lang' => 'pcm',
            'history' => [['role' => 'assistant', 'content' => 'Hello'], ['role' => 'user', 'content' => 'Hi'], ['role' => 'user', 'content' => 'again']]]);

        $this->assertSame(['answer' => 'Adaeze, your home is grade B.', 'mode' => 'model', 'lang' => 'pcm', 'sources' => ['home_overview']], $result);

        [$first, $second] = $fake->requests;
        $this->assertSame('claude-opus-5-5', $first['model']);
        $this->assertSame('default', $first['fallbacks'], 'refusals fall back server-side');
        $this->assertStringContainsString('Nigerian Pidgin', $first['system']);
        $this->assertStringContainsString('"properties":{}', $fake->raw[0], 'an empty schema is sent as an object, not a list');
        $this->assertSame(['user'], array_column($first['messages'], 'role'), 'a leading assistant turn is dropped and repeated user turns merge');
        $this->assertSame("Hi\n\nagain\n\nHow is my home?", $first['messages'][0]['content']);

        $toolResult = end($second['messages'])['content'][0];
        $this->assertSame(['tool_result', 'toolu_1'], [$toolResult['type'], $toolResult['tool_use_id']]);
        $this->assertSame('Adaeze', json_decode($toolResult['content'], true)['family'], 'the model cannot pick another home');
    }

    public function testAClaudeOutageFallsBackToGuidedAnswers(): void
    {
        $this->signedPeriod();
        $user = (new UserRepository())->findByEmail('adaeze@demo.klimatex.test');
        $result = (new Assistant(null, claude: $this->claude(new FakeClaude([]))))->ask($user, ['message' => 'What grade is my home?']);
        $this->assertSame('guided', $result['mode']);
        $this->assertStringContainsString('grade B', $result['answer']);
    }

    public function testWriteReturnsTheText(): void
    {
        $fake = new FakeClaude([FakeClaude::message([['type' => 'text', 'text' => ' Your home is grade B. ']], 'end_turn')]);
        $this->assertSame('Your home is grade B.', $this->claude($fake)->write('system', 'prompt'));
        $this->assertSame('low', $fake->requests[0]['output_config']['effort']);
        $this->assertArrayNotHasKey('thinking', $fake->requests[0], 'thinking stays at the model default (adaptive)');
    }
}
