import {
  Controller,
  Get,
  Delete,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { GoogleCalendarAuthService } from './google-calendar-auth.service';
import { GoogleCalendarSyncService } from './google-calendar-sync.service';

@Controller('auth/google/calendar')
export class GoogleCalendarController {
  constructor(
    private readonly authService: GoogleCalendarAuthService,
    private readonly syncService: GoogleCalendarSyncService,
  ) {}

  @Get('connect')
  @UseGuards(AuthGuard('jwt'))
  connect(@Req() req: Request) {
    const userId = (req.user as any).id;
    const url = this.authService.getAuthUrl(userId);
    return { url };
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') userId: string,
    @Res() res: Response,
  ) {
    try {
      await this.authService.handleCallback(code, userId);
      // Redirect to frontend settings page on success
      const frontendUrl = process.env.APP_URL || 'http://localhost:8081';
      res.redirect(`${frontendUrl}/settings?google_calendar=connected`);
    } catch (err: any) {
      const frontendUrl = process.env.APP_URL || 'http://localhost:8081';
      res.redirect(`${frontendUrl}/settings?google_calendar=error&message=${encodeURIComponent(err.message)}`);
    }
  }

  @Get('status')
  @UseGuards(AuthGuard('jwt'))
  async status(@Req() req: Request) {
    const userId = (req.user as any).id;
    return this.authService.getConnectionStatus(userId);
  }

  @Delete('disconnect')
  @UseGuards(AuthGuard('jwt'))
  async disconnect(@Req() req: Request) {
    const userId = (req.user as any).id;
    await this.syncService.clearCalendar(userId);
    await this.authService.disconnect(userId);
    return { disconnected: true };
  }

  @Post('sync')
  @UseGuards(AuthGuard('jwt'))
  async sync(@Req() req: Request) {
    const userId = (req.user as any).id;
    // Find user's family memberships and sync each
    // For manual sync, we sync just this user across all their families
    // This is a simplified approach — in practice there's one family per user
    await this.syncService.syncForUser(userId, (req.query as any).familyId);
    return { synced: true };
  }
}
