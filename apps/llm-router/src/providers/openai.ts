import OpenAI from 'openai';
import type { ModelId, ProviderAdapter, TOKEN_LIMITS } from '../types.js';
import { TOKEN_LIMITS as limits } from '../types.js';

export class OpenAIAdapter implements ProviderAdapter {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async complete(model: ModelId, systemPrompt: string, userPrompt: string) {
    const response = await this.client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt.slice(0, limits.max_input_tokens * 4) },
      ],
      max_tokens: limits.max_output_tokens,
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const choice = response.choices[0];
    return {
      content: choice.message.content || '{}',
      input_tokens: response.usage?.prompt_tokens || 0,
      output_tokens: response.usage?.completion_tokens || 0,
    };
  }
}
