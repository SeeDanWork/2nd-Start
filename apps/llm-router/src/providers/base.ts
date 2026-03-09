import type { ModelId, ProviderAdapter } from '../types.js';
import { config } from '../config.js';
import { OpenAIAdapter } from './openai.js';
import { AnthropicAdapter } from './anthropic.js';
import { GoogleAdapter } from './google.js';

const adapters: Record<string, ProviderAdapter> = {};

export function getAdapter(provider: string): ProviderAdapter {
  if (!adapters[provider]) {
    switch (provider) {
      case 'openai':
        adapters[provider] = new OpenAIAdapter(config.openaiApiKey);
        break;
      case 'anthropic':
        adapters[provider] = new AnthropicAdapter(config.anthropicApiKey);
        break;
      case 'google':
        adapters[provider] = new GoogleAdapter(config.googleApiKey);
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }
  return adapters[provider];
}
