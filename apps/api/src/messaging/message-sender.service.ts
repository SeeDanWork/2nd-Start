import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MessageSenderService {
  private readonly logger = new Logger(MessageSenderService.name);

  async sendMessage(to: string, body: string): Promise<string | null> {
    if (process.env.TWILIO_ACCOUNT_SID) {
      this.logger.warn(
        'Twilio SDK not installed. Install twilio package to send real SMS.',
      );
      return null;
    }

    // Console mode — log to stdout
    this.logger.log(`[SMS] To: ${to} | Body: ${body}`);
    return `console-${Date.now()}`;
  }
}
