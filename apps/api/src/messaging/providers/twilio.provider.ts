import { Logger } from '@nestjs/common';
import { ISmsProvider } from '../sms.provider';
import Twilio from 'twilio';

export class TwilioSmsProvider implements ISmsProvider {
  private readonly logger = new Logger('TwilioSmsProvider');
  private readonly client: ReturnType<typeof Twilio>;
  private readonly fromNumber: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '';

    if (!accountSid || !authToken || !this.fromNumber) {
      this.logger.error(
        'Missing Twilio config: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER',
      );
    }

    this.client = Twilio(accountSid, authToken);
  }

  async sendSms(to: string, body: string): Promise<{ sid: string; status: string }> {
    const message = await this.client.messages.create({
      to,
      from: this.fromNumber,
      body,
    });

    this.logger.debug(`SMS sent to ${to}: sid=${message.sid} status=${message.status}`);
    return { sid: message.sid, status: message.status };
  }

  isValidPhoneNumber(phone: string): boolean {
    return /^\+[1-9]\d{1,14}$/.test(phone);
  }
}
