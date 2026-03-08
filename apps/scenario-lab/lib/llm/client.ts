// ── LLM Client ───────────────────────────────────────────────
// Isolated LLM API calls. All external AI service communication
// goes through this module. The rest of the system is deterministic.
//
// If the LLM is unavailable, all functions return null and the
// system continues with local-only processing.

const LLM_ROUTER = process.env.LLM_ROUTER_URL || 'http://localhost:3100';

export interface IntentResult {
  intent: string;
  confidence: number;
}

export interface EntityResult {
  [key: string]: unknown;
}

/** Classify the intent of a parent's message. */
export async function classifyIntent(
  input: string,
  context?: Record<string, unknown>,
): Promise<IntentResult | null> {
  try {
    const res = await fetch(`${LLM_ROUTER}/llm/classify-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, context }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      intent: data.structured_data?.intent || 'general_question',
      confidence: data.confidence || 0,
    };
  } catch {
    return null;
  }
}

/** Extract entities from a parent's message. */
export async function extractEntities(
  input: string,
  context?: Record<string, unknown>,
): Promise<EntityResult | null> {
  try {
    const res = await fetch(`${LLM_ROUTER}/llm/extract-entities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, context }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.structured_data || null;
  } catch {
    return null;
  }
}

/** Generate an explanation via the LLM router. */
export async function generateExplanation(
  input: string,
  context?: Record<string, unknown>,
): Promise<string | null> {
  try {
    const res = await fetch(`${LLM_ROUTER}/llm/generate-explanation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, context }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.structured_data?.explanation || null;
  } catch {
    return null;
  }
}
