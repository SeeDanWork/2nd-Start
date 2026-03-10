import { IntentExtractionProvider } from './IntentExtractionProvider';
import {
  IncomingMessage,
  ExtractionFamilyContext,
  IntentExtractionResponse,
  ExtractedIntentCandidate,
} from '../types';
import { IntentExtractionError } from '../errors';
import { buildIntentExtractionPrompt } from './intentExtractionPrompt';

/**
 * LLM provider interface for intent extraction.
 * Consumers must supply their own LLM client implementation.
 */
export interface LlmClient {
  complete(prompt: string): Promise<string>;
}

/**
 * Extracts intents by calling an LLM with a structured extraction prompt.
 */
export class LlmIntentExtractionProvider implements IntentExtractionProvider {
  constructor(private readonly llmClient: LlmClient) {}

  async extract(input: {
    message: IncomingMessage;
    familyContext: ExtractionFamilyContext;
  }): Promise<IntentExtractionResponse> {
    const prompt = buildIntentExtractionPrompt({
      messageText: input.message.text,
      familyContext: input.familyContext,
    });

    let rawOutput: string;
    try {
      rawOutput = await this.llmClient.complete(prompt);
    } catch (err) {
      throw new IntentExtractionError(
        `LLM extraction failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const candidates = this.parseResponse(rawOutput);

    return {
      candidates,
      rawModelOutput: rawOutput,
      providerMetadata: { provider: 'llm' },
    };
  }

  private parseResponse(raw: string): ExtractedIntentCandidate[] {
    // Strip markdown code fences if present
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new IntentExtractionError(`Failed to parse LLM output as JSON: ${raw.slice(0, 200)}`);
    }

    if (!Array.isArray(parsed)) {
      throw new IntentExtractionError('LLM output must be a JSON array of candidates');
    }

    return parsed.map((item: any, i: number) => {
      if (!item.type || typeof item.type !== 'string') {
        throw new IntentExtractionError(`Candidate ${i} missing type`);
      }
      if (!item.payload || typeof item.payload !== 'object') {
        throw new IntentExtractionError(`Candidate ${i} missing payload`);
      }
      if (typeof item.confidence !== 'number') {
        throw new IntentExtractionError(`Candidate ${i} missing numeric confidence`);
      }

      return {
        type: item.type,
        payload: item.payload,
        confidence: Math.max(0, Math.min(1, item.confidence)),
        extractionNotes: Array.isArray(item.extractionNotes) ? item.extractionNotes : undefined,
      };
    });
  }
}
