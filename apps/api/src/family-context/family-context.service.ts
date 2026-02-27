import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Family, Child } from '../entities';
import {
  computeFamilyContextDefaults,
  type FamilyContextDefaults,
  type FamilyGoals,
  DEFAULT_SOLVER_WEIGHTS,
  AGE_WEIGHT_MULTIPLIERS,
} from '@adcp/shared';

const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class FamilyContextService {
  private readonly logger = new Logger(FamilyContextService.name);

  constructor(
    @InjectRepository(Family)
    private readonly familyRepo: Repository<Family>,
    @InjectRepository(Child)
    private readonly childRepo: Repository<Child>,
  ) {}

  /**
   * Get context, recomputing if stale (>24h) or missing.
   */
  async getContext(familyId: string): Promise<FamilyContextDefaults> {
    const family = await this.familyRepo.findOne({
      where: { id: familyId },
      relations: ['children'],
    });

    if (!family) {
      this.logger.warn(`Family ${familyId} not found, returning school-age defaults`);
      return computeFamilyContextDefaults([]);
    }

    // Check if cached context is fresh
    const cached = family.familyContext as Record<string, unknown> | null;
    if (cached?.computedAt) {
      const computedAt = new Date(cached.computedAt as string).getTime();
      if (Date.now() - computedAt < STALE_MS) {
        return this.extractDefaults(cached);
      }
    }

    // Recompute
    return this.computeAndStore(family);
  }

  /**
   * Force recompute (called on child CRUD, goals change).
   */
  async refreshContext(familyId: string): Promise<FamilyContextDefaults> {
    const family = await this.familyRepo.findOne({
      where: { id: familyId },
      relations: ['children'],
    });

    if (!family) {
      this.logger.warn(`Family ${familyId} not found during refresh`);
      return computeFamilyContextDefaults([]);
    }

    return this.computeAndStore(family);
  }

  /**
   * Get age-adjusted solver weights for this family.
   */
  getAdjustedWeights(context: FamilyContextDefaults): Record<keyof typeof DEFAULT_SOLVER_WEIGHTS, number> {
    const multipliers = AGE_WEIGHT_MULTIPLIERS[context.solverWeightProfile]
      ?? AGE_WEIGHT_MULTIPLIERS['school_age'];

    return {
      fairnessDeviation: Math.round(DEFAULT_SOLVER_WEIGHTS.fairnessDeviation * (multipliers.fairnessDeviation ?? 1)),
      totalTransitions: Math.round(DEFAULT_SOLVER_WEIGHTS.totalTransitions * (multipliers.totalTransitions ?? 1)),
      nonDaycareHandoffs: Math.round(DEFAULT_SOLVER_WEIGHTS.nonDaycareHandoffs * (multipliers.nonDaycareHandoffs ?? 1)),
      weekendFragmentation: Math.round(DEFAULT_SOLVER_WEIGHTS.weekendFragmentation * (multipliers.weekendFragmentation ?? 1)),
      schoolNightDisruption: Math.round(DEFAULT_SOLVER_WEIGHTS.schoolNightDisruption * (multipliers.schoolNightDisruption ?? 1)),
    };
  }

  /**
   * Get age-appropriate maxConsecutive (for guardrails/proposals fallback).
   */
  getMaxConsecutiveDefault(context: FamilyContextDefaults): number {
    return context.maxConsecutive;
  }

  // ─── Private ────────────────────────────────────────────────

  private async computeAndStore(family: Family): Promise<FamilyContextDefaults> {
    const children = (family.children ?? []).map((c) => ({
      childId: c.id,
      dateOfBirth: c.dateOfBirth,
    }));

    // Extract goals from onboardingInput if available
    const goals = this.extractGoals(family);

    const defaults = computeFamilyContextDefaults(children, goals);

    // Store in JSONB column
    const stored = {
      ...defaults,
      goals,
      computedAt: new Date().toISOString(),
    };

    await this.familyRepo.update(family.id, {
      familyContext: stored,
    } as any);

    this.logger.log(
      `Computed family context for ${family.id}: youngest=${defaults.youngestBand}, profile=${defaults.solverWeightProfile}`,
    );

    return defaults;
  }

  private extractGoals(family: Family): FamilyGoals {
    const input = family.onboardingInput as Record<string, any> | null;
    if (!input?.goals) {
      return { stabilityFirst: false, minimizeSeparation: false, fairnessStrict: false };
    }
    const g = input.goals;
    return {
      stabilityFirst: !!g.stabilityFirst,
      minimizeSeparation: !!g.minimizeSeparation,
      fairnessStrict: !!g.fairnessStrict,
    };
  }

  private extractDefaults(cached: Record<string, unknown>): FamilyContextDefaults {
    return {
      youngestBand: cached.youngestBand as FamilyContextDefaults['youngestBand'],
      maxConsecutive: cached.maxConsecutive as number,
      maxAway: cached.maxAway as number,
      preferredTemplateIds: cached.preferredTemplateIds as FamilyContextDefaults['preferredTemplateIds'],
      perChild: cached.perChild as FamilyContextDefaults['perChild'],
      solverWeightProfile: cached.solverWeightProfile as FamilyContextDefaults['solverWeightProfile'],
    };
  }
}
