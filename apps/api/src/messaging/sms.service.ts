import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { SMS_PROVIDER, ISmsProvider } from './sms.provider';

const RATE_LIMIT_MAX = 30; // messages per family per hour
const RATE_LIMIT_WINDOW = 3600; // seconds

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly redis: Redis;

  constructor(
    @Inject(SMS_PROVIDER) private readonly provider: ISmsProvider,
  ) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      lazyConnect: true,
    });
    this.redis.connect().catch((err) => {
      this.logger.warn(`Redis not available for SMS rate limiting: ${err.message}`);
    });
  }

  async send(to: string, body: string, familyId?: string): Promise<void> {
    if (familyId) {
      const allowed = await this.checkRateLimit(familyId);
      if (!allowed) {
        this.logger.warn(`Rate limit exceeded for family ${familyId}`);
        return;
      }
    }

    try {
      await this.provider.sendSms(to, body);
    } catch (err: any) {
      this.logger.error(`Failed to send SMS to ${to}: ${err.message}`);
    }
  }

  async sendMultiSegment(to: string, parts: string[], familyId?: string): Promise<void> {
    for (const part of parts) {
      await this.send(to, part, familyId);
    }
  }

  isValidPhoneNumber(phone: string): boolean {
    return this.provider.isValidPhoneNumber(phone);
  }

  private async checkRateLimit(familyId: string): Promise<boolean> {
    try {
      const key = `sms:rate:${familyId}`;
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, RATE_LIMIT_WINDOW);
      }
      return count <= RATE_LIMIT_MAX;
    } catch {
      // If Redis is down, allow the message
      return true;
    }
  }
}
