import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { ViewerTokenService } from './viewer-token.service';

@Controller('s')
export class ShortLinkController {
  constructor(private readonly viewerTokenService: ViewerTokenService) {}

  @Get(':code')
  async redirect(
    @Param('code') code: string,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.viewerTokenService.resolveShortLink(code);
    if (!url) {
      throw new NotFoundException('Link not found or expired');
    }
    res.redirect(302, url);
  }
}
