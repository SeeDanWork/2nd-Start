import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShareLink } from '../entities';
import { randomBytes } from 'crypto';

@Injectable()
export class ViewerTokenService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(ShareLink)
    private readonly shareLinkRepo: Repository<ShareLink>,
  ) {}

  generateViewerToken(
    familyId: string,
    userId: string,
  ): { token: string; url: string } {
    const token = this.jwtService.sign(
      { sub: userId, familyId, scope: 'viewer', type: 'viewer' },
      { expiresIn: '7d' },
    );

    const baseUrl =
      process.env.VIEWER_BASE_URL || 'http://localhost:5173';
    const url = `${baseUrl}/view/${familyId}/${token}`;

    return { token, url };
  }

  /** Generate a short shareable link stored in DB, returns a short URL */
  async generateShortLink(
    familyId: string,
    userId: string,
  ): Promise<{ code: string; url: string; fullUrl: string }> {
    // Generate short code: 8 chars, URL-safe
    const code = randomBytes(6).toString('base64url').slice(0, 8);

    // Also generate the full JWT for the redirect target
    const { token, url: fullUrl } = this.generateViewerToken(familyId, userId);

    // Store in share_links
    await this.shareLinkRepo.save(
      this.shareLinkRepo.create({
        familyId,
        createdBy: userId,
        token: code,
        scope: 'viewer',
        label: 'onboarding',
        format: 'web',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }),
    );

    const apiBase = process.env.APP_URL || `http://localhost:${process.env.APP_PORT || 3000}`;
    const shortUrl = `${apiBase}/s/${code}`;

    return { code, url: shortUrl, fullUrl };
  }

  /** Look up a short code and return the redirect URL */
  async resolveShortLink(code: string): Promise<string | null> {
    const link = await this.shareLinkRepo.findOne({
      where: { token: code, scope: 'viewer' },
    });

    if (!link) return null;
    if (link.revokedAt) return null;
    if (link.expiresAt && link.expiresAt < new Date()) return null;

    // Generate a fresh JWT for this viewer
    const jwt = this.jwtService.sign(
      { sub: link.createdBy, familyId: link.familyId, scope: 'viewer', type: 'viewer' },
      { expiresIn: '7d' },
    );

    const baseUrl = process.env.VIEWER_BASE_URL || 'http://localhost:5173';
    return `${baseUrl}/view/${link.familyId}/${jwt}`;
  }
}
