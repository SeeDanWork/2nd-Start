import { Injectable, Logger } from '@nestjs/common';
import * as sharp from 'sharp';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

export interface CalendarDay {
  date: string;
  assignedTo: 'parent_a' | 'parent_b';
  isTransition?: boolean;
}

export interface DayDetail {
  date: string;
  dayName: string;
  assignedTo: string;
  parentLabel: string;
}

@Injectable()
export class ScheduleImageService {
  private readonly logger = new Logger(ScheduleImageService.name);
  private readonly mediaDir: string;

  constructor() {
    this.mediaDir = path.join(process.cwd(), 'media');
    if (!fs.existsSync(this.mediaDir)) {
      fs.mkdirSync(this.mediaDir, { recursive: true });
    }
  }

  /**
   * Generate a weekly schedule card showing 7 days with parent colors.
   */
  async generateWeekCard(
    days: CalendarDay[],
    parentALabel: string,
    parentBLabel: string,
    title?: string,
  ): Promise<string> {
    const width = 600;
    const height = 280;
    const dayWidth = 74;
    const dayHeight = 90;
    const startX = 26;
    const startY = 80;
    const gap = 6;

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const headerTitle = title || 'This Week';

    const dayRects = days.slice(0, 7).map((day, i) => {
      const x = startX + i * (dayWidth + gap);
      const isA = day.assignedTo === 'parent_a';
      const bg = isA ? '#FFA54C' : '#4CAF7C';
      const label = isA ? 'A' : 'B';
      const d = new Date(day.date + 'T12:00:00');
      const dayNum = d.getDate();
      const dow = d.getDay();

      return `
        <rect x="${x}" y="${startY}" width="${dayWidth}" height="${dayHeight}" rx="8" fill="${bg}" />
        <text x="${x + dayWidth / 2}" y="${startY + 22}" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="600" fill="rgba(255,255,255,0.85)">${dayNames[dow]}</text>
        <text x="${x + dayWidth / 2}" y="${startY + 48}" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#fff">${dayNum}</text>
        <text x="${x + dayWidth / 2}" y="${startY + 70}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="600" fill="rgba(255,255,255,0.9)">${label}</text>
        ${day.isTransition ? `<circle cx="${x + dayWidth - 8}" cy="${startY + 8}" r="5" fill="#fff" opacity="0.7" /><text x="${x + dayWidth - 8}" y="${startY + 12}" text-anchor="middle" font-size="8" fill="${bg}">↔</text>` : ''}
      `;
    }).join('');

    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" rx="16" fill="url(#bgGrad)" />
        <text x="30" y="35" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#fff">${headerTitle}</text>
        <rect x="30" y="50" width="14" height="14" rx="3" fill="#FFA54C" />
        <text x="50" y="62" font-family="Arial, sans-serif" font-size="12" fill="#9ca3af">${parentALabel}</text>
        <rect x="160" y="50" width="14" height="14" rx="3" fill="#4CAF7C" />
        <text x="180" y="62" font-family="Arial, sans-serif" font-size="12" fill="#9ca3af">${parentBLabel}</text>
        ${dayRects}
        <text x="${width / 2}" y="${height - 15}" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#6b7280">ADCP Schedule</text>
      </svg>
    `;

    return this.svgToPng(svg, width, height);
  }

  /**
   * Generate a monthly calendar overview.
   */
  async generateMonthCalendar(
    days: CalendarDay[],
    parentALabel: string,
    parentBLabel: string,
    monthLabel: string,
  ): Promise<string> {
    const width = 600;
    const cellSize = 72;
    const gap = 4;
    const startX = 30;
    const startY = 100;
    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    // Build calendar grid
    if (days.length === 0) return this.generatePlaceholder('No schedule data');

    const firstDate = new Date(days[0].date + 'T12:00:00');
    const firstDow = firstDate.getDay();
    const totalCells = firstDow + days.length;
    const rows = Math.ceil(totalCells / 7);
    const height = startY + rows * (cellSize + gap) + 50;

    // Day headers
    const headers = dayNames.map((name, i) => {
      const x = startX + i * (cellSize + gap);
      return `<text x="${x + cellSize / 2}" y="${startY - 10}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="600" fill="#6b7280">${name}</text>`;
    }).join('');

    // Day cells
    const dayMap = new Map<string, CalendarDay>();
    for (const d of days) dayMap.set(d.date, d);

    const cells: string[] = [];
    let cellIdx = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < 7; col++) {
        const dayIndex = cellIdx - firstDow;
        if (dayIndex >= 0 && dayIndex < days.length) {
          const day = days[dayIndex];
          const x = startX + col * (cellSize + gap);
          const y = startY + row * (cellSize + gap);
          const isA = day.assignedTo === 'parent_a';
          const bg = isA ? '#FFA54C' : '#4CAF7C';
          const d = new Date(day.date + 'T12:00:00');
          const dayNum = d.getDate();

          cells.push(`
            <rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="6" fill="${bg}" opacity="0.85" />
            <text x="${x + cellSize / 2}" y="${y + 30}" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#fff">${dayNum}</text>
            <text x="${x + cellSize / 2}" y="${y + 50}" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="600" fill="rgba(255,255,255,0.8)">${isA ? 'A' : 'B'}</text>
          `);
        }
        cellIdx++;
      }
    }

    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" rx="16" fill="url(#bgGrad)" />
        <text x="30" y="35" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#fff">${monthLabel}</text>
        <rect x="30" y="55" width="14" height="14" rx="3" fill="#FFA54C" />
        <text x="50" y="67" font-family="Arial, sans-serif" font-size="12" fill="#9ca3af">${parentALabel}</text>
        <rect x="160" y="55" width="14" height="14" rx="3" fill="#4CAF7C" />
        <text x="180" y="67" font-family="Arial, sans-serif" font-size="12" fill="#9ca3af">${parentBLabel}</text>
        ${headers}
        ${cells.join('')}
        <text x="${width / 2}" y="${height - 15}" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#6b7280">ADCP Schedule</text>
      </svg>
    `;

    return this.svgToPng(svg, width, height);
  }

  /**
   * Generate a day detail card.
   */
  async generateDayCard(
    detail: DayDetail,
    isUserDay: boolean,
  ): Promise<string> {
    const width = 400;
    const height = 160;
    const accentColor = isUserDay ? '#FFA54C' : '#4CAF7C';

    const d = new Date(detail.date + 'T12:00:00');
    const fullDate = d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" rx="16" fill="url(#bgGrad)" />
        <rect x="0" y="0" width="8" height="${height}" rx="4" fill="${accentColor}" />
        <text x="30" y="40" font-family="Arial, sans-serif" font-size="14" fill="#9ca3af">${fullDate}</text>
        <text x="30" y="80" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="#fff">${detail.parentLabel}</text>
        <text x="30" y="110" font-family="Arial, sans-serif" font-size="14" fill="#6b7280">${isUserDay ? 'Your night' : "Co-parent's night"}</text>
        <text x="${width - 20}" y="${height - 15}" text-anchor="end" font-family="Arial, sans-serif" font-size="10" fill="#4b5563">ADCP</text>
      </svg>
    `;

    return this.svgToPng(svg, width, height);
  }

  /**
   * Build a 2-week repeating pattern for a given template, respecting locked days.
   * Returns [week1, week2] where each week is 7 strings ('parent_a' | 'parent_b').
   * Week indices: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
   */
  private buildTemplatePattern(
    template: string,
    lockedA: number[],
    lockedB: number[],
  ): [string[], string[]] {
    // Start with nulls for unlocked days
    const w1: (string | null)[] = new Array(7).fill(null);
    const w2: (string | null)[] = new Array(7).fill(null);

    // Apply locked days first (these override everything)
    for (const d of lockedA) { w1[d] = 'parent_a'; w2[d] = 'parent_a'; }
    for (const d of lockedB) { w1[d] = 'parent_b'; w2[d] = 'parent_b'; }

    // Template patterns for unlocked days
    // Convention: A=parent_a, B=parent_b
    switch (template) {
      case '2-2-3': {
        // Week 1: AA BB AAA  (Mon-Tue A, Wed-Thu B, Fri-Sat-Sun A)
        // Week 2: BB AA BBB  (Mon-Tue B, Wed-Thu A, Fri-Sat-Sun B)
        const w1Pattern = ['parent_a', 'parent_a', 'parent_b', 'parent_b', 'parent_a', 'parent_a', 'parent_a'];
        const w2Pattern = ['parent_b', 'parent_b', 'parent_a', 'parent_a', 'parent_b', 'parent_b', 'parent_b'];
        //                  Sun         Mon         Tue         Wed         Thu         Fri         Sat
        for (let d = 0; d < 7; d++) {
          if (w1[d] === null) w1[d] = w1Pattern[d];
          if (w2[d] === null) w2[d] = w2Pattern[d];
        }
        break;
      }
      case '3-4-4-3': {
        // Week 1: A has Mon-Wed (3), B has Thu-Sun (4)
        // Week 2: B has Mon-Thu (4), A has Fri-Sun (3)
        const w1Pattern = ['parent_b', 'parent_a', 'parent_a', 'parent_a', 'parent_b', 'parent_b', 'parent_b'];
        const w2Pattern = ['parent_a', 'parent_b', 'parent_b', 'parent_b', 'parent_b', 'parent_a', 'parent_a'];
        for (let d = 0; d < 7; d++) {
          if (w1[d] === null) w1[d] = w1Pattern[d];
          if (w2[d] === null) w2[d] = w2Pattern[d];
        }
        break;
      }
      case '5-2': {
        // A has Mon-Fri, B has Sat-Sun (same every week)
        const pattern = ['parent_b', 'parent_a', 'parent_a', 'parent_a', 'parent_a', 'parent_a', 'parent_b'];
        for (let d = 0; d < 7; d++) {
          if (w1[d] === null) w1[d] = pattern[d];
          if (w2[d] === null) w2[d] = pattern[d];
        }
        break;
      }
      case 'every_other_weekend': {
        // A has Mon-Fri every week, weekends alternate
        const w1p = ['parent_b', 'parent_a', 'parent_a', 'parent_a', 'parent_a', 'parent_a', 'parent_b'];
        const w2p = ['parent_a', 'parent_a', 'parent_a', 'parent_a', 'parent_a', 'parent_a', 'parent_a'];
        for (let d = 0; d < 7; d++) {
          if (w1[d] === null) w1[d] = w1p[d];
          if (w2[d] === null) w2[d] = w2p[d];
        }
        break;
      }
      case 'alternating_weeks':
      default: {
        // Full week alternation
        for (let d = 0; d < 7; d++) {
          if (w1[d] === null) w1[d] = 'parent_a';
          if (w2[d] === null) w2[d] = 'parent_b';
        }
        break;
      }
    }

    return [w1 as string[], w2 as string[]];
  }

  /**
   * Generate an onboarding preview showing 3 weeks of the schedule pattern.
   * Accepts a template name to render the correct day-level pattern.
   */
  async generateArrangementPreview(
    arrangement: 'shared' | 'primary' | 'undecided',
    lockedDays: number[],
    parentALabel: string,
    template?: string,
  ): Promise<string> {
    const width = 600;
    const height = 250;
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayWidth = 74;
    const startX = 26;
    const startY = 70;
    const gap = 6;
    const rowHeight = 44;

    // Build 2-week repeating pattern from template
    const effectiveTemplate = template || (arrangement === 'primary' ? '5-2' : 'alternating_weeks');
    const [w1, w2] = this.buildTemplatePattern(effectiveTemplate, lockedDays, []);

    // Week 3 = same as week 1 (repeating 2-week cycle)
    const weeks = [w1, w2, [...w1]];

    // Template display names
    const templateNames: Record<string, string> = {
      '2-2-3': '2-2-3 Pattern',
      '3-4-4-3': '3-4-4-3 Pattern',
      '5-2': '5-2 Pattern',
      'every_other_weekend': 'Every Other Weekend',
      'alternating_weeks': 'Alternating Weeks',
      'custom': 'Custom Pattern',
    };
    const title = `${templateNames[effectiveTemplate] || 'Schedule Preview'} (3 weeks)`;

    // Count nights per parent across 3 weeks
    const countA = weeks.flat().filter(p => p === 'parent_a').length;
    const countB = weeks.flat().filter(p => p === 'parent_b').length;
    const splitPct = Math.round((countA / (countA + countB)) * 100);

    const renderWeek = (week: string[], yOffset: number) => {
      return week.map((parent, i) => {
        const x = startX + i * (dayWidth + gap);
        const y = startY + yOffset;
        const isA = parent === 'parent_a';
        const bg = isA ? '#FFA54C' : '#4CAF7C';
        return `
          <rect x="${x}" y="${y}" width="${dayWidth}" height="36" rx="6" fill="${bg}" />
          <text x="${x + dayWidth / 2}" y="${y + 15}" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="600" fill="rgba(255,255,255,0.8)">${dayNames[i]}</text>
          <text x="${x + dayWidth / 2}" y="${y + 30}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="#fff">${isA ? 'A' : 'B'}</text>
        `;
      }).join('');
    };

    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" rx="16" fill="url(#bgGrad)" />
        <text x="30" y="30" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#fff">${title}</text>
        <text x="30" y="50" font-family="Arial, sans-serif" font-size="11" fill="#6b7280">Split: ${splitPct}/${100 - splitPct} over 3 weeks (${countA} nights A, ${countB} nights B)</text>
        <text x="10" y="${startY + 22}" font-family="Arial, sans-serif" font-size="9" fill="#6b7280">W1</text>
        ${renderWeek(weeks[0], 0)}
        <text x="10" y="${startY + 22 + rowHeight}" font-family="Arial, sans-serif" font-size="9" fill="#6b7280">W2</text>
        ${renderWeek(weeks[1], rowHeight)}
        <text x="10" y="${startY + 22 + rowHeight * 2}" font-family="Arial, sans-serif" font-size="9" fill="#6b7280">W3</text>
        ${renderWeek(weeks[2], rowHeight * 2)}
        <rect x="30" y="${height - 25}" width="10" height="10" rx="2" fill="#FFA54C" />
        <text x="46" y="${height - 16}" font-family="Arial, sans-serif" font-size="10" fill="#9ca3af">${parentALabel}</text>
        <rect x="140" y="${height - 25}" width="10" height="10" rx="2" fill="#4CAF7C" />
        <text x="156" y="${height - 16}" font-family="Arial, sans-serif" font-size="10" fill="#9ca3af">Co-parent</text>
      </svg>
    `;

    return this.svgToPng(svg, width, height);
  }

  getMediaPath(filename: string): string {
    return path.join(this.mediaDir, filename);
  }

  // ── Internals ───────────────────────────────────────────────

  private async svgToPng(svg: string, width: number, height: number): Promise<string> {
    const id = crypto.randomBytes(8).toString('hex');
    const filename = `${id}.png`;
    const filepath = path.join(this.mediaDir, filename);

    await (sharp as any)(Buffer.from(svg))
      .resize(width, height)
      .png()
      .toFile(filepath);

    this.logger.debug(`Generated image: ${filename}`);
    return filename;
  }

  private async generatePlaceholder(text: string): Promise<string> {
    const svg = `
      <svg width="400" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="100" rx="12" fill="#1a1a2e" />
        <text x="200" y="55" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#6b7280">${text}</text>
      </svg>
    `;
    return this.svgToPng(svg, 400, 100);
  }
}
