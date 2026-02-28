import { Controller, Post, Body } from '@nestjs/common';
import { PresetsService } from './presets.service';
import type { PresetInput } from '@adcp/shared';

@Controller('presets')
export class PresetsController {
  constructor(private readonly presetsService: PresetsService) {}

  @Post('recommendations')
  getRecommendations(@Body() input: PresetInput) {
    return this.presetsService.getRecommendations(input);
  }
}
