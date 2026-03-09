import { BasePolicyParameters } from './BasePolicyParameters';

export interface SiblingCohesionParameters extends BasePolicyParameters {
  allowDivergence: boolean;
  maxSplitNights?: number;
  minAgeGapForDivergence?: number;
}

export interface MinBlockLengthParameters extends BasePolicyParameters {
  nights: number;
}

export interface SchoolNightRoutineParameters extends BasePolicyParameters {
  maxWeekdayTransitions: number;
  /** Protected weekdays: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun */
  protectedWeekdays?: number[];
}

export interface TravelDistanceLimitParameters extends BasePolicyParameters {
  maxMinutes: number;
}

export interface ExchangeLocationParameters extends BasePolicyParameters {
  preferredLocation: string;
  allowedLocations?: string[];
}

export interface ActivityCommitmentParameters extends BasePolicyParameters {
  activityLabel: string;
  preferredResponsibleParentId?: string;
  fixedDates?: string[]; // YYYY-MM-DD
}
