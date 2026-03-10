import { ExtractionFamilyContext } from '../types';

/**
 * Builds the LLM extraction prompt for structured intent extraction.
 */
export function buildIntentExtractionPrompt(input: {
  messageText: string;
  familyContext: ExtractionFamilyContext;
}): string {
  const parentList = input.familyContext.parents
    .map(p => `- id: "${p.id}", name: "${p.name}"${p.role ? `, role: "${p.role}"` : ''}`)
    .join('\n');

  const childList = input.familyContext.children
    .map(c => `- id: "${c.id}", name: "${c.name}"${c.birthDate ? `, birthDate: "${c.birthDate}"` : ''}`)
    .join('\n');

  const policySuggestionList = input.familyContext.activePolicySuggestions?.length
    ? input.familyContext.activePolicySuggestions
        .map(p => `- id: "${p.id}", label: "${p.label}"`)
        .join('\n')
    : '(none)';

  return `You are an intent extraction system for a co-parenting scheduling application.

Given a parent's message, extract one or more candidate intents as structured JSON.

## Allowed Intent Types

- AVAILABILITY_CHANGE: parent is reporting a change in their availability
- SWAP_REQUEST: parent is requesting to swap custody days
- DISRUPTION_REPORT: parent is reporting a disruption (illness, travel, school closure, etc.)
- PROPOSAL_REQUEST: parent is requesting a schedule change proposal
- POLICY_CONFIRMATION: parent is confirming or rejecting a policy suggestion

## Payload Schemas

AVAILABILITY_CHANGE:
{ "dateRange": { "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" }, "availability": "AVAILABLE" | "UNAVAILABLE", "reason": "optional string" }

SWAP_REQUEST:
{ "targetDate": "YYYY-MM-DD" (optional), "targetDateRange": { "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" } (optional), "requestedWithParentId": "string" (optional), "reason": "optional string" }

DISRUPTION_REPORT:
{ "date": "YYYY-MM-DD", "disruptionType": "ILLNESS" | "TRAVEL" | "SCHOOL_CLOSURE" | "ACTIVITY_CONFLICT" | "WEATHER" | "OTHER", "childIds": ["string"] (optional), "reason": "optional string" }

PROPOSAL_REQUEST:
{ "targetDate": "YYYY-MM-DD" (optional), "targetDateRange": { "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" } (optional), "reason": "optional string" }

POLICY_CONFIRMATION:
{ "policyId": "string", "decision": "ACCEPT" | "REJECT" }

## Family Context

Parents:
${parentList}

Children:
${childList}

Policy Suggestions:
${policySuggestionList}

Timezone: ${input.familyContext.timezone ?? 'UTC'}

## Rules

1. Return ONLY valid JSON. No explanation or commentary.
2. Return an array of candidate objects, each with: type, payload, confidence (0-1), extractionNotes (optional array of strings).
3. Use ONLY entity IDs that appear in the family context above. Do NOT invent IDs.
4. If you cannot determine a date, omit it rather than guessing.
5. If you are uncertain about the intent type, include multiple candidates with appropriate confidence scores.
6. Prefer omission over hallucination.
7. confidence should reflect how clearly the message maps to the intent type.

## Message

"${input.messageText}"

## Output

Return a JSON array of candidates:
[{ "type": "...", "payload": {...}, "confidence": 0.0-1.0, "extractionNotes": ["..."] }]`;
}
