// ── Session Store ────────────────────────────────────────────
// In-memory store for conversation sessions.
// Maps scenario IDs to their sessions.
// Uses globalThis for HMR persistence like store.ts.

import { ConversationSession, createSession } from './session';
import { ScenarioConfig } from '../types';

const globalForStore = globalThis as unknown as {
  __sessionStore?: Map<string, ConversationSession>;
};
const sessions = globalForStore.__sessionStore ??= new Map<string, ConversationSession>();

/** Get or create a session for a scenario. */
export function getOrCreateSession(
  scenarioId: string,
  config: ScenarioConfig,
): ConversationSession {
  let session = sessions.get(scenarioId);
  if (!session) {
    session = createSession(scenarioId, config);
    sessions.set(scenarioId, session);
  }
  return session;
}

/** Get an existing session. */
export function getSession(scenarioId: string): ConversationSession | null {
  return sessions.get(scenarioId) || null;
}

/** Delete a session. */
export function deleteSession(scenarioId: string): boolean {
  return sessions.delete(scenarioId);
}

/** List all sessions. */
export function listSessions(): ConversationSession[] {
  return Array.from(sessions.values());
}
