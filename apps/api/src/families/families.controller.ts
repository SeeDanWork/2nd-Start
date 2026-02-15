import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FamiliesService } from './families.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../entities';

@Controller('families')
export class FamiliesController {
  constructor(private readonly familiesService: FamiliesService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(
    @CurrentUser() user: User,
    @Body() body: { name?: string; timezone: string },
  ) {
    return this.familiesService.create(user.id, body);
  }

  @Get(':familyId')
  @UseGuards(AuthGuard('jwt'))
  async getFamily(
    @CurrentUser() user: User,
    @Param('familyId') familyId: string,
  ) {
    await this.familiesService.verifyMembership(familyId, user.id);
    return this.familiesService.getFamily(familyId);
  }

  @Patch(':familyId')
  @UseGuards(AuthGuard('jwt'))
  async updateSettings(
    @CurrentUser() user: User,
    @Param('familyId') familyId: string,
    @Body() body: Record<string, unknown>,
  ) {
    await this.familiesService.verifyMembership(familyId, user.id);
    return this.familiesService.updateSettings(familyId, body);
  }

  @Post(':familyId/invite')
  @UseGuards(AuthGuard('jwt'))
  async invite(
    @CurrentUser() user: User,
    @Param('familyId') familyId: string,
    @Body() body: { email: string; role: string; label: string },
  ) {
    await this.familiesService.verifyMembership(familyId, user.id);
    return this.familiesService.invite(familyId, user.id, body);
  }

  @Post(':familyId/accept-invite')
  @UseGuards(AuthGuard('jwt'))
  acceptInvite(
    @CurrentUser() user: User,
    @Body() body: { token: string },
  ) {
    return this.familiesService.acceptInvite(body.token, user.id);
  }

  @Get(':familyId/members')
  @UseGuards(AuthGuard('jwt'))
  async getMembers(
    @CurrentUser() user: User,
    @Param('familyId') familyId: string,
  ) {
    await this.familiesService.verifyMembership(familyId, user.id);
    return this.familiesService.getMembers(familyId);
  }
}
