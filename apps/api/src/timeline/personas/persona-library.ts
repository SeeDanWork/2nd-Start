/**
 * Pre-built persona profiles for common co-parenting archetypes.
 * Each persona is designed to test different system behaviors.
 */

import { PersonaProfile } from './persona.types';

export const PERSONA_LIBRARY: Record<string, PersonaProfile> = {
  // ── Cooperative pair ─────────────────────────────────────
  cooperative_a: {
    id: 'cooperative_a',
    name: 'Cooperative Parent A',
    description: 'Responsive, flexible, accepts most proposals. Initiates occasional swaps.',
    role: 'parent_a',
    phoneNumber: '+15550001001',
    responsiveness: 0.9,
    cooperativeness: 0.85,
    initiationRate: 0.15,
    disruptionFrequency: 0.05,
    communicationStyle: 'normal',
    preferredDays: [1, 2, 3],      // Mon–Wed
    avoidDays: [],
    acceptThreshold: 15.0,
    optionPreference: 'first',
    responseDelayMinutes: { min: 5, max: 30 },
    activeHours: { start: 7, end: 21 },
  },

  cooperative_b: {
    id: 'cooperative_b',
    name: 'Cooperative Parent B',
    description: 'Responsive, flexible, accepts most proposals.',
    role: 'parent_b',
    phoneNumber: '+15550001002',
    responsiveness: 0.85,
    cooperativeness: 0.80,
    initiationRate: 0.10,
    disruptionFrequency: 0.05,
    communicationStyle: 'normal',
    preferredDays: [4, 5, 6, 0],   // Thu–Sun
    avoidDays: [],
    acceptThreshold: 12.0,
    optionPreference: 'best_fairness',
    responseDelayMinutes: { min: 10, max: 60 },
    activeHours: { start: 8, end: 22 },
  },

  // ── Busy professional pair ───────────────────────────────
  busy_professional_a: {
    id: 'busy_professional_a',
    name: 'Busy Professional A',
    description: 'Slow to respond, frequent work-travel disruptions, but cooperative when engaged.',
    role: 'parent_a',
    phoneNumber: '+15550002001',
    responsiveness: 0.4,
    cooperativeness: 0.7,
    initiationRate: 0.25,
    disruptionFrequency: 0.20,
    communicationStyle: 'terse',
    preferredDays: [5, 6, 0],       // Weekends + Fri
    avoidDays: [2, 3],              // Tue, Wed often traveling
    acceptThreshold: 10.0,
    optionPreference: 'least_change',
    responseDelayMinutes: { min: 60, max: 480 },
    activeHours: { start: 6, end: 23 },
  },

  busy_professional_b: {
    id: 'busy_professional_b',
    name: 'Flexible Stay-at-home B',
    description: 'Very responsive, high cooperativeness, rarely initiates changes.',
    role: 'parent_b',
    phoneNumber: '+15550002002',
    responsiveness: 0.95,
    cooperativeness: 0.90,
    initiationRate: 0.05,
    disruptionFrequency: 0.03,
    communicationStyle: 'normal',
    preferredDays: [1, 2, 3, 4],
    avoidDays: [],
    acceptThreshold: 20.0,
    optionPreference: 'first',
    responseDelayMinutes: { min: 2, max: 15 },
    activeHours: { start: 7, end: 21 },
  },

  // ── High-conflict pair ───────────────────────────────────
  high_conflict_a: {
    id: 'high_conflict_a',
    name: 'Resistant Parent A',
    description: 'Slow to respond, declines frequently, strict on fairness.',
    role: 'parent_a',
    phoneNumber: '+15550003001',
    responsiveness: 0.3,
    cooperativeness: 0.25,
    initiationRate: 0.30,
    disruptionFrequency: 0.10,
    communicationStyle: 'terse',
    preferredDays: [5, 6, 0],
    avoidDays: [],
    acceptThreshold: 5.0,
    optionPreference: 'best_fairness',
    responseDelayMinutes: { min: 120, max: 720 },
    activeHours: { start: 9, end: 20 },
  },

  high_conflict_b: {
    id: 'high_conflict_b',
    name: 'Resistant Parent B',
    description: 'Initiates frequent requests, declines proposals that don\'t favor them.',
    role: 'parent_b',
    phoneNumber: '+15550003002',
    responsiveness: 0.5,
    cooperativeness: 0.30,
    initiationRate: 0.35,
    disruptionFrequency: 0.15,
    communicationStyle: 'verbose',
    preferredDays: [5, 6, 0],
    avoidDays: [],
    acceptThreshold: 4.0,
    optionPreference: 'best_fairness',
    responseDelayMinutes: { min: 30, max: 360 },
    activeHours: { start: 8, end: 22 },
  },

  // ── Long-distance pair ───────────────────────────────────
  long_distance_a: {
    id: 'long_distance_a',
    name: 'Local Custodial A',
    description: 'Primary custodial parent, school-week anchor, occasional weekend flexibility.',
    role: 'parent_a',
    phoneNumber: '+15550004001',
    responsiveness: 0.75,
    cooperativeness: 0.65,
    initiationRate: 0.10,
    disruptionFrequency: 0.08,
    communicationStyle: 'normal',
    preferredDays: [1, 2, 3, 4],
    avoidDays: [],
    acceptThreshold: 8.0,
    optionPreference: 'least_change',
    responseDelayMinutes: { min: 15, max: 90 },
    activeHours: { start: 7, end: 21 },
  },

  long_distance_b: {
    id: 'long_distance_b',
    name: 'Long-Distance B',
    description: 'Weekend/holiday focus, wants maximized block time, proactive requester.',
    role: 'parent_b',
    phoneNumber: '+15550004002',
    responsiveness: 0.80,
    cooperativeness: 0.70,
    initiationRate: 0.30,
    disruptionFrequency: 0.05,
    communicationStyle: 'normal',
    preferredDays: [5, 6, 0],
    avoidDays: [1, 2, 3],
    acceptThreshold: 12.0,
    optionPreference: 'first',
    responseDelayMinutes: { min: 10, max: 60 },
    activeHours: { start: 8, end: 22 },
  },
};

export function getPersonaPair(pairName: string): [PersonaProfile, PersonaProfile] | null {
  const pairs: Record<string, [string, string]> = {
    cooperative: ['cooperative_a', 'cooperative_b'],
    busy_professional: ['busy_professional_a', 'busy_professional_b'],
    high_conflict: ['high_conflict_a', 'high_conflict_b'],
    long_distance: ['long_distance_a', 'long_distance_b'],
  };

  const pair = pairs[pairName];
  if (!pair) return null;

  return [PERSONA_LIBRARY[pair[0]], PERSONA_LIBRARY[pair[1]]];
}

export function listPersonaPairs(): string[] {
  return ['cooperative', 'busy_professional', 'high_conflict', 'long_distance'];
}
