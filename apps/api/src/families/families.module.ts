import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FamiliesController } from './families.controller';
import { FamiliesService } from './families.service';
import { Family, FamilyMembership, User, ConstraintSet } from '../entities';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Family, FamilyMembership, User, ConstraintSet]),
    AuthModule,
  ],
  controllers: [FamiliesController],
  providers: [FamiliesService],
  exports: [FamiliesService],
})
export class FamiliesModule {}
