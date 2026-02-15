import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConstraintSet, Constraint, AuditLog } from '../entities';
import {
  AuditAction,
  AuditEntityType,
  ConstraintType,
  ParentRole,
} from '@adcp/shared';

@Injectable()
export class ConstraintsService {
  constructor(
    @InjectRepository(ConstraintSet)
    private readonly setRepo: Repository<ConstraintSet>,
    @InjectRepository(Constraint)
    private readonly constraintRepo: Repository<Constraint>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async getActiveConstraintSet(familyId: string): Promise<ConstraintSet & { constraints: Constraint[] }> {
    const set = await this.setRepo.findOne({
      where: { familyId, isActive: true },
      relations: ['constraints'],
    });
    if (!set) throw new NotFoundException('No active constraint set found');
    return set as ConstraintSet & { constraints: Constraint[] };
  }

  async addConstraint(
    familyId: string,
    userId: string,
    data: {
      type: string;
      hardness: string;
      weight: number;
      owner: string;
      recurrence?: Record<string, unknown>;
      dateRange?: Record<string, unknown>;
      parameters: Record<string, unknown>;
    },
  ): Promise<Constraint> {
    const set = await this.getActiveConstraintSet(familyId);

    // Basic conflict detection for locked nights
    if (data.type === ConstraintType.LOCKED_NIGHT && data.parameters.daysOfWeek) {
      const existingLocks = set.constraints.filter(
        (c) => c.type === ConstraintType.LOCKED_NIGHT,
      );
      const requestedDays = data.parameters.daysOfWeek as number[];
      for (const existing of existingLocks) {
        const existingDays = (existing.parameters as Record<string, unknown>).daysOfWeek as number[];
        const overlap = requestedDays.filter((d) => existingDays.includes(d));
        if (overlap.length > 0) {
          const existingParent = (existing.parameters as Record<string, unknown>).parent;
          if (existingParent !== data.parameters.parent) {
            throw new BadRequestException(
              `Conflict: day(s) ${overlap.join(', ')} are already locked to another parent`,
            );
          }
        }
      }
    }

    const constraint = await this.constraintRepo.save(
      this.constraintRepo.create({
        constraintSetId: set.id,
        type: data.type,
        hardness: data.hardness,
        weight: data.weight,
        owner: data.owner,
        recurrence: data.recurrence || null,
        dateRange: data.dateRange || null,
        parameters: data.parameters,
      }),
    );

    // Bump version
    set.version += 1;
    await this.setRepo.save(set);

    await this.auditRepo.save(
      this.auditRepo.create({
        familyId,
        actorId: userId,
        action: AuditAction.CONSTRAINT_ADDED,
        entityType: AuditEntityType.CONSTRAINT,
        entityId: constraint.id,
        metadata: { type: data.type, constraintSetVersion: set.version },
      }),
    );

    return constraint;
  }

  async updateConstraint(
    familyId: string,
    constraintId: string,
    userId: string,
    data: Partial<{
      hardness: string;
      weight: number;
      owner: string;
      recurrence: Record<string, unknown>;
      dateRange: Record<string, unknown>;
      parameters: Record<string, unknown>;
    }>,
  ): Promise<Constraint> {
    const set = await this.getActiveConstraintSet(familyId);
    const constraint = set.constraints.find((c) => c.id === constraintId);
    if (!constraint) throw new NotFoundException('Constraint not found');

    Object.assign(constraint, data);
    await this.constraintRepo.save(constraint);

    set.version += 1;
    await this.setRepo.save(set);

    await this.auditRepo.save(
      this.auditRepo.create({
        familyId,
        actorId: userId,
        action: AuditAction.CONSTRAINT_UPDATED,
        entityType: AuditEntityType.CONSTRAINT,
        entityId: constraintId,
        metadata: { constraintSetVersion: set.version },
      }),
    );

    return constraint;
  }

  async removeConstraint(
    familyId: string,
    constraintId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const set = await this.getActiveConstraintSet(familyId);
    const constraint = set.constraints.find((c) => c.id === constraintId);
    if (!constraint) throw new NotFoundException('Constraint not found');

    await this.constraintRepo.remove(constraint);

    set.version += 1;
    await this.setRepo.save(set);

    await this.auditRepo.save(
      this.auditRepo.create({
        familyId,
        actorId: userId,
        action: AuditAction.CONSTRAINT_REMOVED,
        entityType: AuditEntityType.CONSTRAINT,
        entityId: constraintId,
        metadata: { constraintSetVersion: set.version },
      }),
    );

    return { message: 'Constraint removed' };
  }

  async validateConstraints(familyId: string): Promise<{
    valid: boolean;
    conflicts: Array<{ description: string; constraintIds: string[] }>;
  }> {
    const set = await this.getActiveConstraintSet(familyId);
    const conflicts: Array<{ description: string; constraintIds: string[] }> = [];

    // Check locked night overlaps
    const locks = set.constraints.filter((c) => c.type === ConstraintType.LOCKED_NIGHT);
    const dayMap = new Map<number, { parent: string; constraintId: string }[]>();
    for (const lock of locks) {
      const params = lock.parameters as { parent: string; daysOfWeek: number[] };
      for (const day of params.daysOfWeek) {
        if (!dayMap.has(day)) dayMap.set(day, []);
        dayMap.get(day)!.push({ parent: params.parent, constraintId: lock.id });
      }
    }
    for (const [day, entries] of dayMap) {
      const parents = new Set(entries.map((e) => e.parent));
      if (parents.size > 1) {
        conflicts.push({
          description: `Day ${day} is locked to multiple parents`,
          constraintIds: entries.map((e) => e.constraintId),
        });
      }
    }

    // Check total locked days don't exceed 7
    const lockedByParent = new Map<string, Set<number>>();
    for (const lock of locks) {
      const params = lock.parameters as { parent: string; daysOfWeek: number[] };
      if (!lockedByParent.has(params.parent)) lockedByParent.set(params.parent, new Set());
      for (const d of params.daysOfWeek) lockedByParent.get(params.parent)!.add(d);
    }
    const totalLocked = Array.from(lockedByParent.values()).reduce((sum, s) => sum + s.size, 0);
    if (totalLocked >= 7) {
      conflicts.push({
        description: 'All 7 days are locked — no flexibility for scheduling',
        constraintIds: locks.map((l) => l.id),
      });
    }

    return { valid: conflicts.length === 0, conflicts };
  }
}
