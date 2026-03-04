import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import {
  ShareLink,
  AuditLog,
  OvernightAssignment,
  HandoffEvent,
} from '../entities';
import {
  AuditAction,
  AuditEntityType,
  SHARE_LINK_TOKEN_BYTES,
  generateIcsString,
} from '@adcp/shared';
import { SchedulesService } from '../schedules/schedules.service';

@Injectable()
export class SharingService {
  private readonly logger = new Logger(SharingService.name);

  constructor(
    @InjectRepository(ShareLink)
    private readonly linkRepo: Repository<ShareLink>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(OvernightAssignment)
    private readonly assignmentRepo: Repository<OvernightAssignment>,
    @InjectRepository(HandoffEvent)
    private readonly handoffRepo: Repository<HandoffEvent>,
    private readonly schedulesService: SchedulesService,
  ) {}

  async createShareLink(
    familyId: string,
    userId: string,
    dto: {
      scope: string;
      label?: string;
      format?: string;
      expiresAt?: string;
    },
  ): Promise<ShareLink> {
    const token = crypto.randomBytes(SHARE_LINK_TOKEN_BYTES).toString('hex');

    const link = await this.linkRepo.save(
      this.linkRepo.create({
        familyId,
        createdBy: userId,
        token,
        scope: dto.scope,
        label: dto.label || null,
        format: dto.format || 'web',
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      }),
    );

    await this.auditRepo.save(
      this.auditRepo.create({
        familyId,
        actorId: userId,
        action: AuditAction.SHARE_LINK_CREATED,
        entityType: AuditEntityType.SHARE_LINK,
        entityId: link.id,
        metadata: { scope: dto.scope, format: dto.format },
      }),
    );

    return link;
  }

  async listShareLinks(familyId: string): Promise<ShareLink[]> {
    return this.linkRepo.find({
      where: { familyId },
      order: { createdAt: 'DESC' },
    });
  }

  async revokeShareLink(familyId: string, linkId: string): Promise<void> {
    const link = await this.linkRepo.findOne({
      where: { id: linkId, familyId },
    });
    if (!link) throw new NotFoundException('Share link not found');

    link.revokedAt = new Date();
    await this.linkRepo.save(link);
  }

  async resolveShareLink(token: string): Promise<{ link: ShareLink; familyId: string } | null> {
    const link = await this.linkRepo.findOne({ where: { token } });
    if (!link) return null;
    if (link.revokedAt) return null;
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) return null;
    return { link, familyId: link.familyId };
  }

  async generateICS(familyId: string): Promise<string> {
    const active = await this.schedulesService.getActiveSchedule(familyId);
    if (!active) return generateIcsString([]);

    const assignments = await this.assignmentRepo.find({
      where: { familyId, scheduleVersionId: active.id },
      order: { date: 'ASC' },
    });

    const days = assignments.map((a) => ({
      date: a.date,
      assignedTo: a.assignedTo as 'parent_a' | 'parent_b',
    }));

    return generateIcsString(days, {
      uidPrefix: `${familyId}-v${active.version}`,
    });
  }

  async generateHTMLCalendar(familyId: string): Promise<string> {
    const active = await this.schedulesService.getActiveSchedule(familyId);
    if (!active) return '<html><body><h1>No active schedule</h1></body></html>';

    const assignments = await this.assignmentRepo.find({
      where: { familyId, scheduleVersionId: active.id },
      order: { date: 'ASC' },
    });

    const rows = assignments.map((a) => {
      const color = a.assignedTo === 'parent_a' ? '#4A90D9' : '#7B61C1';
      const label = a.assignedTo === 'parent_a' ? 'Parent A' : 'Parent B';
      return `<tr><td>${a.date}</td><td style="color:${color};font-weight:bold">${label}</td></tr>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Shared Calendar</title>
<style>body{font-family:sans-serif;max-width:600px;margin:40px auto;padding:0 20px}
table{width:100%;border-collapse:collapse}td{padding:8px;border-bottom:1px solid #eee}</style>
</head><body><h1>Shared Calendar</h1><table>${rows}</table></body></html>`;
  }

}
