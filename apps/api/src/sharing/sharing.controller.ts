import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { SharingService } from './sharing.service';

@Controller()
export class SharingController {
  constructor(private readonly sharingService: SharingService) {}

  // ─── Authenticated endpoints ───────────────────────────────

  @Post('families/:familyId/share-links')
  createShareLink(
    @Param('familyId') familyId: string,
    @Body() body: {
      userId: string;
      scope: string;
      label?: string;
      format?: string;
      expiresAt?: string;
    },
  ) {
    return this.sharingService.createShareLink(familyId, body.userId, body);
  }

  @Get('families/:familyId/share-links')
  listShareLinks(@Param('familyId') familyId: string) {
    return this.sharingService.listShareLinks(familyId);
  }

  @Delete('families/:familyId/share-links/:linkId')
  revokeShareLink(
    @Param('familyId') familyId: string,
    @Param('linkId') linkId: string,
  ) {
    return this.sharingService.revokeShareLink(familyId, linkId);
  }

  // ─── Public endpoints (no auth) ───────────────────────────

  @Get('share/:token')
  async viewSharedCalendar(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    const resolved = await this.sharingService.resolveShareLink(token);
    if (!resolved) {
      throw new NotFoundException('Share link not found or expired');
    }

    const html = await this.sharingService.generateHTMLCalendar(resolved.familyId);
    res.type('text/html').send(html);
  }

  @Get('share/:token/feed.ics')
  async getICSFeed(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    const resolved = await this.sharingService.resolveShareLink(token);
    if (!resolved) {
      throw new NotFoundException('Share link not found or expired');
    }

    const ics = await this.sharingService.generateICS(resolved.familyId);
    res.type('text/calendar').set('Content-Disposition', 'attachment; filename="schedule.ics"').send(ics);
  }
}
