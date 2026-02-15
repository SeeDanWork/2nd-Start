import { Controller, Get } from '@nestjs/common';
import { GuardrailsService } from './guardrails.service';

@Controller('families/:familyId')
export class GuardrailsController {
  constructor(private readonly guardrailsService: GuardrailsService) {}

  @Get('health')
  health() {
    return { status: 'ok', module: 'guardrails' };
  }
}
