import { Controller, Get } from '@nestjs/common';
import { LocationsService } from './locations.service';

@Controller('families/:familyId/locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('health')
  health() {
    return { status: 'ok', module: 'locations' };
  }
}
