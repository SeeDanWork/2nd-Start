import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import {
  BaseScheduleVersion,
  OvernightAssignment,
  FamilyMembership,
  AuditLog,
} from '../entities';

@Controller('viewer')
export class ViewerController {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(BaseScheduleVersion)
    private readonly versionRepo: Repository<BaseScheduleVersion>,
    @InjectRepository(OvernightAssignment)
    private readonly assignmentRepo: Repository<OvernightAssignment>,
    @InjectRepository(FamilyMembership)
    private readonly membershipRepo: Repository<FamilyMembership>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  @Get('validate/:token')
  validateToken(@Param('token') token: string) {
    try {
      const payload = this.jwtService.verify(token);
      return {
        valid: true,
        familyId: payload.familyId,
        expiresAt: new Date(payload.exp * 1000),
      };
    } catch {
      return { valid: false };
    }
  }

  @Get(':token/schedule')
  async getSchedule(
    @Param('token') token: string,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    const payload = this.verifyToken(token);

    const version = await this.versionRepo.findOne({
      where: { familyId: payload.familyId, isActive: true },
    });

    if (!version) {
      return { assignments: [], version: null };
    }

    const assignments = await this.assignmentRepo.find({
      where: {
        scheduleVersionId: version.id,
        date: Between(start, end),
      },
      order: { date: 'ASC' },
    });

    const members = await this.membershipRepo.find({
      where: { familyId: payload.familyId },
    });

    const parentA = members.find(m => m.role === 'parent_a');
    const parentB = members.find(m => m.role === 'parent_b');

    return {
      version: version.version,
      solverStatus: version.solverStatus,
      assignments: assignments.map(a => ({
        date: a.date,
        assignedTo: a.assignedTo,
        isTransition: a.isTransition,
      })),
      parentALabel: parentA?.label || 'Parent A',
      parentBLabel: parentB?.label || 'Parent B',
    };
  }

  @Get(':token/metrics')
  async getMetrics(@Param('token') token: string) {
    const payload = this.verifyToken(token);

    const version = await this.versionRepo.findOne({
      where: { familyId: payload.familyId, isActive: true },
    });

    if (!version) {
      return null;
    }

    // Compute metrics from assignments (last 28 days)
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 28);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = now.toISOString().slice(0, 10);

    const assignments = await this.assignmentRepo.find({
      where: {
        scheduleVersionId: version.id,
        date: Between(startStr, endStr),
      },
      order: { date: 'ASC' },
    });

    const total = assignments.length;
    const aNights = assignments.filter(a => a.assignedTo === 'parent_a').length;
    const bNights = total - aNights;
    const aPercent = total > 0 ? Math.round((aNights / total) * 100) : 50;

    // Count transitions
    let transitions = 0;
    for (let i = 1; i < assignments.length; i++) {
      if (assignments[i].assignedTo !== assignments[i - 1].assignedTo) {
        transitions++;
      }
    }
    const weeks = Math.max(1, total / 7);
    const transPerWeek = Math.round((transitions / weeks) * 10) / 10;

    // Max consecutive
    let maxConsecA = 0, maxConsecB = 0, curA = 0, curB = 0;
    for (const a of assignments) {
      if (a.assignedTo === 'parent_a') { curA++; curB = 0; maxConsecA = Math.max(maxConsecA, curA); }
      else { curB++; curA = 0; maxConsecB = Math.max(maxConsecB, curB); }
    }

    return {
      parentANights: aNights,
      parentBNights: bNights,
      parentAPercent: aPercent,
      parentBPercent: 100 - aPercent,
      transitionsPerWeek: transPerWeek,
      maxConsecutiveA: maxConsecA,
      maxConsecutiveB: maxConsecB,
      totalDays: total,
    };
  }

  @Get(':token/history')
  async getHistory(@Param('token') token: string) {
    const payload = this.verifyToken(token);

    const logs = await this.auditLogRepo.find({
      where: { familyId: payload.familyId },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    return logs;
  }

  private verifyToken(token: string): { familyId: string; sub: string } {
    try {
      return this.jwtService.verify(token);
    } catch {
      throw new NotFoundException('Invalid or expired token');
    }
  }
}
