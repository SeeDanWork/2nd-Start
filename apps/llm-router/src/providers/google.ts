import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ModelId, ProviderAdapter } from '../types.js';
import { TOKEN_LIMITS as limits } from '../types.js';

const MODEL_MAP: Record<string, string> = {
  'gemini-1.5-flash': 'gemini-1.5-flash',
};

export class GoogleAdapter implements ProviderAdapter {
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async complete(model: ModelId, systemPrompt: string, userPrompt: string) {
    const genModel = this.genAI.getGenerativeModel({
      model: MODEL_MAP[model] || model,
      systemInstruction: systemPrompt,
      generationConfig: {
        maxOutputTokens: limits.max_output_tokens,
        temperature: 0,
        responseMimeType: 'application/json',
      },
    });

    const result = await genModel.generateContent(
      userPrompt.slice(0, limits.max_input_tokens * 4)
    );

    const text = result.response.text();
    const usage = result.response.usageMetadata;
    return {
      content: text,
      input_tokens: usage?.promptTokenCount || 0,
      output_tokens: usage?.candidatesTokenCount || 0,
    };
  }
}
