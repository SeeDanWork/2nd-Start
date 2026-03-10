import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
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
import { TokenStore } from './token-store';

const MAGIC_LINK_TTL_SECONDS = MAGIC_LINK_TTL_MINUTES * 60;
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 3600;
const RATE_LIMIT_WINDOW_SECONDS = 3600;
const RATE_LIMIT_MAX_COUNT = 5;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(FamilyMembership)
    private readonly memberRepo: Repository<FamilyMembership>,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly tokenStore: TokenStore,
  ) {}

  async sendMagicLink(email: string): Promise<{ message: string }> {
    const rateLimitKey = `magic:${email.toLowerCase()}`;
    const { allowed } = await this.tokenStore.checkRateLimit(
      rateLimitKey,
      RATE_LIMIT_MAX_COUNT,
      RATE_LIMIT_WINDOW_SECONDS,
    );
    if (!allowed) {
      throw new BadRequestException('Too many magic link requests. Try again later.');
    }

    const token = randomBytes(32).toString('hex');
    await this.tokenStore.setMagicLink(
      token,
      email.toLowerCase(),
      MAGIC_LINK_TTL_SECONDS,
    );

    await this.emailService.sendEmail(email, 'magic_link', { token });

    return { message: 'Magic link sent. Check your email.' };
  }

  async verifyMagicLink(token: string): Promise<{
    accessToken: string;
    refreshToken: string;
    user: User;
    isNewUser: boolean;
  }> {
    const entry = await this.tokenStore.getMagicLink(token);
    if (!entry) {
      throw new UnauthorizedException('Invalid or expired magic link');
    }
    await this.tokenStore.deleteMagicLink(token);

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
    const entry = await this.tokenStore.getRefreshToken(token);
    if (!entry) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    await this.tokenStore.deleteRefreshToken(token);

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

  async devLogin(email: string): Promise<{
    accessToken: string;
    refreshToken: string;
    user: User;
  }> {
    if (process.env.NODE_ENV !== 'development') {
      throw new ForbiddenException('Dev login is only available in development');
    }

    let user = await this.userRepo.findOne({
      where: { email: email.toLowerCase(), deletedAt: IsNull() },
    });

    if (!user) {
      user = this.userRepo.create({
        email: email.toLowerCase(),
        displayName: email.split('@')[0],
        timezone: 'America/New_York',
      });
      user = await this.userRepo.save(user);
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return { accessToken, refreshToken, user };
  }

  private generateAccessToken(user: User): string {
    return this.jwtService.sign(
      { sub: user.id, email: user.email, type: 'access' },
      { expiresIn: JWT_ACCESS_TOKEN_TTL },
    );
  }

  private generateRefreshToken(user: User): string {
    const token = randomBytes(32).toString('hex');
    // Fire-and-forget: token is stored asynchronously in Redis
    this.tokenStore.setRefreshToken(token, user.id, REFRESH_TOKEN_TTL_SECONDS);
    return token;
  }
}
