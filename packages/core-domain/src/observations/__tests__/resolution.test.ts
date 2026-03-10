import { describe, it, expect, beforeEach } from 'vitest';
import { PolicySuggestionResolutionWorkflow } from '../suggestions/PolicySuggestionResolutionWorkflow';
import { PolicySuggestion } from '../types';
import { IPolicySuggestionRepository } from '../repositories/IPolicySuggestionRepository';
import { IPolicyRuleRepository } from '../../policy/repositories/IPolicyRuleRepository';
import { TypedPolicyRule } from '../../policy/types/TypedPolicyRule';

// ─── In-memory repositories ─────────────────────────────────

class InMemorySuggestionRepo implements IPolicySuggestionRepository {
  suggestions: PolicySuggestion[] = [];
  async save(s: PolicySuggestion) { this.suggestions.push(s); }
  async findById(id: string) { return this.suggestions.find(s => s.suggestionId === id) ?? null; }
  async findByFamilyId(fid: string) { return this.suggestions.filter(s => s.familyId === fid); }
  async findPendingByFamilyId(fid: string) {
    return this.suggestions.filter(s => s.familyId === fid && s.status === 'PENDING_REVIEW');
  }
  async update(s: PolicySuggestion) {
    const idx = this.suggestions.findIndex(x => x.suggestionId === s.suggestionId);
    if (idx >= 0) this.suggestions[idx] = s;
  }
}

class InMemoryPolicyRuleRepo implements IPolicyRuleRepository {
  rules: TypedPolicyRule[] = [];
  async findById(id: string) { return this.rules.find(r => r.id === id) ?? null; }
  async findByFamilyId(fid: string) { return this.rules.filter(r => r.familyId === fid); }
  async findActiveByFamilyId(fid: string) { return this.rules.filter(r => r.familyId === fid && r.active); }
  async save(r: TypedPolicyRule) { this.rules.push(r); }
  async update(r: TypedPolicyRule) {
    const idx = this.rules.findIndex(x => x.id === r.id);
    if (idx >= 0) this.rules[idx] = r;
  }
  async delete(id: string) { this.rules = this.rules.filter(r => r.id !== id); }
}

// ─── Test fixtures ───────────────────────────────────────────

function makePendingSuggestion(overrides?: Partial<PolicySuggestion>): PolicySuggestion {
  return {
    suggestionId: 'sug-1',
    familyId: 'fam-1',
    suggestionType: 'MIN_BLOCK_LENGTH_ADJUSTMENT',
    status: 'PENDING_REVIEW',
    confidenceScore: 0.85,
    evidenceSummary: {
      occurrenceCount: 4,
      windowStart: '2026-03-01',
      windowEnd: '2026-03-31',
      representativeExamples: [],
    },
    proposedRuleType: 'MIN_BLOCK_LENGTH',
    proposedPriority: 'SOFT',
    proposedParameters: { nights: 3 },
    proposedScope: { scopeType: 'FAMILY' },
    createdAt: '2026-03-25T10:00:00Z',
    ...overrides,
  };
}

describe('PolicySuggestionResolutionWorkflow', () => {
  let suggestionRepo: InMemorySuggestionRepo;
  let policyRepo: InMemoryPolicyRuleRepo;
  let workflow: PolicySuggestionResolutionWorkflow;
  let idCounter: number;

  beforeEach(() => {
    suggestionRepo = new InMemorySuggestionRepo();
    policyRepo = new InMemoryPolicyRuleRepo();
    idCounter = 0;
    workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: (prefix) => `${prefix}-${++idCounter}`,
    });
  });

  it('accepting suggestion creates policy rule', async () => {
    suggestionRepo.suggestions.push(makePendingSuggestion());

    const result = await workflow.resolveSuggestion({
      suggestionId: 'sug-1',
      decision: 'ACCEPT',
      resolvedAt: '2026-03-26T10:00:00Z',
      resolvedBy: 'parent-p1',
    });

    expect(result.status).toBe('ACCEPTED');
    expect(result.createdPolicyRuleId).toBeDefined();

    // Verify policy rule was created
    const rule = await policyRepo.findById(result.createdPolicyRuleId!);
    expect(rule).not.toBeNull();
    expect(rule!.ruleType).toBe('MIN_BLOCK_LENGTH');
    expect(rule!.priority).toBe('SOFT');
    expect(rule!.active).toBe(true);
    expect(rule!.parameters).toEqual({ nights: 3 });

    // Verify suggestion was updated
    const s = await suggestionRepo.findById('sug-1');
    expect(s!.status).toBe('ACCEPTED');
    expect(s!.resolvedAt).toBe('2026-03-26T10:00:00Z');
  });

  it('rejecting suggestion does not create policy rule', async () => {
    suggestionRepo.suggestions.push(makePendingSuggestion());

    const result = await workflow.resolveSuggestion({
      suggestionId: 'sug-1',
      decision: 'REJECT',
      resolvedAt: '2026-03-26T10:00:00Z',
      resolvedBy: 'parent-p1',
    });

    expect(result.status).toBe('REJECTED');
    expect(result.createdPolicyRuleId).toBeUndefined();
    expect(policyRepo.rules).toHaveLength(0);

    const s = await suggestionRepo.findById('sug-1');
    expect(s!.status).toBe('REJECTED');
  });

  it('non-pending suggestion cannot be resolved twice', async () => {
    suggestionRepo.suggestions.push(makePendingSuggestion({ status: 'ACCEPTED' }));

    await expect(
      workflow.resolveSuggestion({
        suggestionId: 'sug-1',
        decision: 'ACCEPT',
        resolvedAt: '2026-03-27T10:00:00Z',
        resolvedBy: 'parent-p1',
      }),
    ).rejects.toThrow('not pending review');
  });

  it('unsupported conversion fails explicitly', async () => {
    // PREFERRED_EXCHANGE_DAY has no clean mapping
    suggestionRepo.suggestions.push(makePendingSuggestion({
      suggestionType: 'PREFERRED_EXCHANGE_DAY',
    }));

    await expect(
      workflow.resolveSuggestion({
        suggestionId: 'sug-1',
        decision: 'ACCEPT',
        resolvedAt: '2026-03-26T10:00:00Z',
        resolvedBy: 'parent-p1',
      }),
    ).rejects.toThrow('Unsupported suggestion conversion');
  });

  it('non-existent suggestion throws', async () => {
    await expect(
      workflow.resolveSuggestion({
        suggestionId: 'nonexistent',
        decision: 'ACCEPT',
        resolvedAt: '2026-03-26T10:00:00Z',
        resolvedBy: 'parent-p1',
      }),
    ).rejects.toThrow('Suggestion not found');
  });

  it('accepts ACTIVITY_RESPONSIBILITY_RULE correctly', async () => {
    suggestionRepo.suggestions.push(makePendingSuggestion({
      suggestionType: 'ACTIVITY_RESPONSIBILITY_RULE',
      proposedRuleType: 'ACTIVITY_COMMITMENT',
      proposedParameters: { activityLabel: 'soccer', preferredResponsibleParentId: 'p2' },
    }));

    const result = await workflow.resolveSuggestion({
      suggestionId: 'sug-1',
      decision: 'ACCEPT',
      resolvedAt: '2026-03-26T10:00:00Z',
      resolvedBy: 'parent-p1',
    });

    expect(result.status).toBe('ACCEPTED');
    const rule = await policyRepo.findById(result.createdPolicyRuleId!);
    expect(rule!.ruleType).toBe('ACTIVITY_COMMITMENT');
    expect(rule!.parameters).toEqual({ activityLabel: 'soccer', preferredResponsibleParentId: 'p2' });
  });

  it('accepts SIBLING_DIVERGENCE_PREFERENCE correctly', async () => {
    suggestionRepo.suggestions.push(makePendingSuggestion({
      suggestionType: 'SIBLING_DIVERGENCE_PREFERENCE',
      proposedRuleType: 'SIBLING_COHESION',
      proposedParameters: { allowDivergence: true },
    }));

    const result = await workflow.resolveSuggestion({
      suggestionId: 'sug-1',
      decision: 'ACCEPT',
      resolvedAt: '2026-03-26T10:00:00Z',
      resolvedBy: 'parent-p1',
    });

    expect(result.status).toBe('ACCEPTED');
    const rule = await policyRepo.findById(result.createdPolicyRuleId!);
    expect(rule!.ruleType).toBe('SIBLING_COHESION');
  });
});
