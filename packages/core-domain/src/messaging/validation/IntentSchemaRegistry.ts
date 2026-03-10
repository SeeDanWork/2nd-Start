import { z } from 'zod';
import { IntentType } from '../types';
import { getSchemaForIntentType, getAllIntentTypes } from './schemas';

/**
 * Registry that maps IntentType to its zod payload schema.
 */
export class IntentSchemaRegistry {
  getSchema(type: string): z.ZodType | undefined {
    return getSchemaForIntentType(type);
  }

  isKnownType(type: string): boolean {
    return getAllIntentTypes().includes(type);
  }

  getAllTypes(): string[] {
    return getAllIntentTypes();
  }
}
