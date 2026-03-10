import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperatorController } from './operator.controller';
import { OperatorService } from './operator.service';
import { Family, SmsConversation, AuditLog } from '../entities';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Family, SmsConversation, AuditLog]),
    forwardRef(() => MessagingModule),
  ],
  controllers: [OperatorController],
  providers: [OperatorService],
  exports: [OperatorService],
})
export class OperatorModule {}
