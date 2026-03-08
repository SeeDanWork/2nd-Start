import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  googleApiKey: process.env.GOOGLE_API_KEY || '',
  defaultModel: (process.env.DEFAULT_MODEL || 'gpt-4o-mini') as 'gpt-4o-mini' | 'claude-3-haiku' | 'gemini-1.5-flash',
  fallbackModel: (process.env.FALLBACK_MODEL || 'claude-3-haiku') as 'gpt-4o-mini' | 'claude-3-haiku' | 'gemini-1.5-flash',
  port: parseInt(process.env.PORT || '3100', 10),
};

export function validateConfig(): string[] {
  const warnings: string[] = [];
  if (!config.openaiApiKey) warnings.push('OPENAI_API_KEY not set — OpenAI models unavailable');
  if (!config.anthropicApiKey) warnings.push('ANTHROPIC_API_KEY not set — Anthropic models unavailable');
  if (!config.googleApiKey) warnings.push('GOOGLE_API_KEY not set — Google models unavailable');
  return warnings;
}
