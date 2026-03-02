// ─── PDF Shared Styles ───────────────────────────────────────────
//
// StyleSheet for @react-pdf/renderer. Uses the same color palette
// as the deterministic model tester UI.

import { StyleSheet, Font } from '@react-pdf/renderer';

// Register Helvetica (built-in, no registration needed)
// @react-pdf/renderer includes Helvetica by default

export const COLORS = {
  parentA: '#ffedd0',
  parentB: '#dcfee5',
  parentAText: '#92400e',
  parentBText: '#166534',
  headerBg: '#1a1a2e',
  headerText: '#ffffff',
  sectionBg: '#f8f9fa',
  border: '#e5e7eb',
  textPrimary: '#1a1a2e',
  textSecondary: '#6b7280',
  accent: '#4A90D9',
  changeBg: '#fef3c7',
  changeBorder: '#fbbf24',
  changeText: '#92400e',
  white: '#ffffff',
};

export const pdfStyles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: COLORS.textPrimary,
  },

  // ─── Header ─────────────────────────────────────────
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.headerBg,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },

  // ─── Section ────────────────────────────────────────
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.headerBg,
    marginBottom: 8,
    marginTop: 16,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionSubtitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.textPrimary,
    marginBottom: 4,
    marginTop: 8,
  },

  // ─── Tables ─────────────────────────────────────────
  table: {
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    minHeight: 18,
    alignItems: 'center',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.sectionBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    minHeight: 20,
    alignItems: 'center',
  },
  tableCell: {
    padding: 3,
    fontSize: 8,
  },
  tableCellBold: {
    padding: 3,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
  },

  // ─── Pattern Grid ──────────────────────────────────
  gridContainer: {
    marginBottom: 8,
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  gridLabel: {
    width: 50,
    fontSize: 7,
    color: COLORS.textSecondary,
    paddingTop: 2,
  },
  gridCell: {
    width: 28,
    height: 16,
    marginRight: 2,
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridCellText: {
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
  },
  gridDayLabel: {
    width: 28,
    marginRight: 2,
    fontSize: 6,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // ─── Change Callout ────────────────────────────────
  changeBox: {
    backgroundColor: COLORS.changeBg,
    borderWidth: 1,
    borderColor: COLORS.changeBorder,
    borderRadius: 4,
    padding: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  changeTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.changeText,
    marginBottom: 4,
  },
  changeItem: {
    fontSize: 8,
    color: COLORS.changeText,
    marginBottom: 2,
  },

  // ─── No Changes ────────────────────────────────────
  noChangeBox: {
    backgroundColor: COLORS.sectionBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  noChangeText: {
    fontSize: 8,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },

  // ─── Bullets ───────────────────────────────────────
  bullet: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingLeft: 8,
  },
  bulletDot: {
    width: 8,
    fontSize: 8,
    color: COLORS.textSecondary,
  },
  bulletText: {
    flex: 1,
    fontSize: 8,
    color: COLORS.textPrimary,
  },

  // ─── Summary Table ─────────────────────────────────
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  summaryLabel: {
    width: 120,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.textSecondary,
  },
  summaryValue: {
    flex: 1,
    fontSize: 8,
    color: COLORS.textPrimary,
  },

  // ─── Footer ────────────────────────────────────────
  footer: {
    marginTop: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  footerText: {
    fontSize: 7,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },

  // ─── Arrow for transitions ─────────────────────────
  arrow: {
    fontSize: 8,
    color: COLORS.accent,
    fontFamily: 'Helvetica-Bold',
  },
});
