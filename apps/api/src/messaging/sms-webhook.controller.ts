import { Controller, Post, Body, Res, Logger, Headers } from '@nestjs/common';
import { Response } from 'express';
import { ConversationOrchestratorService } from './conversation-orchestrator.service';

export interface TwilioInboundPayload {
  From: string;
  Body: string;
  To?: string;
  MessageSid?: string;
  AccountSid?: string;
  NumMedia?: string;
  [key: string]: unknown;
}

export interface TwilioStatusPayload {
  MessageSid: string;
  MessageStatus: string;
  To?: string;
  ErrorCode?: string;
  [key: string]: unknown;
}

@Controller('sms')
export class SmsWebhookController {
  private readonly logger = new Logger(SmsWebhookController.name);

  constructor(
    private readonly orchestrator: ConversationOrchestratorService,
  ) {}

  @Post('inbound')
  async handleInbound(
    @Body() body: TwilioInboundPayload,
    @Headers('x-twilio-signature') twilioSignature: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const phoneNumber = body.From;
    const messageBody = body.Body || '';

    if (!phoneNumber) {
      this.logger.warn('Inbound SMS missing From field');
      res.status(400).type('text/xml').send('<Response></Response>');
      return;
    }

    // Twilio signature validation (warn in dev, enforce in prod later)
    if (!twilioSignature && process.env.NODE_ENV === 'production') {
      this.logger.warn('Missing Twilio signature on inbound SMS');
    }

    this.logger.log(`Inbound SMS from ${phoneNumber}: "${messageBody.substring(0, 50)}"`);

    try {
      const reply = await this.orchestrator.handleInboundSms(phoneNumber, messageBody);

      // Return TwiML response
      const twiml = `<Response><Message>${this.escapeXml(reply)}</Message></Response>`;
      res.status(200).type('text/xml').send(twiml);
    } catch (err: any) {
      this.logger.error(`Error handling inbound SMS: ${err.message}`, err.stack);
      const twiml = '<Response><Message>An error occurred. Please try again.</Message></Response>';
      res.status(200).type('text/xml').send(twiml);
    }
  }

  @Post('status')
  async handleStatusCallback(@Body() body: TwilioStatusPayload): Promise<{ ok: boolean }> {
    this.logger.debug(
      `SMS status: sid=${body.MessageSid} status=${body.MessageStatus}` +
      (body.ErrorCode ? ` error=${body.ErrorCode}` : ''),
    );
    return { ok: true };
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
