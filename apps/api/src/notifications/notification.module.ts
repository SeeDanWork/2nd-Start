import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { FamilyGateway } from './family.gateway';
import { NotificationRecord, User } from '../entities';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationRecord, User]),
    forwardRef(() => MessagingModule),
  ],
  controllers: [NotificationController],
  providers: [NotificationService, FamilyGateway],
  exports: [NotificationService, FamilyGateway],
})
export class NotificationModule {}
