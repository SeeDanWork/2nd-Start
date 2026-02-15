import { Controller, Get } from '@nestjs/common';
import { SharingService } from './sharing.service';

@Controller('sharing')
export class SharingController {
  constructor(private readonly sharingService: SharingService) {}

  @Get('health')
  health() {
    return { status: 'ok', module: 'sharing' };
  }
}
