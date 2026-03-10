import {
  SuggestionResolutionInput,
  SuggestionResolutionResult,
  PolicySuggestionType,
} from '../types';
import { IPolicySuggestionRepository } from '../repositories/IPolicySuggestionRepository';
import { IPolicyRuleRepository } from '../../policy/repositories/IPolicyRuleRepository';
import {
  PolicySuggestionResolutionError,
  UnsupportedSuggestionConversionError,
} from '../errors';
import { PolicyRuleType } from '../../enums/PolicyRuleType';
import { PolicyPriority } from '../../enums/PolicyPriority';
import { TypedPolicyRule } from '../../policy/types/TypedPolicyRule';

/** Maps suggestion types to their rule conversion configs */
const CONVERSION_MAP: Record<PolicySuggestionType, {
  ruleType: PolicyRuleType;
  supported: boolean;
} | null> = {
  PREFERRED_EXCHANGE_DAY: null, // No clean rule mapping yet
  PREFERRED_EXCHANGE_LOCATION: {
    ruleType: PolicyRuleType.EXCHANGE_LOCATION,
    supported: true,
  },
  SCHOOL_CLOSURE_COVERAGE_PREFERENCE: {
    ruleType: PolicyRuleType.ACTIVITY_COMMITMENT,
    supported: true,
  },
  MIN_BLOCK_LENGTH_ADJUSTMENT: {
    ruleType: PolicyRuleType.MIN_BLOCK_LENGTH,
    supported: true,
  },
  ACTIVITY_RESPONSIBILITY_RULE: {
    ruleType: PolicyRuleType.ACTIVITY_COMMITMENT,
    supported: true,
  },
  SIBLING_DIVERGENCE_PREFERENCE: {
    ruleType: PolicyRuleType.SIBLING_COHESION,
    supported: true,
  },
};

export interface PolicySuggestionResolutionWorkflowDeps {
  suggestionRepository: IPolicySuggestionRepository;
  policyRuleRepository: IPolicyRuleRepository;
  idGenerator?: (prefix: string) => string;
}

let idCounter = 0;
function generateId(prefix: string): string {
  idCounter++;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

/**
 * Handles accepting or rejecting policy suggestions.
 * On acceptance, creates a real policy rule if the suggestion type is supported.
 */
export class PolicySuggestionResolutionWorkflow {
  private readonly suggestionRepo: IPolicySuggestionRepository;
  private readonly policyRepo: IPolicyRuleRepository;
  private readonly genId: (prefix: string) => string;

  constructor(deps: PolicySuggestionResolutionWorkflowDeps) {
    this.suggestionRepo = deps.suggestionRepository;
    this.policyRepo = deps.policyRuleRepository;
    this.genId = deps.idGenerator ?? generateId;
  }

  async resolveSuggestion(input: SuggestionResolutionInput): Promise<SuggestionResolutionResult> {
    const suggestion = await this.suggestionRepo.findById(input.suggestionId);

    if (!suggestion) {
      throw new PolicySuggestionResolutionError(
        `Suggestion not found: ${input.suggestionId}`,
      );
    }

    if (suggestion.status !== 'PENDING_REVIEW') {
      throw new PolicySuggestionResolutionError(
        `Suggestion ${input.suggestionId} is not pending review (status: ${suggestion.status})`,
      );
    }

    if (input.decision === 'REJECT') {
      suggestion.status = 'REJECTED';
      suggestion.resolvedAt = input.resolvedAt;
      suggestion.resolvedBy = input.resolvedBy;
      await this.suggestionRepo.update(suggestion);

      return {
        suggestionId: suggestion.suggestionId,
        status: 'REJECTED',
      };
    }

    // ACCEPT path
    const conversion = CONVERSION_MAP[suggestion.suggestionType];

    if (!conversion || !conversion.supported) {
      throw new UnsupportedSuggestionConversionError(suggestion.suggestionType);
    }

    // Idempotency check: if a rule was already created for this suggestion
    // (e.g., from a prior attempt where rule save succeeded but suggestion
    // update failed), reuse it instead of creating a duplicate.
    const existingRule = await this.policyRepo.findBySourceSuggestionId(input.suggestionId);

    let ruleId: string;

    if (existingRule) {
      // Rule already exists from a previous partial acceptance — reuse it
      ruleId = existingRule.id;
    } else {
      // Convert priority string to enum
      const priority = this.toPriority(suggestion.proposedPriority);

      // Create the policy rule
      ruleId = this.genId('rule');
      const now = input.resolvedAt;

      const rule: TypedPolicyRule = {
        id: ruleId,
        familyId: suggestion.familyId,
        ruleType: conversion.ruleType,
        priority,
        active: true,
        label: `Auto-suggested: ${suggestion.suggestionType}`,
        scope: suggestion.proposedScope
          ? {
              scopeType: suggestion.proposedScope.scopeType,
              childId: suggestion.proposedScope.childId,
              dateStart: suggestion.proposedScope.dateStart,
              dateEnd: suggestion.proposedScope.dateEnd,
            }
          : { scopeType: 'FAMILY' },
        parameters: suggestion.proposedParameters,
        sourceSuggestionId: input.suggestionId,
        createdAt: now,
        updatedAt: now,
      };

      await this.policyRepo.save(rule);
    }

    // Update suggestion status
    suggestion.status = 'ACCEPTED';
    suggestion.resolvedAt = input.resolvedAt;
    suggestion.resolvedBy = input.resolvedBy;
    await this.suggestionRepo.update(suggestion);

    return {
      suggestionId: suggestion.suggestionId,
      status: 'ACCEPTED',
      createdPolicyRuleId: ruleId,
    };
  }

  private toPriority(str: string): PolicyPriority {
    const upper = str.toUpperCase();
    if (upper === 'HARD') return PolicyPriority.HARD;
    if (upper === 'STRONG') return PolicyPriority.STRONG;
    return PolicyPriority.SOFT;
  }
}
