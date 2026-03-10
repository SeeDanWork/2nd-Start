import {
  Controller,
  Get,
  Post,
  Param,
  Body,
} from '@nestjs/common';
import { MediationService } from './mediation.service';
import { PreConflictService } from './preconflict.service';
import { FeedbackService } from '../feedback/feedback.service';

@Controller()
export class MediationController {
  constructor(
    private readonly mediationService: MediationService,
    private readonly preConflictService: PreConflictService,
    private readonly feedbackService: FeedbackService,
  ) {}

  @Get('families/:familyId/mediation/proposals/:requestId')
  async getGuidedProposals(
    @Param('familyId') familyId: string,
    @Param('requestId') requestId: string,
  ) {
    return this.mediationService.getGuidedProposals(familyId, requestId);
  }

  @Post('families/:familyId/mediation/accept')
  async acceptWithNotification(
    @Param('familyId') familyId: string,
    @Body('optionId') optionId: string,
    @Body('userId') userId: string,
  ) {
    return this.mediationService.acceptWithNotification(familyId, optionId, userId);
  }

  @Post('families/:familyId/mediation/decline')
  async declineWithFeedback(
    @Param('familyId') familyId: string,
    @Body('requestId') requestId: string,
    @Body('userId') userId: string,
    @Body('feedbacks') feedbacks?: any[],
  ) {
    return this.mediationService.declineWithFeedback(
      familyId,
      requestId,
      userId,
      feedbacks,
    );
  }

  @Post('families/:familyId/mediation/objection')
  async handleObjection(
    @Param('familyId') familyId: string,
    @Body('requestId') requestId: string,
    @Body('userId') userId: string,
    @Body('feedbacks') feedbacks: any[],
    @Body('declinedOptionIds') declinedOptionIds: string[],
  ) {
    return this.mediationService.handleObjection(
      familyId,
      requestId,
      userId,
      feedbacks,
      declinedOptionIds,
    );
  }

  @Post('families/:familyId/mediation/feedback')
  async submitFeedback(
    @Param('familyId') familyId: string,
    @Body('userId') userId: string,
    @Body('feedbacks') feedbacks: any[],
    @Body('requestId') requestId?: string,
    @Body('optionId') optionId?: string,
  ) {
    return this.feedbackService.submitFeedback(
      familyId,
      userId,
      feedbacks,
      requestId,
      optionId,
    );
  }

  @Get('families/:familyId/mediation/feedback-profile')
  async getFeedbackProfile(@Param('familyId') familyId: string) {
    return this.feedbackService.getProfile(familyId);
  }

  @Get('families/:familyId/mediation/alerts')
  async getAlerts(@Param('familyId') familyId: string) {
    const today = new Date().toISOString().split('T')[0];
    return this.preConflictService.checkFamily(familyId, today);
  }

  @Post('mediation/cron/daily')
  async runDailyChecks(@Body('familyId') familyId: string) {
    const today = new Date().toISOString().split('T')[0];
    return this.preConflictService.runDailyCheck(familyId, today);
  }
}
