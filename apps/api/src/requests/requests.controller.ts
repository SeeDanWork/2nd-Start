import { Controller, Get } from '@nestjs/common';
import { RequestsService } from './requests.service';

@Controller('families/:familyId/requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Get('health')
  health() {
    return { status: 'ok', module: 'requests' };
  }
}
