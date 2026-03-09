export type TaskType =
  | 'classify-intent'
  | 'extract-entities'
  | 'normalize-request'
  | 'check-ambiguity'
  | 'generate-clarification'
  | 'generate-explanation';

export type ModelId =
  | 'gpt-4o-mini'
  | 'claude-3-haiku'
  | 'gemini-1.5-flash';

export type Provider = 'openai' | 'anthropic' | 'google';

export interface LLMRequest {
  task: TaskType;
  input: string;
  context?: Record<string, unknown>;
}

export interface LLMResponse {
  object_type: string;
  confidence: number;
  structured_data: Record<string, unknown>;
  clarification_needed: boolean;
  clarification_question: string;
}

export interface RoutingDecision {
  model: ModelId;
  provider: Provider;
}

export interface UsageLog {
  timestamp: string;
  task_type: TaskType;
  model_used: ModelId;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  success: boolean;
  cached: boolean;
}

export interface ProviderAdapter {
  complete(model: ModelId, systemPrompt: string, userPrompt: string): Promise<{
    content: string;
    input_tokens: number;
    output_tokens: number;
  }>;
}

export const TOKEN_LIMITS = {
  max_input_tokens: 2000,
  max_output_tokens: 500,
} as const;

export const REQUEST_TYPES = [
  'extra_time_request',
  'swap_request',
  'coverage_request',
  'delay_exchange',
  'holiday_extension',
  'fairness_complaint',
  'schedule_change',
  'general_question',
] as const;
