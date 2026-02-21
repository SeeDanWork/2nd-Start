import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  // ── Templates ───────────────────────────────────────────────────

  @Get('templates')
  getTemplates() {
    return this.onboardingService.getTemplates();
  }

  @Get('templates/:templateId')
  getTemplate(@Param('templateId') templateId: string) {
    const template = this.onboardingService.getTemplate(templateId);
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  // ── Brain (optimizer proxy) ─────────────────────────────────────

  @Post('validate')
  validate(@Body() body: { inputs: Record<string, unknown> }) {
    return this.onboardingService.validateInputs(body.inputs);
  }

  @Post('conflicts')
  conflicts(@Body() body: { inputs: Record<string, unknown> }) {
    return this.onboardingService.detectConflicts(body.inputs);
  }

  @Post('options')
  generateOptions(
    @Body() body: { inputs: Record<string, unknown>; config?: Record<string, unknown> },
  ) {
    return this.onboardingService.generateOptions(body.inputs, body.config);
  }

  @Post('explain')
  explain(@Body() body: { inputs: Record<string, unknown>; profile: string }) {
    return this.onboardingService.explainOption(body.inputs, body.profile);
  }

  // ── Persist optimizer input ───────────────────────────────────────

  @Post('save-input')
  @UseGuards(AuthGuard('jwt'))
  saveInput(@Body() body: { familyId: string; input: Record<string, unknown> }) {
    return this.onboardingService.saveInput(body.familyId, body.input);
  }

  @Get('saved-input/:familyId')
  @UseGuards(AuthGuard('jwt'))
  getSavedInput(@Param('familyId') familyId: string) {
    return this.onboardingService.getSavedInput(familyId);
  }
}
