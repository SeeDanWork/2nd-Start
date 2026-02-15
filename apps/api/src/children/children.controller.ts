import { Controller, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ChildrenService } from './children.service';
import { FamiliesService } from '../families/families.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../entities';

@Controller('families/:familyId/children')
export class ChildrenController {
  constructor(
    private readonly childrenService: ChildrenService,
    private readonly familiesService: FamiliesService,
  ) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async create(
    @CurrentUser() user: User,
    @Param('familyId') familyId: string,
    @Body() body: { firstName: string; dateOfBirth?: string; schoolName?: string },
  ) {
    await this.familiesService.verifyMembership(familyId, user.id);
    return this.childrenService.create(familyId, body);
  }

  @Patch(':childId')
  @UseGuards(AuthGuard('jwt'))
  async update(
    @CurrentUser() user: User,
    @Param('familyId') familyId: string,
    @Param('childId') childId: string,
    @Body() body: { firstName?: string; dateOfBirth?: string; schoolName?: string },
  ) {
    await this.familiesService.verifyMembership(familyId, user.id);
    return this.childrenService.update(familyId, childId, body);
  }
}
