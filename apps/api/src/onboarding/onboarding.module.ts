import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [
    HttpModule.register({
      baseURL: process.env.OPTIMIZER_URL || 'http://localhost:8000',
      timeout: 30000,
    }),
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
