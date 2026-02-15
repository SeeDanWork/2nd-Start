import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationRecord } from '../entities';
import { NotificationChannel, NotificationType } from '@adcp/shared';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(NotificationRecord)
    private readonly recordRepo: Repository<NotificationRecord>,
  ) {}

  async send(
    familyId: string,
    userId: string,
    type: NotificationType | string,
    data: Record<string, unknown>,
  ): Promise<NotificationRecord> {
    // Store notification record
    const record = await this.recordRepo.save(
      this.recordRepo.create({
        familyId,
        userId,
        channel: NotificationChannel.EMAIL,
        type,
        referenceId: (data.referenceId as string) || null,
        sentAt: new Date(),
      }),
    );

    // Email dispatch (console transport for dev)
    this.sendEmail(userId, type, data);

    // Push notification stub
    this.sendPush(userId, type, data);

    return record;
  }

  private sendEmail(userId: string, type: string, data: Record<string, unknown>) {
    const subject = this.getEmailSubject(type);
    const body = this.getEmailBody(type, data);
    this.logger.log(`[EMAIL] To: ${userId} | Subject: ${subject}`);
    this.logger.log(`[EMAIL] Body: ${body}`);
  }

  private sendPush(userId: string, type: string, data: Record<string, unknown>) {
    this.logger.log(`[PUSH] To: ${userId} | Type: ${type} | Data: ${JSON.stringify(data)}`);
  }

  private getEmailSubject(type: string): string {
    const subjects: Record<string, string> = {
      [NotificationType.PROPOSAL_RECEIVED]: 'New schedule proposal received',
      [NotificationType.PROPOSAL_ACCEPTED]: 'Schedule proposal accepted',
      [NotificationType.PROPOSAL_EXPIRING]: 'Proposal expiring soon',
      [NotificationType.PROPOSAL_EXPIRED]: 'Proposal has expired',
      [NotificationType.EMERGENCY_ACTIVATED]: 'Emergency mode activated',
      [NotificationType.HANDOFF_REMINDER]: 'Upcoming handoff reminder',
      [NotificationType.BUDGET_LOW]: 'Change budget running low',
      [NotificationType.FAIRNESS_DRIFT]: 'Fairness check notification',
    };
    return subjects[type] || 'Co-parenting schedule update';
  }

  private getEmailBody(type: string, data: Record<string, unknown>): string {
    switch (type) {
      case NotificationType.PROPOSAL_RECEIVED:
        return `A new schedule change proposal has been created. Please review the options in the app.`;
      case NotificationType.PROPOSAL_ACCEPTED:
        return `A schedule proposal has been accepted. Your calendar has been updated.`;
      case NotificationType.PROPOSAL_EXPIRING:
        return `A proposal is expiring in a few hours. Please review it before it expires.`;
      case NotificationType.PROPOSAL_EXPIRED:
        return `A schedule proposal has expired without a decision. No changes were made.`;
      case NotificationType.EMERGENCY_ACTIVATED:
        return `Emergency mode has been activated. Some scheduling constraints have been temporarily relaxed.`;
      case NotificationType.HANDOFF_REMINDER:
        return `Reminder: There is a handoff scheduled for ${data.date || 'soon'}.`;
      case NotificationType.BUDGET_LOW:
        return `Your monthly change budget is running low. You have ${data.remaining || 0} requests remaining.`;
      default:
        return `You have a new notification in the co-parenting app.`;
    }
  }

  async getNotifications(userId: string, limit = 50) {
    return this.recordRepo.find({
      where: { userId },
      order: { sentAt: 'DESC' },
      take: limit,
    });
  }

  async markRead(notificationId: string) {
    await this.recordRepo.update(notificationId, {
      deliveredAt: new Date(),
    } as any);
  }
}
