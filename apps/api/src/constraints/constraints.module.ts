import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConstraintsController } from './constraints.controller';
import { ConstraintsService } from './constraints.service';
import { ConstraintSet, Constraint, AuditLog } from '../entities';
import { FamiliesModule } from '../families/families.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ConstraintSet, Constraint, AuditLog]),
    FamiliesModule,
  ],
  controllers: [ConstraintsController],
  providers: [ConstraintsService],
  exports: [ConstraintsService],
})
export class ConstraintsModule {}
