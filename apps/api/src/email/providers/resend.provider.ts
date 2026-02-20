import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { EmailProvider, EmailMessage } from '../email.provider';

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  private readonly logger = new Logger('EmailResend');
  private readonly client: Resend;
  private readonly from: string;

  constructor() {
    this.client = new Resend(process.env.RESEND_API_KEY);
    this.from = process.env.EMAIL_FROM || 'ADCP <noreply@adcp.app>';
  }

  async send(message: EmailMessage): Promise<void> {
    const { error } = await this.client.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
    });
    if (error) {
      this.logger.error(`Resend error: ${error.message}`);
      throw error;
    }
  }
}
