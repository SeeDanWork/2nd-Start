import { PatternDetector } from './PatternDetector';
import { PreferredExchangeDayDetector } from './PreferredExchangeDayDetector';
import { PreferredExchangeLocationDetector } from './PreferredExchangeLocationDetector';
import { SchoolClosureCoverageDetector } from './SchoolClosureCoverageDetector';
import { MinBlockLengthAdjustmentDetector } from './MinBlockLengthAdjustmentDetector';
import { ActivityResponsibilityDetector } from './ActivityResponsibilityDetector';
import { SiblingDivergencePreferenceDetector } from './SiblingDivergencePreferenceDetector';

/**
 * Registry of all pattern detectors, executed in deterministic order.
 */
export class PatternDetectorRegistry {
  private readonly detectors: PatternDetector[];

  constructor(detectors?: PatternDetector[]) {
    this.detectors = detectors ?? [
      new PreferredExchangeDayDetector(),
      new PreferredExchangeLocationDetector(),
      new SchoolClosureCoverageDetector(),
      new MinBlockLengthAdjustmentDetector(),
      new ActivityResponsibilityDetector(),
      new SiblingDivergencePreferenceDetector(),
    ];
  }

  getDetectors(): PatternDetector[] {
    return [...this.detectors];
  }

  getDetectorBySuggestionType(type: string): PatternDetector | undefined {
    return this.detectors.find(d => d.suggestionType === type);
  }
}
