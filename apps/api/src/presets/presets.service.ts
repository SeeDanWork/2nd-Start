import { Injectable } from '@nestjs/common';
import {
  computePresetRecommendations,
  type PresetInput,
  type PresetOutput,
} from '@adcp/shared';

@Injectable()
export class PresetsService {
  getRecommendations(input: PresetInput): PresetOutput {
    return computePresetRecommendations(input);
  }
}
