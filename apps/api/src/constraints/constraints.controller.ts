import { Controller, Get } from '@nestjs/common';
import { ConstraintsService } from './constraints.service';

@Controller('families/:familyId/constraints')
export class ConstraintsController {
  constructor(private readonly constraintsService: ConstraintsService) {}

  @Get('health')
  health() {
    return { status: 'ok', module: 'constraints' };
  }
}
