import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationRecord, User } from '../entities';
import { NotificationChannel, NotificationType } from '@adcp/shared';
import { EmailService } from '../email/email.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(NotificationRecord)
    private readonly recordRepo: Repository<NotificationRecord>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly emailService: EmailService,
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

    // Email dispatch — check user preferences
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (user) {
      const prefs = user.notificationPreferences as any;
      if (!prefs || prefs.email !== false) {
        await this.emailService.sendEmail(
          user.email,
          type as NotificationType,
          data,
        );
      }
    }

    // Push notification stub
    this.sendPush(userId, type, data);

    return record;
  }

  private sendPush(userId: string, type: string, data: Record<string, unknown>) {
    this.logger.log(`[PUSH] To: ${userId} | Type: ${type} | Data: ${JSON.stringify(data)}`);
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
