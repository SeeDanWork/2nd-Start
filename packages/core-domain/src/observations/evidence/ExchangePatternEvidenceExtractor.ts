import { ObservationEvidenceExtractor } from './ObservationEvidenceExtractor';
import { BehaviorObservationWindow, ObservationEvidenceRecord } from '../types';

export interface ExchangeRecord {
  exchangeId: string;
  familyId: string;
  date: string;
  childId: string;
  fromParentId: string;
  toParentId: string;
  time: string;
  location: string;
}

/**
 * Extracts evidence about exchange patterns.
 * Detects repeated exchange days-of-week and locations.
 */
export class ExchangePatternEvidenceExtractor implements ObservationEvidenceExtractor {
  readonly evidenceType = 'EXCHANGE_PATTERN';

  constructor(private readonly exchanges: ExchangeRecord[]) {}

  extractEvidence(input: {
    window: BehaviorObservationWindow;
  }): ObservationEvidenceRecord[] {
    const { window } = input;
    const records: ObservationEvidenceRecord[] = [];

    const filtered = this.exchanges
      .filter(e =>
        e.familyId === window.familyId &&
        e.date >= window.startDate &&
        e.date <= window.endDate,
      )
      .sort((a, b) => a.date.localeCompare(b.date) || a.exchangeId.localeCompare(b.exchangeId));

    for (const exchange of filtered) {
      const dayOfWeek = new Date(exchange.date + 'T00:00:00').getDay(); // 0=Sun

      records.push({
        evidenceId: `exchange-${exchange.exchangeId}`,
        familyId: window.familyId,
        evidenceType: this.evidenceType,
        date: exchange.date,
        childId: exchange.childId,
        relatedEntityType: 'EXCHANGE',
        relatedEntityId: exchange.exchangeId,
        data: {
          dayOfWeek,
          location: exchange.location,
          time: exchange.time,
          fromParentId: exchange.fromParentId,
          toParentId: exchange.toParentId,
        },
        createdAt: exchange.date + 'T00:00:00Z',
      });
    }

    return records;
  }
}
