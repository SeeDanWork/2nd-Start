export const colors = {
  // Parent assignment backgrounds (from Figma)
  parentA: '#FFD79E',        // gold/orange — Parent A days
  parentB: '#E4F2D4',        // soft green — Parent B days
  parentABorder: '#1A1A1A',  // dark border on Parent A cells
  parentBBorder: 'transparent',

  // Semantic
  background: '#FFFFFF',
  surface: '#F6F6F6',
  text: '#1A1A1A',
  textSecondary: '#727272',
  textTertiary: 'rgba(0,0,0,0.4)',
  border: '#E1E1E1',
  unassigned: '#EFEFEF',
  overflow: '#FFFFFF',        // adjacent-month days
  overflowBorder: 'rgba(0,0,0,0.2)',

  // Aliases for backward compatibility (parentA/B are already light fills)
  parentALight: '#FFD79E',
  parentBLight: '#E4F2D4',

  // Accent
  todayBorder: '#2F53F5',
  todayText: '#0088FF',
  fab: '#56BDE6',
  chatBubbleAI: '#D5FBF9',
  chatBubbleUser: '#F6F6F6',

  // Status
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  neutral: '#9CA3AF',

  // Schedule mode colors (kept for compatibility)
  disruption: '#F59E0B',
  maxConsecutive: '#8B5CF6',
  modeEvidence: '#1D4ED8',
  modeVision: '#166534',
  modeBalanced: '#7C3AED',
} as const;
