// ─── PDF Milestone Report ────────────────────────────────────────
//
// Root <Document> for @react-pdf/renderer.
// Header, 6 milestone sections, disclaimers footer.

import { Document, Page, View, Text } from '@react-pdf/renderer';
import type { BaselineRecommendationInputV2 } from '@adcp/shared';
import { getDisclaimers } from '@adcp/shared';
import type { MilestoneSnapshot } from '../milestones';
import { ReportHeader } from './ReportHeader';
import { MilestoneSection } from './MilestoneSection';
import { pdfStyles, COLORS } from './styles';

interface Props {
  familyInput: BaselineRecommendationInputV2;
  arrangement: string;
  snapshots: MilestoneSnapshot[];
  generatedAt: string;
}

export function MilestoneReport({ familyInput, arrangement, snapshots, generatedAt }: Props) {
  const disclaimers = getDisclaimers();

  return (
    <Document
      title="ADCP Deterministic Model Report"
      author="ADCP Model Tester"
      subject="Model Evolution Over Time"
    >
      {/* Page 1: Header + first milestone */}
      <Page size="A4" style={pdfStyles.page}>
        <ReportHeader
          familyInput={familyInput}
          arrangement={arrangement}
          children={snapshots[0]?.children ?? []}
          generatedAt={generatedAt}
        />

        {snapshots.length > 0 && (
          <MilestoneSection
            snapshot={snapshots[0]}
            index={0}
            arrangement={arrangement}
          />
        )}
      </Page>

      {/* Pages 2+: Remaining milestones, 2 per page */}
      {chunkArray(snapshots.slice(1), 2).map((chunk, pageIdx) => (
        <Page key={pageIdx} size="A4" style={pdfStyles.page}>
          {chunk.map((snapshot, chunkIdx) => {
            const globalIdx = pageIdx * 2 + chunkIdx + 1;
            return (
              <MilestoneSection
                key={globalIdx}
                snapshot={snapshot}
                index={globalIdx}
                arrangement={arrangement}
              />
            );
          })}

          {/* Footer on last page */}
          {pageIdx === chunkArray(snapshots.slice(1), 2).length - 1 && (
            <View style={pdfStyles.footer}>
              <Text style={{ ...pdfStyles.sectionSubtitle, fontSize: 9 }}>Disclaimers</Text>
              {disclaimers.map((d, i) => (
                <Text key={i} style={pdfStyles.footerText}>• {d}</Text>
              ))}
              <Text style={pdfStyles.footerText}>
                • Age transitions are approximate and depend on exact birthdates
              </Text>
              <Text style={{ ...pdfStyles.footerText, marginTop: 8, fontStyle: 'italic' }}>
                Generated {generatedAt} — ADCP Deterministic Model Tester
              </Text>
            </View>
          )}
        </Page>
      ))}
    </Document>
  );
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
