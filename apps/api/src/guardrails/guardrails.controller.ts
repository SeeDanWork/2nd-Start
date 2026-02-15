import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { GuardrailsService } from './guardrails.service';

@Controller('families/:familyId')
export class GuardrailsController {
  constructor(private readonly guardrailsService: GuardrailsService) {}

  // ─── Consent Rules ─────────────────────────────────────────

  @Get('consent-rules')
  getConsentRules(@Param('familyId') familyId: string) {
    return this.guardrailsService.getConsentRules(familyId);
  }

  @Post('consent-rules')
  addConsentRule(
    @Param('familyId') familyId: string,
    @Body() body: { userId: string; ruleType: string; threshold: Record<string, unknown> },
  ) {
    return this.guardrailsService.addConsentRule(familyId, body.userId, {
      ruleType: body.ruleType,
      threshold: body.threshold,
    });
  }

  @Patch('consent-rules/:ruleId')
  updateConsentRule(
    @Param('familyId') familyId: string,
    @Param('ruleId') ruleId: string,
    @Body() body: { threshold?: Record<string, unknown>; isActive?: boolean },
  ) {
    return this.guardrailsService.updateConsentRule(familyId, ruleId, body);
  }

  @Delete('consent-rules/:ruleId')
  removeConsentRule(
    @Param('familyId') familyId: string,
    @Param('ruleId') ruleId: string,
    @Body() body: { userId: string },
  ) {
    return this.guardrailsService.removeConsentRule(familyId, ruleId, body.userId);
  }

  // ─── Budgets ───────────────────────────────────────────────

  @Get('budgets')
  getBudgets(@Param('familyId') familyId: string) {
    return this.guardrailsService.getBudgetStatus(familyId);
  }

  // ─── Emergency Mode ────────────────────────────────────────

  @Post('emergency')
  activateEmergency(
    @Param('familyId') familyId: string,
    @Body()
    body: {
      userId: string;
      returnToBaselineAt: string;
      relaxedConstraints?: Array<{ constraintId: string; originalValue: Record<string, unknown> }>;
    },
  ) {
    return this.guardrailsService.activateEmergency(familyId, body.userId, {
      returnToBaselineAt: body.returnToBaselineAt,
      relaxedConstraints: body.relaxedConstraints,
    });
  }

  @Get('emergency')
  getEmergency(@Param('familyId') familyId: string) {
    return this.guardrailsService.getEmergencyStatus(familyId);
  }

  @Patch('emergency')
  updateEmergency(
    @Param('familyId') familyId: string,
    @Body() body: { returnToBaselineAt?: string },
  ) {
    return this.guardrailsService.updateEmergency(familyId, body);
  }

  @Delete('emergency')
  cancelEmergency(
    @Param('familyId') familyId: string,
    @Body() body: { userId: string },
  ) {
    return this.guardrailsService.cancelEmergency(familyId, body.userId);
  }
}
