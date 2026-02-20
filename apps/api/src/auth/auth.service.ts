import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { randomBytes } from 'crypto';
import { User, Family, FamilyMembership } from '../entities';
import {
  MAGIC_LINK_TTL_MINUTES,
  JWT_ACCESS_TOKEN_TTL,
  InviteStatus,
} from '@adcp/shared';
import { EmailService } from '../email/email.service';

// In-memory token store for dev. Replace with Redis in production.
const magicLinkTokens = new Map<string, { email: string; expiresAt: number }>();
const refreshTokens = new Map<string, { userId: string; expiresAt: number }>();
const rateLimits = new Map<string, { count: number; resetAt: number }>();

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(FamilyMembership)
    private readonly memberRepo: Repository<FamilyMembership>,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  async sendMagicLink(email: string): Promise<{ message: string }> {
    const now = Date.now();
    const key = `magic:${email.toLowerCase()}`;
    const limit = rateLimits.get(key);
    if (limit && limit.resetAt > now && limit.count >= 5) {
      throw new BadRequestException('Too many magic link requests. Try again later.');
    }
    if (!limit || limit.resetAt <= now) {
      rateLimits.set(key, { count: 1, resetAt: now + 3600_000 });
    } else {
      limit.count++;
    }

    const token = randomBytes(32).toString('hex');
    magicLinkTokens.set(token, {
      email: email.toLowerCase(),
      expiresAt: now + MAGIC_LINK_TTL_MINUTES * 60_000,
    });

    await this.emailService.sendEmail(email, 'magic_link', { token });

    return { message: 'Magic link sent. Check your email.' };
  }

  async verifyMagicLink(token: string): Promise<{
    accessToken: string;
    refreshToken: string;
    user: User;
    isNewUser: boolean;
  }> {
    const entry = magicLinkTokens.get(token);
    if (!entry) {
      throw new UnauthorizedException('Invalid or expired magic link');
    }
    if (entry.expiresAt < Date.now()) {
      magicLinkTokens.delete(token);
      throw new UnauthorizedException('Magic link has expired');
    }
    magicLinkTokens.delete(token);

    let user = await this.userRepo.findOne({
      where: { email: entry.email, deletedAt: IsNull() },
    });
    let isNewUser = false;

    if (!user) {
      user = this.userRepo.create({
        email: entry.email,
        displayName: entry.email.split('@')[0],
        timezone: 'America/New_York',
      });
      user = await this.userRepo.save(user);
      isNewUser = true;
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return { accessToken, refreshToken, user, isNewUser };
  }

  async refreshAccessToken(token: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const entry = refreshTokens.get(token);
    if (!entry || entry.expiresAt < Date.now()) {
      refreshTokens.delete(token);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    refreshTokens.delete(token);

    const user = await this.userRepo.findOne({
      where: { id: entry.userId, deletedAt: IsNull() },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      accessToken: this.generateAccessToken(user),
      refreshToken: this.generateRefreshToken(user),
    };
  }

  async getProfile(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id: userId, deletedAt: IsNull() },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  async updateProfile(
    userId: string,
    data: Partial<Pick<User, 'displayName' | 'timezone' | 'notificationPreferences'>>,
  ): Promise<User> {
    await this.userRepo.update(userId, data as any);
    return this.getProfile(userId);
  }

  async getUserFamily(
    userId: string,
  ): Promise<{ family: Family; membership: FamilyMembership } | null> {
    const membership = await this.memberRepo.findOne({
      where: { userId, inviteStatus: InviteStatus.ACCEPTED },
      relations: ['family'],
    });
    if (!membership) return null;
    return { family: membership.family, membership };
  }

  async deleteAccount(userId: string): Promise<{ message: string }> {
    await this.userRepo.update(userId, { deletedAt: new Date() });
    return { message: 'Account scheduled for deletion in 30 days.' };
  }

  private generateAccessToken(user: User): string {
    return this.jwtService.sign(
      { sub: user.id, email: user.email, type: 'access' },
      { expiresIn: JWT_ACCESS_TOKEN_TTL },
    );
  }

  private generateRefreshToken(user: User): string {
    const token = randomBytes(32).toString('hex');
    refreshTokens.set(token, {
      userId: user.id,
      expiresAt: Date.now() + 30 * 24 * 3600_000,
    });
    return token;
  }
}
