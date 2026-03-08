import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getScenario } from '@/lib/store';

export async function POST(req: NextRequest) {
  const { scenarioId } = await req.json();
  const scenario = getScenario(scenarioId);
  if (!scenario) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 10;
  const lineHeight = 14;
  const margin = 50;

  function addPage() {
    const page = pdf.addPage([612, 792]); // Letter size
    return { page, y: 792 - margin };
  }

  // ── Page 1: Scenario Summary ──
  let { page, y } = addPage();
  const pageWidth = 612 - margin * 2;

  function drawText(text: string, size = fontSize, bold = false) {
    const f = bold ? fontBold : font;
    const lines = wrapText(text, f, size, pageWidth);
    for (const line of lines) {
      if (y < margin + lineHeight) {
        ({ page, y } = addPage());
      }
      page.drawText(line, { x: margin, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
      y -= lineHeight;
    }
  }

  function drawSpacer(h = 10) { y -= h; }

  drawText('ADCP Scenario Lab - Test Report', 16, true);
  drawSpacer(5);
  drawText(`Generated: ${new Date().toISOString().slice(0, 19)}`, 9);
  drawSpacer(15);

  drawText('Scenario Configuration', 13, true);
  drawSpacer(5);
  drawText(`Name: ${scenario.config.name}`);
  drawText(`Description: ${scenario.config.description}`);
  drawText(`Template: ${scenario.config.template}`);
  drawText(`Target Split: ${scenario.config.targetSplit}/${100 - scenario.config.targetSplit}`);
  drawText(`Distance: ${scenario.config.distanceMiles} miles`);
  drawText(`Children: ${scenario.config.children.map(c => `${c.name} (${c.age})`).join(', ')}`);
  drawText(`Parent A: ${scenario.config.parentA.label} (${scenario.config.parentA.phone})`);
  drawText(`Parent B: ${scenario.config.parentB.label} (${scenario.config.parentB.phone})`);
  drawText(`Status: ${scenario.status}`);

  if (scenario.config.lockedNights.length > 0) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (const ln of scenario.config.lockedNights) {
      drawText(`Locked: ${ln.parent} on ${ln.daysOfWeek.map(d => days[d]).join(', ')}`);
    }
  }

  if (scenario.config.tags.length > 0) {
    drawText(`Tags: ${scenario.config.tags.join(', ')}`);
  }

  // ── Page 2+: Conversation Logs ──
  drawSpacer(20);
  drawText('Parent A Conversation', 13, true);
  drawSpacer(5);
  for (const msg of scenario.messagesA) {
    const prefix = msg.from === 'user' ? `[${scenario.config.parentA.label}]` : '[ADCP]';
    drawText(`${prefix} ${msg.text}`, 9);
    drawSpacer(3);
  }

  drawSpacer(20);
  drawText('Parent B Conversation', 13, true);
  drawSpacer(5);
  for (const msg of scenario.messagesB) {
    const prefix = msg.from === 'user' ? `[${scenario.config.parentB.label}]` : '[ADCP]';
    drawText(`${prefix} ${msg.text}`, 9);
    drawSpacer(3);
  }

  // ── Schedule ──
  if (scenario.schedule.length > 0) {
    drawSpacer(20);
    drawText('Schedule', 13, true);
    drawSpacer(5);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (const day of scenario.schedule.slice(0, 56)) {
      const d = new Date(day.date);
      const dow = days[d.getDay()];
      const label = day.assignedTo === 'parent_a' ? scenario.config.parentA.label : scenario.config.parentB.label;
      const trans = day.isTransition ? ' [transition]' : '';
      drawText(`${day.date} (${dow}): ${label}${trans}`, 8);
      drawSpacer(1);
    }
    if (scenario.schedule.length > 56) {
      drawText(`... and ${scenario.schedule.length - 56} more days`, 8);
    }
  }

  // ── Diagnostics Log ──
  drawSpacer(20);
  drawText('Diagnostics Log', 13, true);
  drawSpacer(5);
  for (const log of scenario.logs) {
    const ts = log.timestamp.slice(11, 19);
    const dataStr = sanitize(JSON.stringify(log.data).slice(0, 120));
    drawText(`[${ts}] ${log.type} (${log.phone.slice(-4)}): ${dataStr}`, 8);
    drawSpacer(2);
  }

  const pdfBytes = await pdf.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="scenario-${scenario.id}.pdf"`,
    },
  });
}

/** Sanitize text for WinAnsi encoding (pdf-lib standard fonts) */
function sanitize(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A]/g, "'")   // smart single quotes
    .replace(/[\u201C\u201D\u201E]/g, '"')    // smart double quotes
    .replace(/\u2013/g, '-')                   // en dash
    .replace(/\u2014/g, '--')                  // em dash
    .replace(/\u2026/g, '...')                 // ellipsis
    .replace(/\u2022/g, '*')                   // bullet
    .replace(/\u26A0/g, '[!]')                 // warning sign
    .replace(/\u2192/g, '->')                  // right arrow
    .replace(/[^\x20-\x7E\n\t]/g, '');        // strip remaining non-ASCII
}

function wrapText(text: string, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number, maxWidth: number): string[] {
  const safe = sanitize(text);
  // Split on newlines first, then wrap each line
  const inputLines = safe.split('\n');
  const result: string[] = [];

  for (const inputLine of inputLines) {
    if (inputLine.trim() === '') {
      result.push('');
      continue;
    }
    const words = inputLine.split(' ');
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      try {
        if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
          result.push(current);
          current = word;
        } else {
          current = test;
        }
      } catch {
        // Skip problematic text
        if (current) result.push(current);
        current = '';
      }
    }
    if (current) result.push(current);
  }

  return result.length ? result : [''];
}
