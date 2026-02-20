import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { FamilyGateway } from './family.gateway';
import { NotificationRecord, User } from '../entities';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationRecord, User])],
  controllers: [NotificationController],
  providers: [NotificationService, FamilyGateway],
  exports: [NotificationService, FamilyGateway],
})
export class NotificationModule {}
