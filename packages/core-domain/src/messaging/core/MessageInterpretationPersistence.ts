import {
  IncomingMessage,
  MessageInterpretationResult,
  IntentRecord,
} from '../types';
import { IIntentRepository } from '../repositories/IIntentRepository';

/**
 * Persists interpretation results for audit.
 */
export class MessageInterpretationPersistence {
  constructor(private readonly intentRepo: IIntentRepository) {}

  async persistInterpretationResult(input: {
    message: IncomingMessage;
    result: MessageInterpretationResult;
  }): Promise<void> {
    const { message, result } = input;

    const record: IntentRecord = {
      id: this.generateId(message.messageId, result.status),
      familyId: message.familyId,
      parentId: message.senderParentId,
      type: result.interpretedIntent?.type ?? 'UNKNOWN' as any,
      payload: result.interpretedIntent?.payload ?? {},
      confidence: result.interpretedIntent?.confidence ?? 0,
      messageId: message.messageId,
      status: result.status,
      resolutionMetadata: result.interpretedIntent?.resolvedEntities
        ? { resolvedEntities: result.interpretedIntent.resolvedEntities }
        : result.failures
          ? { failures: result.failures }
          : null,
      providerMetadata: result.providerMetadata ?? null,
      rawText: message.text,
      createdAt: result.interpretedIntent?.createdAt ?? new Date().toISOString(),
    };

    await this.intentRepo.create(record);
  }

  private generateId(messageId: string, status: string): string {
    return `intent-${messageId}-${status.toLowerCase()}`;
  }
}
