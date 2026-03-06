import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Not } from 'typeorm';
import { ConversationSession } from '../entities';

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(ConversationSession)
    private readonly sessionRepo: Repository<ConversationSession>,
  ) {}

  async getOrCreateSession(
    userId: string,
    familyId: string | null,
    phoneNumber: string,
    channel: string,
  ): Promise<ConversationSession> {
    // Find existing non-expired session for this user
    const now = new Date();
    const existing = await this.sessionRepo.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    if (existing && existing.expiresAt && existing.expiresAt > now) {
      // Update lastMessageAt and extend expiry
      existing.lastMessageAt = now;
      existing.expiresAt = new Date(now.getTime() + 30 * 60 * 1000);
      return this.sessionRepo.save(existing);
    }

    // Create new session
    const session = this.sessionRepo.create({
      userId,
      familyId,
      state: 'idle',
      context: {},
      channel,
      phoneNumber,
      lastMessageAt: now,
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
    });

    return this.sessionRepo.save(session);
  }

  async updateState(
    sessionId: string,
    newState: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const update: Record<string, unknown> = { state: newState };

    if (context) {
      const session = await this.sessionRepo.findOne({
        where: { id: sessionId },
      });
      if (session) {
        update.context = { ...session.context, ...context };
      }
    }

    await this.sessionRepo.update(sessionId, update as any);
  }

  async setPendingAction(
    sessionId: string,
    action: { type: string; requestId?: string; data?: Record<string, any> },
  ): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });
    if (!session) return;

    const context = { ...session.context, pendingAction: action };
    await this.sessionRepo.update(sessionId, { context } as any);
  }

  async getPendingAction(
    sessionId: string,
  ): Promise<{ type: string; requestId?: string; data?: any } | null> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });
    if (!session || !session.context) return null;

    const pending = (session.context as any).pendingAction;
    return pending || null;
  }

  async clearPendingAction(sessionId: string): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });
    if (!session) return;

    const { pendingAction, ...rest } = session.context as any;
    await this.sessionRepo.update(sessionId, { context: rest } as any);
  }

  async expireStale(): Promise<number> {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000);

    const stale = await this.sessionRepo.find({
      where: {
        lastMessageAt: LessThan(cutoff),
        state: Not('idle'),
      },
    });

    if (stale.length === 0) return 0;

    await this.sessionRepo.update(
      stale.map((s) => s.id),
      { state: 'idle' } as any,
    );

    return stale.length;
  }
}
