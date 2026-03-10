export type PolicyScopeType = 'FAMILY' | 'CHILD' | 'DATE_RANGE' | 'CHILD_DATE_RANGE';

export interface PolicyScope {
  scopeType: PolicyScopeType;
  childId?: string;
  dateStart?: string; // YYYY-MM-DD
  dateEnd?: string;   // YYYY-MM-DD
}
