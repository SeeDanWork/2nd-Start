import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DisruptionsService } from './disruptions.service';
import { CreateDisruptionDto, CreatePolicyDto } from './dto';

@Controller('families/:familyId')
export class DisruptionsController {
  constructor(private readonly disruptionsService: DisruptionsService) {}

  @Post('disruptions')
  async reportDisruption(
    @Param('familyId') familyId: string,
    @Body() dto: CreateDisruptionDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id ?? 'system';
    return this.disruptionsService.reportDisruption(familyId, userId, dto);
  }

  @Get('disruptions')
  async getActiveDisruptions(
    @Param('familyId') familyId: string,
  ) {
    return this.disruptionsService.getActiveDisruptions(familyId);
  }

  @Post('disruptions/:eventId/resolve')
  async resolveDisruption(
    @Param('familyId') familyId: string,
    @Param('eventId') eventId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id ?? 'system';
    return this.disruptionsService.resolveDisruption(familyId, eventId, userId);
  }

  @Get('disruption-policies')
  async getOverlayPolicies(
    @Param('familyId') familyId: string,
  ) {
    return this.disruptionsService.getOverlayPolicies(familyId);
  }

  @Post('disruption-policies')
  async setFamilyPolicy(
    @Param('familyId') familyId: string,
    @Body() dto: CreatePolicyDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id ?? 'system';
    return this.disruptionsService.setFamilyPolicy(familyId, userId, dto);
  }

  @Post('disruptions/:eventId/decide')
  async recordDecision(
    @Param('familyId') familyId: string,
    @Param('eventId') eventId: string,
    @Body() body: { policyId: string; actionTaken: string; accepted: boolean },
    @Req() req: any,
  ) {
    const userId = req.user?.id ?? null;
    return this.disruptionsService.recordDecision(
      familyId,
      eventId,
      body.policyId,
      body.actionTaken,
      body.accepted,
      userId,
    );
  }

  @Get('disruption-learning/:eventType')
  async checkLearning(
    @Param('familyId') familyId: string,
    @Param('eventType') eventType: string,
  ) {
    return this.disruptionsService.checkPromotionEligibility(familyId, eventType);
  }

  @Post('disruption-learning/:eventType/promote')
  async promote(
    @Param('familyId') familyId: string,
    @Param('eventType') eventType: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id ?? 'system';
    return this.disruptionsService.promoteToLearnedPolicy(familyId, eventType, userId);
  }
}
