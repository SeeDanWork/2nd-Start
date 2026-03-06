import { Controller, Post, Get, Body, Header, Param, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { MessagingService } from './messaging.service';
import { ScheduleImageService } from './schedule-image.service';

@Controller('messaging')
export class MessagingController {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly scheduleImageService: ScheduleImageService,
  ) {}

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

  @Get('media/:filename')
  async serveMedia(
    @Param('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    // Sanitize filename
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const filepath = this.scheduleImageService.getMediaPath(safe);

    try {
      const fs = await import('fs');
      if (!fs.existsSync(filepath)) {
        throw new NotFoundException('Media not found');
      }
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      fs.createReadStream(filepath).pipe(res);
    } catch {
      throw new NotFoundException('Media not found');
    }
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
