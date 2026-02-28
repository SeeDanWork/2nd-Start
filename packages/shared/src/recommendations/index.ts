// ─── Recommendations Barrel ───────────────────────────────────────
//
// Re-exports the new V2 modules and the deprecated V1 API from baselines.ts.

// V2 modules
export * from './age_baselines';
export * from './templates';
export * from './scoring';
export * from './explain';
export * from './context';
export * from './multi_child';

// V1 (deprecated) — kept for backward compatibility
export * from './baselines';
