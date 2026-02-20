import { Injectable, Logger } from '@nestjs/common';
import { EmailProvider, EmailMessage } from '../email.provider';

@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger('EmailConsole');

  async send(message: EmailMessage): Promise<void> {
    this.logger.log(`To: ${message.to}`);
    this.logger.log(`Subject: ${message.subject}`);
    this.logger.log(`Body:\n${message.html}`);
  }
}
