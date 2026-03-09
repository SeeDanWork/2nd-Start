export interface ChangedNight {
  date: string;
  childId: string;
  fromParentId: string;
  toParentId: string;
}

export interface ExchangeChange {
  date: string;
  childId: string;
  fromParentId: string;
  toParentId: string;
  time: string;
  location: string;
}

export interface ChangedExchange {
  date: string;
  childId: string;
  before: {
    fromParentId: string;
    toParentId: string;
    time: string;
    location: string;
  };
  after: {
    fromParentId: string;
    toParentId: string;
    time: string;
    location: string;
  };
}

export interface ScheduleDiffSummary {
  changedNightCount: number;
  changedExchangeCount: number;
  affectedChildren: string[];
  affectedDates: string[];
}

export interface ScheduleDiff {
  changedNights: ChangedNight[];
  addedExchanges: ExchangeChange[];
  removedExchanges: ExchangeChange[];
  changedExchanges: ChangedExchange[];
  summary: ScheduleDiffSummary;
}
