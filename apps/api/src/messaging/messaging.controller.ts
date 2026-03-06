import { Controller, Post, Body, Header } from '@nestjs/common';
import { MessagingService } from './messaging.service';

@Controller('messaging')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post('webhook')
  @Header('Content-Type', 'text/xml')
  async handleInbound(
    @Body() body: { From: string; Body: string; To?: string; MessageSid?: string },
  ): Promise<string> {
    const reply = await this.messagingService.handleInbound(
      body.From,
      body.Body,
      'sms',
      body.MessageSid,
    );
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${reply}</Message></Response>`;
  }

  @Post('connect')
  async handleConnect(
    @Body() body: { phone: string },
  ): Promise<{ message: string }> {
    const greeting = await this.messagingService.initiateConversation(
      body.phone,
      'sms',
    );
    return { message: greeting };
  }

  @Post('status')
  async handleStatus(
    @Body() body: { MessageSid: string; MessageStatus: string },
  ): Promise<{ received: boolean }> {
    await this.messagingService.updateDeliveryStatus(
      body.MessageSid,
      body.MessageStatus,
    );
    return { received: true };
  }
}
