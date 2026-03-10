import { z } from 'zod';
import { IntentType } from '../../types';

// ── Date Range Schema ──

const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
});

// ── Payload Schemas ──

export const availabilityChangePayloadSchema = z.object({
  dateRange: dateRangeSchema,
  availability: z.enum(['AVAILABLE', 'UNAVAILABLE']),
  reason: z.string().optional(),
});

export const swapRequestPayloadSchema = z.object({
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  targetDateRange: dateRangeSchema.optional(),
  requestedWithParentId: z.string().optional(),
  reason: z.string().optional(),
});

export const disruptionReportPayloadSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  disruptionType: z.enum(['ILLNESS', 'TRAVEL', 'SCHOOL_CLOSURE', 'ACTIVITY_CONFLICT', 'WEATHER', 'OTHER']),
  childIds: z.array(z.string()).optional(),
  reason: z.string().optional(),
});

export const proposalRequestPayloadSchema = z.object({
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  targetDateRange: dateRangeSchema.optional(),
  reason: z.string().optional(),
});

export const policyConfirmationPayloadSchema = z.object({
  policyId: z.string().min(1),
  decision: z.enum(['ACCEPT', 'REJECT']),
});

// ── Schema Registry ──

const schemaMap: Record<string, z.ZodType> = {
  [IntentType.AVAILABILITY_CHANGE]: availabilityChangePayloadSchema,
  [IntentType.SWAP_REQUEST]: swapRequestPayloadSchema,
  [IntentType.DISRUPTION_REPORT]: disruptionReportPayloadSchema,
  [IntentType.PROPOSAL_REQUEST]: proposalRequestPayloadSchema,
  [IntentType.POLICY_CONFIRMATION]: policyConfirmationPayloadSchema,
};

export function getSchemaForIntentType(type: string): z.ZodType | undefined {
  return schemaMap[type];
}

export function getAllIntentTypes(): string[] {
  return Object.values(IntentType);
}
