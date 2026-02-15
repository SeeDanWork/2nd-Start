import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChildrenController } from './children.controller';
import { ChildrenService } from './children.service';
import { Child } from '../entities';
import { FamiliesModule } from '../families/families.module';

@Module({
  imports: [TypeOrmModule.forFeature([Child]), FamiliesModule],
  controllers: [ChildrenController],
  providers: [ChildrenService],
  exports: [ChildrenService],
})
export class ChildrenModule {}
