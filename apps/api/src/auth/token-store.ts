import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class TokenStore implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly logger = new Logger(TokenStore.name);

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      lazyConnect: true,
    });

    this.redis.connect().catch((err) => {
      this.logger.error('Failed to connect to Redis', err);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  // ─── Magic Links ────────────────────────────────────────────

  async setMagicLink(
    token: string,
    email: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.redis.set(
      `magic:${token}`,
      JSON.stringify({ email }),
      'EX',
      ttlSeconds,
    );
  }

  async getMagicLink(token: string): Promise<{ email: string } | null> {
    const raw = await this.redis.get(`magic:${token}`);
    if (!raw) return null;
    return JSON.parse(raw);
  }

  async deleteMagicLink(token: string): Promise<void> {
    await this.redis.del(`magic:${token}`);
  }

  // ─── Refresh Tokens ─────────────────────────────────────────

  async setRefreshToken(
    token: string,
    userId: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.redis.set(
      `refresh:${token}`,
      JSON.stringify({ userId }),
      'EX',
      ttlSeconds,
    );
  }

  async getRefreshToken(token: string): Promise<{ userId: string } | null> {
    const raw = await this.redis.get(`refresh:${token}`);
    if (!raw) return null;
    return JSON.parse(raw);
  }

  async deleteRefreshToken(token: string): Promise<void> {
    await this.redis.del(`refresh:${token}`);
  }

  // ─── Rate Limiting ──────────────────────────────────────────

  async checkRateLimit(
    key: string,
    maxCount: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; count: number }> {
    const redisKey = `ratelimit:${key}`;
    const count = await this.redis.incr(redisKey);

    if (count === 1) {
      await this.redis.expire(redisKey, windowSeconds);
    }

    return { allowed: count <= maxCount, count };
  }
}
