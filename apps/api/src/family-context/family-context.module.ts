import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FamilyContextService } from './family-context.service';
import { Family, Child } from '../entities';

@Module({
  imports: [TypeOrmModule.forFeature([Family, Child])],
  providers: [FamilyContextService],
  exports: [FamilyContextService],
})
export class FamilyContextModule {}
