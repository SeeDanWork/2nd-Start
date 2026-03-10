import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { OperatorService } from './operator.service';
import { SmsOnboardingService } from '../messaging/sms-onboarding.service';

/**
 * Operator Controller — admin surface for pilot management.
 *
 * Provides: family pause/resume, SMS kill switch, conversation inspection,
 * audit trace views, system health, and operational metrics.
 */
@Controller('operator')
export class OperatorController {
  constructor(
    private readonly operatorService: OperatorService,
    private readonly onboardingService: SmsOnboardingService,
  ) {}

  // ── System Health ──────────────────────────────────────────

  @Get('health')
  getHealth() {
    return this.operatorService.getSystemHealth();
  }

  @Get('metrics')
  getMetrics() {
    return this.operatorService.getOperationalMetrics();
  }

  // ── SMS Kill Switch ────────────────────────────────────────

  @Get('sms/status')
  getSmsStatus() {
    return this.operatorService.getSmsGlobalStatus();
  }

  @Post('sms/pause')
  @HttpCode(HttpStatus.OK)
  pauseSms(@Body() body: { reason: string }) {
    if (!body.reason) throw new BadRequestException('Reason required');
    return this.operatorService.pauseGlobalSms(body.reason);
  }

  @Post('sms/resume')
  @HttpCode(HttpStatus.OK)
  resumeSms() {
    return this.operatorService.resumeGlobalSms();
  }

  // ── Family Management ──────────────────────────────────────

  @Get('families')
  listFamilies(@Query('status') status?: string) {
    return this.operatorService.listPilotFamilies(status);
  }

  @Get('families/:familyId')
  getFamilyDetail(@Param('familyId') familyId: string) {
    return this.operatorService.getFamilyDetail(familyId);
  }

  @Post('families/:familyId/pause')
  @HttpCode(HttpStatus.OK)
  pauseFamily(
    @Param('familyId') familyId: string,
    @Body() body: { reason: string },
  ) {
    if (!body.reason) throw new BadRequestException('Reason required');
    return this.operatorService.pauseFamily(familyId, body.reason);
  }

  @Post('families/:familyId/resume')
  @HttpCode(HttpStatus.OK)
  resumeFamily(@Param('familyId') familyId: string) {
    return this.operatorService.resumeFamily(familyId);
  }

  // ── Conversation Inspection ────────────────────────────────

  @Get('conversations')
  listConversations(@Query('familyId') familyId?: string) {
    return this.operatorService.listConversations(familyId);
  }

  @Get('conversations/:phoneNumber/history')
  getConversationHistory(
    @Param('phoneNumber') phoneNumber: string,
    @Query('limit') limit?: string,
  ) {
    return this.operatorService.getConversationHistory(
      phoneNumber,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  // ── Audit Trace ────────────────────────────────────────────

  @Get('audit/:familyId')
  getAuditTrace(
    @Param('familyId') familyId: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
  ) {
    return this.operatorService.getAuditTrace(
      familyId,
      limit ? parseInt(limit, 10) : 100,
      action,
    );
  }

  // ── Rate Limit Status ──────────────────────────────────────

  @Get('rate-limits/:familyId')
  getRateLimitStatus(@Param('familyId') familyId: string) {
    return this.operatorService.getRateLimitStatus(familyId);
  }

  // ── SMS Onboarding ─────────────────────────────────────────

  @Post('onboarding/generate-code')
  @HttpCode(HttpStatus.OK)
  generateRegistrationCode(@Body() body: { userId: string; familyId: string }) {
    if (!body.userId || !body.familyId) {
      throw new BadRequestException('userId and familyId required');
    }
    const code = this.onboardingService.generateRegistrationCode(body.userId, body.familyId);
    return { code, expiresInMinutes: 30 };
  }

  @Post('onboarding/manual-link')
  @HttpCode(HttpStatus.OK)
  async manualLink(@Body() body: { phoneNumber: string; userId: string; familyId: string }) {
    if (!body.phoneNumber || !body.userId || !body.familyId) {
      throw new BadRequestException('phoneNumber, userId, and familyId required');
    }
    await this.onboardingService.manualLink(body.phoneNumber, body.userId, body.familyId);
    return { linked: true, phoneNumber: body.phoneNumber, userId: body.userId };
  }

  @Get('onboarding/pending')
  listPendingRegistrations() {
    return this.onboardingService.listPendingRegistrations();
  }
}
