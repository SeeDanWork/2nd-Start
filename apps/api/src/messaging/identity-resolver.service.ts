import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, FamilyMembership } from '../entities';

export interface SmsIdentity {
  userId: string;
  familyId: string;
  role: string;
  displayName: string;
  timezone: string;
  phoneNumber: string;
}

@Injectable()
export class IdentityResolverService {
  private readonly logger = new Logger(IdentityResolverService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(FamilyMembership)
    private readonly membershipRepo: Repository<FamilyMembership>,
  ) {}

  async resolve(phoneNumber: string): Promise<SmsIdentity | null> {
    const user = await this.userRepo.findOne({
      where: { phoneNumber },
    });

    if (!user) {
      this.logger.debug(`No user found for phone ${phoneNumber}`);
      return null;
    }

    // Find their active family membership
    const membership = await this.membershipRepo.findOne({
      where: { userId: user.id, inviteStatus: 'accepted' },
      order: { createdAt: 'DESC' },
    });

    if (!membership) {
      this.logger.debug(`User ${user.id} has no accepted family membership`);
      return null;
    }

    return {
      userId: user.id,
      familyId: membership.familyId,
      role: membership.role,
      displayName: user.displayName,
      timezone: user.timezone,
      phoneNumber,
    };
  }
}
