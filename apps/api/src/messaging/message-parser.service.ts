import { Injectable } from '@nestjs/common';
import { parseIntent, ParsedIntent, MessageIntent } from '@adcp/shared';
import { ConversationSession } from '../entities';

@Injectable()
export class MessageParserService {
  parse(text: string, session?: ConversationSession): ParsedIntent {
    const result = parseIntent(text);

    // Boost confidence for contextual responses during active request flows
    if (session && session.state === 'requesting') {
      if (result.intent === MessageIntent.APPROVE) {
        result.confidence = Math.max(result.confidence, 0.95);
      }
      if (result.intent === MessageIntent.DECLINE) {
        result.confidence = Math.max(result.confidence, 0.95);
      }
    }

    return result;
  }
}
