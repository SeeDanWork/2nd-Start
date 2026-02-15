import { Controller, Get } from '@nestjs/common';
import { FamiliesService } from './families.service';

@Controller('families')
export class FamiliesController {
  constructor(private readonly familiesService: FamiliesService) {}

  @Get('health')
  health() {
    return { status: 'ok', module: 'families' };
  }
}
