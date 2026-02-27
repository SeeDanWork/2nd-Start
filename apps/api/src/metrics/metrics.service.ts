import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import {
  LedgerSnapshot,
  StabilitySnapshot,
  OvernightAssignment,
  HandoffEvent,
  BaseScheduleVersion,
  Request,
  AuditLog,
} from '../entities';
import {
  LedgerWindowType,
  DEFAULT_FAIRNESS_BAND,
  RequestStatus,
} from '@adcp/shared';
import { SchedulesService } from '../schedules/schedules.service';
import { FamilyContextService } from '../family-context/family-context.service';

const WINDOW_WEEKS: Record<string, number> = {
  [LedgerWindowType.TWO_WEEK]: 2,
  [LedgerWindowType.FOUR_WEEK]: 4,
  [LedgerWindowType.EIGHT_WEEK]: 8,
  [LedgerWindowType.TWELVE_WEEK]: 12,
};

@Injectable()
export class MetricsService {
  constructor(
    @InjectRepository(LedgerSnapshot)
    private readonly ledgerRepo: Repository<LedgerSnapshot>,
    @InjectRepository(StabilitySnapshot)
    private readonly stabilityRepo: Repository<StabilitySnapshot>,
    @InjectRepository(OvernightAssignment)
    private readonly assignmentRepo: Repository<OvernightAssignment>,
    @InjectRepository(HandoffEvent)
    private readonly handoffRepo: Repository<HandoffEvent>,
    @InjectRepository(BaseScheduleVersion)
    private readonly versionRepo: Repository<BaseScheduleVersion>,
    @InjectRepository(Request)
    private readonly requestRepo: Repository<Request>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly schedulesService: SchedulesService,
    private readonly familyContextService: FamilyContextService,
  ) {}

  async computeLedger(
    familyId: string,
    versionId: string,
    windowType: string,
  ): Promise<LedgerSnapshot> {
    const weeks = WINDOW_WEEKS[windowType] || 8;
    const now = new Date();
    const windowEnd = now.toISOString().split('T')[0];
    const windowStartDate = new Date(now);
    windowStartDate.setDate(windowStartDate.getDate() - weeks * 7);
    const windowStart = windowStartDate.toISOString().split('T')[0];

    const assignments = await this.assignmentRepo.find({
      where: {
        familyId,
        scheduleVersionId: versionId,
        date: Between(windowStart, windowEnd),
      },
    });

    let parentAOvernights = 0;
    let parentBOvernights = 0;
    let parentAWeekendNights = 0;
    let parentBWeekendNights = 0;

    for (const a of assignments) {
      const d = new Date(a.date);
      const dow = d.getDay(); // 0=Sun
      const isWeekend = dow === 5 || dow === 6; // Fri/Sat

      if (a.assignedTo === 'parent_a') {
        parentAOvernights++;
        if (isWeekend) parentAWeekendNights++;
      } else {
        parentBOvernights++;
        if (isWeekend) parentBWeekendNights++;
      }
    }

    const delta = Math.abs(parentAOvernights - parentBOvernights);
    const withinBand = delta <= DEFAULT_FAIRNESS_BAND.maxOvernightDelta * weeks;

    const snapshot = await this.ledgerRepo.save(
      this.ledgerRepo.create({
        familyId,
        scheduleVersionId: versionId,
        windowType,
        windowStart,
        windowEnd,
        parentAOvernights,
        parentBOvernights,
        parentAWeekendNights,
        parentBWeekendNights,
        withinFairnessBand: withinBand,
        computedAt: new Date(),
      }),
    );

    return snapshot;
  }

  async computeStability(
    familyId: string,
    versionId: string,
    startDate: string,
    endDate: string,
  ): Promise<StabilitySnapshot> {
    const assignments = await this.assignmentRepo.find({
      where: {
        familyId,
        scheduleVersionId: versionId,
        date: Between(startDate, endDate),
      },
      order: { date: 'ASC' },
    });

    let transitions = 0;
    let maxConsecA = 0;
    let maxConsecB = 0;
    let curA = 0;
    let curB = 0;
    let schoolSame = 0;
    let schoolTotal = 0;
    let prevParent: string | null = null;
    let prevSchoolParent: string | null = null;
    const weekendFragWeeks = new Map<number, Set<string>>();

    for (const a of assignments) {
      if (prevParent !== null && a.assignedTo !== prevParent) transitions++;

      if (a.assignedTo === 'parent_a') {
        curA++;
        curB = 0;
        maxConsecA = Math.max(maxConsecA, curA);
      } else {
        curB++;
        curA = 0;
        maxConsecB = Math.max(maxConsecB, curB);
      }

      const d = new Date(a.date);
      const dow = d.getDay();
      const isSchoolNight = [0, 1, 2, 3, 4].includes(dow);
      if (isSchoolNight) {
        schoolTotal++;
        if (prevSchoolParent !== null && a.assignedTo === prevSchoolParent) schoolSame++;
        prevSchoolParent = a.assignedTo;
      }

      if (dow === 5 || dow === 6) {
        const weekNum = getISOWeek(d);
        if (!weekendFragWeeks.has(weekNum)) weekendFragWeeks.set(weekNum, new Set());
        weekendFragWeeks.get(weekNum)!.add(a.assignedTo);
      }

      prevParent = a.assignedTo;
    }

    const weeks = Math.max(assignments.length / 7, 1);
    const transitionsPerWeek = Math.round((transitions / weeks) * 100) / 100;
    const schoolPct = schoolTotal > 1
      ? Math.round((schoolSame / (schoolTotal - 1)) * 1000) / 10
      : 100;
    const fragCount = Array.from(weekendFragWeeks.values()).filter((s) => s.size > 1).length;

    const snapshot = await this.stabilityRepo.save(
      this.stabilityRepo.create({
        familyId,
        scheduleVersionId: versionId,
        windowStart: startDate,
        windowEnd: endDate,
        transitionsPerWeek,
        maxConsecutiveA: maxConsecA,
        maxConsecutiveB: maxConsecB,
        schoolNightConsistencyPct: schoolPct,
        weekendFragmentationCount: fragCount,
        computedAt: new Date(),
      }),
    );

    return snapshot;
  }

  async getLedger(familyId: string, windows: string[]): Promise<LedgerSnapshot[]> {
    const active = await this.schedulesService.getActiveSchedule(familyId);
    if (!active) return [];

    const oneHourAgo = new Date(Date.now() - 3600_000);
    const existing = await this.ledgerRepo.find({
      where: { familyId, scheduleVersionId: active.id, windowType: In(windows) },
      order: { windowType: 'ASC' },
    });

    const fresh = existing.filter((s) => s.computedAt > oneHourAgo);
    const freshTypes = new Set(fresh.map((s) => s.windowType));
    const staleTypes = windows.filter((w) => !freshTypes.has(w));

    const recomputed: LedgerSnapshot[] = [];
    for (const wt of staleTypes) {
      recomputed.push(await this.computeLedger(familyId, active.id, wt));
    }

    return [...fresh, ...recomputed].sort(
      (a, b) => (WINDOW_WEEKS[a.windowType] || 0) - (WINDOW_WEEKS[b.windowType] || 0),
    );
  }

  async getStability(familyId: string, startDate: string, endDate: string): Promise<StabilitySnapshot | null> {
    const active = await this.schedulesService.getActiveSchedule(familyId);
    if (!active) return null;

    const oneHourAgo = new Date(Date.now() - 3600_000);
    const existing = await this.stabilityRepo.findOne({
      where: { familyId, scheduleVersionId: active.id, windowStart: startDate, windowEnd: endDate },
    });

    if (existing && existing.computedAt > oneHourAgo) return existing;
    return this.computeStability(familyId, active.id, startDate, endDate);
  }

  async getToday(familyId: string) {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const twoWeeksOut = new Date(today);
    twoWeeksOut.setDate(twoWeeksOut.getDate() + 14);
    const twoWeeksStr = twoWeeksOut.toISOString().split('T')[0];

    const active = await this.schedulesService.getActiveSchedule(familyId);

    let tonightAssignment: string | null = null;
    let tonightIsTransition = false;
    let nextHandoff: { date: string; type: string; fromParent: string; toParent: string } | null = null;

    if (active) {
      const todayAssignment = await this.assignmentRepo.findOne({
        where: { familyId, scheduleVersionId: active.id, date: todayStr },
      });
      if (todayAssignment) {
        tonightAssignment = todayAssignment.assignedTo;
        tonightIsTransition = todayAssignment.isTransition;
      }

      const upcomingHandoffs = await this.handoffRepo.find({
        where: { familyId, scheduleVersionId: active.id, date: Between(todayStr, twoWeeksStr) },
        order: { date: 'ASC' },
        take: 1,
      });
      if (upcomingHandoffs.length > 0) {
        const h = upcomingHandoffs[0];
        nextHandoff = { date: h.date, type: h.type, fromParent: h.fromParent, toParent: h.toParent };
      }
    }

    const ledger = await this.getLedger(familyId, [LedgerWindowType.EIGHT_WEEK]);
    const fairness = ledger.length > 0 ? ledger[0] : null;

    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const stability = await this.getStability(
      familyId,
      weekStart.toISOString().split('T')[0],
      weekEnd.toISOString().split('T')[0],
    );

    const [pendingRequests, familyCtx] = await Promise.all([
      this.requestRepo.count({
        where: { familyId, status: In([RequestStatus.PENDING, RequestStatus.PROPOSALS_GENERATED]) },
      }),
      this.familyContextService.getContext(familyId),
    ]);

    return {
      tonight: { date: todayStr, parent: tonightAssignment, isTransition: tonightIsTransition },
      nextHandoff,
      fairness: fairness ? {
        parentAOvernights: fairness.parentAOvernights,
        parentBOvernights: fairness.parentBOvernights,
        delta: Math.abs(fairness.parentAOvernights - fairness.parentBOvernights),
        withinBand: fairness.withinFairnessBand,
        windowWeeks: 8,
      } : null,
      stability: stability ? {
        transitionsThisWeek: stability.transitionsPerWeek,
        maxConsecutiveA: stability.maxConsecutiveA,
        maxConsecutiveB: stability.maxConsecutiveB,
        ageAppropriateMaxConsecutive: familyCtx.maxConsecutive,
        exceedsAgeLimit:
          stability.maxConsecutiveA > familyCtx.maxConsecutive ||
          stability.maxConsecutiveB > familyCtx.maxConsecutive,
      } : null,
      familyContext: {
        youngestBand: familyCtx.youngestBand,
        maxConsecutive: familyCtx.maxConsecutive,
        solverWeightProfile: familyCtx.solverWeightProfile,
      },
      pendingRequests,
    };
  }
  // ─── Audit Log ──────────────────────────────────────────────

  async getAuditLog(familyId: string, limit = 50, offset = 0): Promise<{ entries: AuditLog[]; total: number }> {
    const [entries, total] = await this.auditRepo.findAndCount({
      where: { familyId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { entries, total };
  }

  async getMonthlySummary(familyId: string, month: string) {
    const monthStart = month.length === 7 ? `${month}-01` : month;
    const monthDate = new Date(monthStart);
    const nextMonth = new Date(monthDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const monthEnd = nextMonth.toISOString().split('T')[0];

    const active = await this.schedulesService.getActiveSchedule(familyId);

    let totalOvernights = 0;
    let totalTransitions = 0;
    if (active) {
      const assignments = await this.assignmentRepo.find({
        where: {
          familyId,
          scheduleVersionId: active.id,
          date: Between(monthStart, monthEnd),
        },
        order: { date: 'ASC' },
      });
      totalOvernights = assignments.length;
      let prev: string | null = null;
      for (const a of assignments) {
        if (prev !== null && a.assignedTo !== prev) totalTransitions++;
        prev = a.assignedTo;
      }
    }

    const requests = await this.requestRepo.find({
      where: { familyId },
    });
    const monthRequests = requests.filter((r) => {
      const created = new Date(r.createdAt).toISOString().split('T')[0];
      return created >= monthStart && created < monthEnd;
    });

    const requestsMade = monthRequests.length;
    const requestsAccepted = monthRequests.filter((r) => r.status === RequestStatus.ACCEPTED).length;
    const requestsExpired = monthRequests.filter((r) => r.status === RequestStatus.EXPIRED).length;

    const scheduleVersions = await this.versionRepo.count({
      where: { familyId },
    });

    return {
      month: monthStart.slice(0, 7),
      totalOvernights,
      totalTransitions,
      requestsMade,
      requestsAccepted,
      requestsExpired,
      scheduleVersions,
    };
  }
}

function getISOWeek(d: Date): number {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}
