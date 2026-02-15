import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../entities';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('magic-link')
  sendMagicLink(@Body() body: { email: string }) {
    return this.authService.sendMagicLink(body.email);
  }

  @Post('verify')
  verify(@Body() body: { token: string }) {
    return this.authService.verifyMagicLink(body.token);
  }

  @Post('refresh')
  refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshAccessToken(body.refreshToken);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  getProfile(@CurrentUser() user: User) {
    return this.authService.getProfile(user.id);
  }

  @Patch('me')
  @UseGuards(AuthGuard('jwt'))
  updateProfile(
    @CurrentUser() user: User,
    @Body() body: { displayName?: string; timezone?: string; notificationPreferences?: Record<string, unknown> },
  ) {
    return this.authService.updateProfile(user.id, body);
  }

  @Delete('me')
  @UseGuards(AuthGuard('jwt'))
  deleteAccount(@CurrentUser() user: User) {
    return this.authService.deleteAccount(user.id);
  }
}
