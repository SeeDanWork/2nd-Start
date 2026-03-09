import type { TaskType, RoutingDecision, ModelId, Provider } from '../types.js';

const TASK_ROUTES: Record<TaskType, ModelId> = {
  'classify-intent': 'gpt-4o-mini',
  'extract-entities': 'gpt-4o-mini',
  'normalize-request': 'gpt-4o-mini',
  'check-ambiguity': 'gpt-4o-mini',
  'generate-clarification': 'claude-3-haiku',
  'generate-explanation': 'claude-3-haiku',
};

const MODEL_PROVIDER: Record<ModelId, Provider> = {
  'gpt-4o-mini': 'openai',
  'claude-3-haiku': 'anthropic',
  'gemini-1.5-flash': 'google',
};

const FALLBACK_CHAIN: Record<ModelId, ModelId[]> = {
  'gpt-4o-mini': ['claude-3-haiku', 'gemini-1.5-flash'],
  'claude-3-haiku': ['gpt-4o-mini', 'gemini-1.5-flash'],
  'gemini-1.5-flash': ['gpt-4o-mini', 'claude-3-haiku'],
};

export function routeTask(task: TaskType): RoutingDecision {
  const model = TASK_ROUTES[task];
  return { model, provider: MODEL_PROVIDER[model] };
}

export function getFallbacks(model: ModelId): RoutingDecision[] {
  return (FALLBACK_CHAIN[model] || []).map(m => ({
    model: m,
    provider: MODEL_PROVIDER[m],
  }));
}
