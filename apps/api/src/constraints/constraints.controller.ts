import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConstraintsService } from './constraints.service';
import { FamiliesService } from '../families/families.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../entities';

@Controller('families/:familyId/constraints')
export class ConstraintsController {
  constructor(
    private readonly constraintsService: ConstraintsService,
    private readonly familiesService: FamiliesService,
  ) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  async getConstraints(
    @CurrentUser() user: User,
    @Param('familyId') familyId: string,
  ) {
    await this.familiesService.verifyMembership(familyId, user.id);
    return this.constraintsService.getActiveConstraintSet(familyId);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async addConstraint(
    @CurrentUser() user: User,
    @Param('familyId') familyId: string,
    @Body() body: {
      type: string;
      hardness: string;
      weight: number;
      owner: string;
      recurrence?: Record<string, unknown>;
      dateRange?: Record<string, unknown>;
      parameters: Record<string, unknown>;
    },
  ) {
    await this.familiesService.verifyMembership(familyId, user.id);
    return this.constraintsService.addConstraint(familyId, user.id, body);
  }

  @Patch(':constraintId')
  @UseGuards(AuthGuard('jwt'))
  async updateConstraint(
    @CurrentUser() user: User,
    @Param('familyId') familyId: string,
    @Param('constraintId') constraintId: string,
    @Body() body: Record<string, unknown>,
  ) {
    await this.familiesService.verifyMembership(familyId, user.id);
    return this.constraintsService.updateConstraint(familyId, constraintId, user.id, body);
  }

  @Delete(':constraintId')
  @UseGuards(AuthGuard('jwt'))
  async removeConstraint(
    @CurrentUser() user: User,
    @Param('familyId') familyId: string,
    @Param('constraintId') constraintId: string,
  ) {
    await this.familiesService.verifyMembership(familyId, user.id);
    return this.constraintsService.removeConstraint(familyId, constraintId, user.id);
  }

  @Post('validate')
  @UseGuards(AuthGuard('jwt'))
  async validateConstraints(
    @CurrentUser() user: User,
    @Param('familyId') familyId: string,
  ) {
    await this.familiesService.verifyMembership(familyId, user.id);
    return this.constraintsService.validateConstraints(familyId);
  }
}
