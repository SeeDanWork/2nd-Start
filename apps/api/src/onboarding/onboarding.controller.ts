import { Controller, Get } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('health')
  health() {
    return { status: 'ok', module: 'onboarding' };
  }
}
