import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { google, oauth2_v2 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { GoogleCalendarToken } from '../entities';
import { encrypt, decrypt } from './crypto.util';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

@Injectable()
export class GoogleCalendarAuthService {
  private readonly logger = new Logger(GoogleCalendarAuthService.name);

  constructor(
    @InjectRepository(GoogleCalendarToken)
    private readonly tokenRepo: Repository<GoogleCalendarToken>,
  ) {}

  private createOAuth2Client(): OAuth2Client {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
  }

  getAuthUrl(userId: string): string {
    const client = this.createOAuth2Client();
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
      state: userId,
    });
  }

  async handleCallback(code: string, userId: string): Promise<void> {
    const client = this.createOAuth2Client();
    const { tokens } = await client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Google did not return required tokens');
    }

    // Fetch Google email
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const userInfo = await oauth2.userinfo.get();
    const googleEmail = userInfo.data.email || 'unknown';

    const accessTokenEncrypted = encrypt(tokens.access_token);
    const refreshTokenEncrypted = encrypt(tokens.refresh_token);
    const tokenExpiry = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    // Upsert: one token record per user
    const existing = await this.tokenRepo.findOne({ where: { userId } });
    if (existing) {
      await this.tokenRepo.update(existing.id, {
        accessTokenEncrypted,
        refreshTokenEncrypted,
        tokenExpiry,
        googleEmail,
        syncStatus: 'active',
        lastSyncError: null,
      } as any);
    } else {
      await this.tokenRepo.save(
        this.tokenRepo.create({
          userId,
          accessTokenEncrypted,
          refreshTokenEncrypted,
          tokenExpiry,
          googleEmail,
          syncStatus: 'active',
        }),
      );
    }

    this.logger.log(`Google Calendar connected for user ${userId} (${googleEmail})`);
  }

  async getAuthenticatedClient(userId: string): Promise<OAuth2Client | null> {
    const token = await this.tokenRepo.findOne({ where: { userId } });
    if (!token || token.syncStatus === 'error') return null;

    const client = this.createOAuth2Client();
    client.setCredentials({
      access_token: decrypt(token.accessTokenEncrypted),
      refresh_token: decrypt(token.refreshTokenEncrypted),
      expiry_date: token.tokenExpiry.getTime(),
    });

    // Persist refreshed tokens automatically
    client.on('tokens', async (newTokens) => {
      try {
        const updates: Partial<GoogleCalendarToken> = {};
        if (newTokens.access_token) {
          updates.accessTokenEncrypted = encrypt(newTokens.access_token);
        }
        if (newTokens.refresh_token) {
          updates.refreshTokenEncrypted = encrypt(newTokens.refresh_token);
        }
        if (newTokens.expiry_date) {
          updates.tokenExpiry = new Date(newTokens.expiry_date);
        }
        await this.tokenRepo.update(token.id, updates as any);
        this.logger.debug(`Refreshed tokens persisted for user ${userId}`);
      } catch (err: any) {
        this.logger.warn(`Failed to persist refreshed tokens: ${err.message}`);
      }
    });

    return client;
  }

  async disconnect(userId: string): Promise<void> {
    const token = await this.tokenRepo.findOne({ where: { userId } });
    if (!token) return;

    // Revoke with Google
    try {
      const client = this.createOAuth2Client();
      client.setCredentials({
        access_token: decrypt(token.accessTokenEncrypted),
        refresh_token: decrypt(token.refreshTokenEncrypted),
      });
      await client.revokeCredentials();
    } catch (err: any) {
      this.logger.warn(`Token revocation failed (may already be revoked): ${err.message}`);
    }

    await this.tokenRepo.delete(token.id);
    this.logger.log(`Google Calendar disconnected for user ${userId}`);
  }

  async getConnectionStatus(
    userId: string,
  ): Promise<{ connected: boolean; email?: string; lastSynced?: Date }> {
    const token = await this.tokenRepo.findOne({ where: { userId } });
    if (!token) return { connected: false };
    return {
      connected: true,
      email: token.googleEmail,
      lastSynced: token.lastSyncedAt || undefined,
    };
  }

  async markSyncError(userId: string, error: string): Promise<void> {
    await this.tokenRepo.update(
      { userId },
      { syncStatus: 'error', lastSyncError: error } as any,
    );
  }

  async markSyncSuccess(userId: string): Promise<void> {
    await this.tokenRepo.update(
      { userId },
      {
        syncStatus: 'active',
        lastSyncError: null,
        lastSyncedAt: new Date(),
      } as any,
    );
  }
}
