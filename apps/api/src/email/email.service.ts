import { Inject, Injectable, Logger } from '@nestjs/common';
import { EMAIL_PROVIDER, EmailProvider } from './email.provider';
import { EmailType, templateRegistry } from './templates';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @Inject(EMAIL_PROVIDER)
    private readonly provider: EmailProvider,
  ) {}

  async sendEmail(
    to: string,
    type: EmailType,
    data: Record<string, unknown>,
  ): Promise<void> {
    const render = templateRegistry[type];
    if (!render) {
      this.logger.warn(`No template for email type: ${type}`);
      return;
    }

    const { subject, html } = render(data);

    try {
      await this.provider.send({ to, subject, html });
    } catch (err) {
      this.logger.error(`Failed to send ${type} email to ${to}: ${(err as Error).message}`);
    }
  }
}
