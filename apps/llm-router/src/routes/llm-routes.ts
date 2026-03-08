import { Router, type Request, type Response } from 'express';
import { routeTask, getFallbacks } from '../router/model-router.js';
import { getAdapter } from '../providers/base.js';
import { PROMPT_TEMPLATES, buildUserPrompt } from '../prompts/templates.js';
import { getCacheKey, getCached, setCache } from '../cache/response-cache.js';
import { logUsage } from '../logging/usage-logger.js';
import { getRecentLogs, getUsageSummary } from '../logging/usage-logger.js';
import { cacheStats, clearCache } from '../cache/response-cache.js';
import type { TaskType, LLMResponse, ModelId } from '../types.js';

const router = Router();

const VALID_TASKS: TaskType[] = [
  'classify-intent',
  'extract-entities',
  'normalize-request',
  'check-ambiguity',
  'generate-clarification',
  'generate-explanation',
];

async function handleTask(task: TaskType, input: string, context?: Record<string, unknown>): Promise<{
  response: LLMResponse;
  model_used: ModelId;
  latency_ms: number;
  cached: boolean;
  input_tokens: number;
  output_tokens: number;
}> {
  const systemPrompt = PROMPT_TEMPLATES[task];
  const userPrompt = buildUserPrompt(task, input, context);

  // Check cache
  const cacheKey = getCacheKey(userPrompt, task);
  const cached = getCached(cacheKey);
  if (cached) {
    const parsed = JSON.parse(cached) as LLMResponse;
    return {
      response: parsed,
      model_used: routeTask(task).model,
      latency_ms: 0,
      cached: true,
      input_tokens: 0,
      output_tokens: 0,
    };
  }

  // Route to model
  const primary = routeTask(task);
  const fallbacks = getFallbacks(primary.model);
  const attempts = [primary, ...fallbacks];

  let lastError: Error | null = null;

  for (const attempt of attempts) {
    // Retry once per model
    for (let retry = 0; retry < 2; retry++) {
      try {
        const adapter = getAdapter(attempt.provider);
        const start = Date.now();
        const result = await adapter.complete(attempt.model, systemPrompt, userPrompt);
        const latency_ms = Date.now() - start;

        // Parse and validate
        let parsed: LLMResponse;
        try {
          parsed = JSON.parse(result.content);
        } catch {
          throw new Error(`Invalid JSON from ${attempt.model}: ${result.content.slice(0, 200)}`);
        }

        // Validate schema
        if (typeof parsed.confidence !== 'number' || typeof parsed.structured_data !== 'object') {
          throw new Error(`Schema validation failed from ${attempt.model}`);
        }

        // Ensure all required fields
        parsed = {
          object_type: parsed.object_type || 'ParentRequest',
          confidence: parsed.confidence,
          structured_data: parsed.structured_data,
          clarification_needed: parsed.clarification_needed || false,
          clarification_question: parsed.clarification_question || '',
        };

        // Cache successful response
        setCache(cacheKey, JSON.stringify(parsed));

        // Log (fire and forget)
        void logUsage({
          timestamp: new Date().toISOString(),
          task_type: task,
          model_used: attempt.model,
          input_tokens: result.input_tokens,
          output_tokens: result.output_tokens,
          latency_ms,
          success: true,
          cached: false,
        });

        return {
          response: parsed,
          model_used: attempt.model,
          latency_ms,
          cached: false,
          input_tokens: result.input_tokens,
          output_tokens: result.output_tokens,
        };
      } catch (err) {
        lastError = err as Error;
        if (retry === 0) continue; // retry once
      }
    }
  }

  // All models failed
  void logUsage({
    timestamp: new Date().toISOString(),
    task_type: task,
    model_used: 'gpt-4o-mini',
    input_tokens: 0,
    output_tokens: 0,
    latency_ms: 0,
    success: false,
    cached: false,
  });

  throw lastError || new Error('All models failed');
}

function taskEndpoint(task: TaskType) {
  return async (req: Request, res: Response) => {
    const { input, context } = req.body;
    if (!input || typeof input !== 'string') {
      res.status(400).json({ error: 'input (string) is required' });
      return;
    }

    try {
      const result = await handleTask(task, input, context);
      res.json({
        ...result.response,
        _meta: {
          model_used: result.model_used,
          latency_ms: result.latency_ms,
          cached: result.cached,
          input_tokens: result.input_tokens,
          output_tokens: result.output_tokens,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  };
}

// Task endpoints
router.post('/classify-intent', taskEndpoint('classify-intent'));
router.post('/extract-entities', taskEndpoint('extract-entities'));
router.post('/normalize-request', taskEndpoint('normalize-request'));
router.post('/check-ambiguity', taskEndpoint('check-ambiguity'));
router.post('/generate-clarification', taskEndpoint('generate-clarification'));
router.post('/generate-explanation', taskEndpoint('generate-explanation'));

// Usage & diagnostics
router.get('/usage', async (_req: Request, res: Response) => {
  res.json(await getUsageSummary());
});

router.get('/logs', async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  res.json(await getRecentLogs(limit));
});

router.get('/cache', (_req: Request, res: Response) => {
  res.json(cacheStats());
});

router.post('/cache/clear', (_req: Request, res: Response) => {
  clearCache();
  res.json({ cleared: true });
});

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export { router as llmRoutes };
