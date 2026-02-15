import {
  Controller,
  Get,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

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
}
