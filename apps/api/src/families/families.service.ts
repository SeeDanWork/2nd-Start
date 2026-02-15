import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Family, FamilyMembership, User, ConstraintSet } from '../entities';
import { MemberRole, InviteStatus, FamilyStatus } from '@adcp/shared';
import { INVITE_TOKEN_TTL_DAYS } from '@adcp/shared';

// In-memory invite tokens for dev. Replace with Redis in production.
const inviteTokens = new Map<
  string,
  { familyId: string; email: string; role: string; label: string; expiresAt: number }
>();

@Injectable()
export class FamiliesService {
  constructor(
    @InjectRepository(Family)
    private readonly familyRepo: Repository<Family>,
    @InjectRepository(FamilyMembership)
    private readonly memberRepo: Repository<FamilyMembership>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ConstraintSet)
    private readonly constraintSetRepo: Repository<ConstraintSet>,
  ) {}

  async create(
    userId: string,
    data: { name?: string; timezone: string },
  ): Promise<Family & { membership: FamilyMembership }> {
    const family = this.familyRepo.create({
      name: data.name || null,
      timezone: data.timezone,
      status: FamilyStatus.ONBOARDING,
    });
    const saved = await this.familyRepo.save(family);

    const membership = this.memberRepo.create({
      familyId: saved.id,
      userId,
      role: MemberRole.PARENT_A,
      label: 'Parent A',
      inviteStatus: InviteStatus.ACCEPTED,
      acceptedAt: new Date(),
    });
    const savedMembership = await this.memberRepo.save(membership);

    // Create initial constraint set
    await this.constraintSetRepo.save(
      this.constraintSetRepo.create({
        familyId: saved.id,
        version: 1,
        isActive: true,
        createdBy: userId,
      }),
    );

    return { ...saved, membership: savedMembership };
  }

  async getFamily(familyId: string): Promise<Family> {
    const family = await this.familyRepo.findOne({
      where: { id: familyId },
      relations: ['memberships', 'children'],
    });
    if (!family) throw new NotFoundException('Family not found');
    return family;
  }

  async updateSettings(
    familyId: string,
    data: Partial<Pick<Family, 'name' | 'timezone' | 'weekendDefinition' | 'fairnessBand' | 'changeBudget'>>,
  ): Promise<Family> {
    await this.familyRepo.update(familyId, data as any);
    return this.getFamily(familyId);
  }

  async invite(
    familyId: string,
    invitedByUserId: string,
    data: { email: string; role: string; label: string },
  ): Promise<{ inviteToken: string; message: string }> {
    // Check family exists
    const family = await this.getFamily(familyId);

    // Check no duplicate active membership for this email
    const existing = await this.memberRepo.findOne({
      where: { familyId, inviteEmail: data.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('This email has already been invited');
    }

    // Check max 2 parents
    if (data.role === MemberRole.PARENT_B) {
      const parentCount = await this.memberRepo.count({
        where: [
          { familyId, role: MemberRole.PARENT_A },
          { familyId, role: MemberRole.PARENT_B },
        ],
      });
      if (parentCount >= 2) {
        throw new BadRequestException('Family already has two parents');
      }
    }

    const token = randomBytes(32).toString('hex');
    inviteTokens.set(token, {
      familyId,
      email: data.email.toLowerCase(),
      role: data.role,
      label: data.label,
      expiresAt: Date.now() + INVITE_TOKEN_TTL_DAYS * 24 * 3600_000,
    });

    // Create pending membership
    await this.memberRepo.save(
      this.memberRepo.create({
        familyId,
        userId: null,
        role: data.role,
        label: data.label,
        inviteStatus: InviteStatus.PENDING,
        inviteEmail: data.email.toLowerCase(),
        invitedAt: new Date(),
      }),
    );

    // TODO: Send invite email
    console.log(`[Invite] Family: ${family.name || familyId}, Email: ${data.email}, Token: ${token}`);

    return { inviteToken: token, message: 'Invitation sent.' };
  }

  async acceptInvite(
    token: string,
    userId: string,
  ): Promise<{ family: Family; membership: FamilyMembership }> {
    const entry = inviteTokens.get(token);
    if (!entry || entry.expiresAt < Date.now()) {
      inviteTokens.delete(token);
      throw new BadRequestException('Invalid or expired invitation');
    }
    inviteTokens.delete(token);

    // Find the user
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Verify email matches
    if (user.email.toLowerCase() !== entry.email) {
      throw new ForbiddenException('This invitation was sent to a different email address');
    }

    // Find pending membership
    const membership = await this.memberRepo.findOne({
      where: {
        familyId: entry.familyId,
        inviteEmail: entry.email,
        inviteStatus: InviteStatus.PENDING,
      },
    });
    if (!membership) {
      throw new NotFoundException('Pending invitation not found');
    }

    membership.userId = userId;
    membership.inviteStatus = InviteStatus.ACCEPTED;
    membership.acceptedAt = new Date();
    await this.memberRepo.save(membership);

    // Activate family if both parents joined
    const family = await this.getFamily(entry.familyId);
    const acceptedParents = family.memberships.filter(
      (m) =>
        (m.role === MemberRole.PARENT_A || m.role === MemberRole.PARENT_B) &&
        m.inviteStatus === InviteStatus.ACCEPTED,
    );
    if (acceptedParents.length === 2 && family.status === FamilyStatus.ONBOARDING) {
      await this.familyRepo.update(family.id, { status: FamilyStatus.ACTIVE });
      family.status = FamilyStatus.ACTIVE;
    }

    return { family, membership };
  }

  async getMembers(familyId: string): Promise<FamilyMembership[]> {
    return this.memberRepo.find({
      where: { familyId },
      relations: ['user'],
    });
  }

  async verifyMembership(familyId: string, userId: string): Promise<FamilyMembership> {
    const membership = await this.memberRepo.findOne({
      where: { familyId, userId, inviteStatus: InviteStatus.ACCEPTED },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this family');
    }
    return membership;
  }
}
