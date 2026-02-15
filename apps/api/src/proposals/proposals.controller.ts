import { Controller, Get } from '@nestjs/common';
import { ProposalsService } from './proposals.service';

@Controller('families/:familyId/proposals')
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Get('health')
  health() {
    return { status: 'ok', module: 'proposals' };
  }
}
