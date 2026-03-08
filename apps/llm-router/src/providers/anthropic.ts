import Anthropic from '@anthropic-ai/sdk';
import type { ModelId, ProviderAdapter } from '../types.js';
import { TOKEN_LIMITS as limits } from '../types.js';

const MODEL_MAP: Record<string, string> = {
  'claude-3-haiku': 'claude-3-haiku-20240307',
};

export class AnthropicAdapter implements ProviderAdapter {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async complete(model: ModelId, systemPrompt: string, userPrompt: string) {
    const response = await this.client.messages.create({
      model: MODEL_MAP[model] || model,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt.slice(0, limits.max_input_tokens * 4) },
      ],
      max_tokens: limits.max_output_tokens,
      temperature: 0,
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    return {
      content: text,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    };
  }
}
