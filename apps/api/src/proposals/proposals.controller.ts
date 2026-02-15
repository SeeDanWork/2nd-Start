import {
  Controller,
  Get,
  Post,
  Param,
  Body,
} from '@nestjs/common';
import { ProposalsService } from './proposals.service';

@Controller('families/:familyId/proposals')
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Post('generate')
  async generate(
    @Param('familyId') familyId: string,
    @Body('requestId') requestId: string,
  ) {
    return this.proposalsService.generateProposals(familyId, requestId);
  }

  @Get(':requestId')
  async getProposals(
    @Param('familyId') familyId: string,
    @Param('requestId') requestId: string,
  ) {
    return this.proposalsService.getProposals(familyId, requestId);
  }

  @Post(':optionId/accept')
  async accept(
    @Param('familyId') familyId: string,
    @Param('optionId') optionId: string,
    @Body('userId') userId: string,
  ) {
    return this.proposalsService.acceptProposal(familyId, optionId, userId);
  }

  @Post(':requestId/decline')
  async decline(
    @Param('familyId') familyId: string,
    @Param('requestId') requestId: string,
    @Body('userId') userId: string,
  ) {
    return this.proposalsService.declineProposal(familyId, requestId, userId);
  }
}
