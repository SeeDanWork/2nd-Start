import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedbackService } from './feedback.service';
import { UserFeedback, FeedbackProfile, AuditLog } from '../entities';

@Module({
  imports: [TypeOrmModule.forFeature([UserFeedback, FeedbackProfile, AuditLog])],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
