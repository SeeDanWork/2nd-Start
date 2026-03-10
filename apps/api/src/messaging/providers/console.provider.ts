import { Logger } from '@nestjs/common';
import { ISmsProvider } from '../sms.provider';

export class ConsoleSmsProvider implements ISmsProvider {
  private readonly logger = new Logger('ConsoleSmsProvider');
  private messageCount = 0;

  async sendSms(to: string, body: string): Promise<{ sid: string; status: string }> {
    this.messageCount++;
    const sid = `CONSOLE_${Date.now()}_${this.messageCount}`;
    this.logger.log(`[SMS → ${to}] ${body}`);
    return { sid, status: 'sent' };
  }

  isValidPhoneNumber(phone: string): boolean {
    // E.164: + followed by 1-15 digits
    return /^\+[1-9]\d{1,14}$/.test(phone);
  }
}
