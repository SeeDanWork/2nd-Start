import {
  IncomingMessage,
  ExtractionFamilyContext,
  IntentExtractionResponse,
} from '../types';

/**
 * Abstraction for intent extraction from natural-language messages.
 */
export interface IntentExtractionProvider {
  extract(input: {
    message: IncomingMessage;
    familyContext: ExtractionFamilyContext;
  }): Promise<IntentExtractionResponse>;
}
