import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, FamilyMembership, SmsConversation } from '../entities';

/**
 * SMS Onboarding — register a phone number to an existing user account.
 *
 * Flow:
 * 1. Unknown number texts in → gets registration prompt
 * 2. User replies with their registration code (from web/email)
 * 3. System links phone number to user + family
 * 4. User can now use full SMS interface
 *
 * For pilot: operator can also manually link phone numbers.
 */
@Injectable()
export class SmsOnboardingService {
  private readonly logger = new Logger(SmsOnboardingService.name);

  // Pending registrations: code → { userId, familyId, expiresAt }
  private pendingRegistrations = new Map<string, {
    userId: string;
    familyId: string;
    expiresAt: Date;
  }>();

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(FamilyMembership)
    private readonly membershipRepo: Repository<FamilyMembership>,
    @InjectRepository(SmsConversation)
    private readonly conversationRepo: Repository<SmsConversation>,
  ) {}

  /**
   * Generate a 6-digit registration code for a user.
   * Called from operator tooling or web interface.
   */
  generateRegistrationCode(userId: string, familyId: string): string {
    // Clean expired codes
    this.cleanExpired();

    const code = String(Math.floor(100000 + Math.random() * 900000));
    this.pendingRegistrations.set(code, {
      userId,
      familyId,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    });

    this.logger.log(`Registration code generated for user ${userId}: ${code}`);
    return code;
  }

  /**
   * Attempt to register a phone number using a code.
   * Returns the linked identity or null if code is invalid.
   */
  async registerWithCode(
    phoneNumber: string,
    code: string,
  ): Promise<{ userId: string; familyId: string } | null> {
    this.cleanExpired();

    const registration = this.pendingRegistrations.get(code);
    if (!registration) return null;

    // Link the phone number
    const user = await this.userRepo.findOne({ where: { id: registration.userId } });
    if (!user) return null;

    // Store phone on user (update phone field if exists)
    await this.userRepo.update(user.id, { phone: phoneNumber } as any);

    // Create or update conversation record
    let conversation = await this.conversationRepo.findOne({ where: { phoneNumber } });
    if (conversation) {
      await this.conversationRepo.update(conversation.id, {
        userId: registration.userId,
        familyId: registration.familyId,
        state: 'IDLE',
      } as any);
    } else {
      await this.conversationRepo.save(
        this.conversationRepo.create({
          phoneNumber,
          userId: registration.userId,
          familyId: registration.familyId,
          state: 'IDLE',
          lastMessageAt: new Date(),
        }),
      );
    }

    // Remove used code
    this.pendingRegistrations.delete(code);

    this.logger.log(`Phone ${phoneNumber} registered to user ${registration.userId}`);
    return { userId: registration.userId, familyId: registration.familyId };
  }

  /**
   * Operator manual link — bypass code flow for pilot.
   */
  async manualLink(
    phoneNumber: string,
    userId: string,
    familyId: string,
  ): Promise<void> {
    await this.userRepo.update(userId, { phone: phoneNumber } as any);

    let conversation = await this.conversationRepo.findOne({ where: { phoneNumber } });
    if (conversation) {
      await this.conversationRepo.update(conversation.id, {
        userId,
        familyId,
        state: 'IDLE',
      } as any);
    } else {
      await this.conversationRepo.save(
        this.conversationRepo.create({
          phoneNumber,
          userId,
          familyId,
          state: 'IDLE',
          lastMessageAt: new Date(),
        }),
      );
    }

    this.logger.log(`Phone ${phoneNumber} manually linked to user ${userId}`);
  }

  /**
   * List pending registration codes (for operator inspection).
   */
  listPendingRegistrations() {
    this.cleanExpired();
    const entries: Array<{ code: string; userId: string; familyId: string; expiresAt: string }> = [];
    for (const [code, reg] of this.pendingRegistrations) {
      entries.push({
        code,
        userId: reg.userId,
        familyId: reg.familyId,
        expiresAt: reg.expiresAt.toISOString(),
      });
    }
    return entries;
  }

  private cleanExpired() {
    const now = Date.now();
    for (const [code, reg] of this.pendingRegistrations) {
      if (reg.expiresAt.getTime() < now) {
        this.pendingRegistrations.delete(code);
      }
    }
  }
}
