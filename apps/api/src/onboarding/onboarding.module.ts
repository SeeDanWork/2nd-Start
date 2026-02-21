import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { Family } from '../entities';

@Module({
  imports: [
    HttpModule.register({
      baseURL: process.env.OPTIMIZER_URL || 'http://localhost:8000',
      timeout: 30000,
    }),
    TypeOrmModule.forFeature([Family]),
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
