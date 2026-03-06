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
   * Generate an onboarding preview showing how schedule changes with an arrangement.
   */
  async generateArrangementPreview(
    arrangement: 'shared' | 'primary' | 'undecided',
    lockedDays: number[],
    parentALabel: string,
  ): Promise<string> {
    const width = 600;
    const height = 200;
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayWidth = 74;
    const startX = 26;
    const startY = 70;
    const gap = 6;

    // Generate a sample 2-week pattern
    const week1: string[] = [];
    const week2: string[] = [];

    for (let dow = 0; dow < 7; dow++) {
      let w1Parent: string;
      let w2Parent: string;

      if (lockedDays.includes(dow)) {
        w1Parent = 'parent_a';
        w2Parent = 'parent_a';
      } else if (arrangement === 'primary') {
        w1Parent = (dow === 0 || dow === 6) ? 'parent_b' : 'parent_a';
        w2Parent = w1Parent;
      } else {
        w1Parent = 'parent_a';
        w2Parent = 'parent_b';
      }
      week1.push(w1Parent);
      week2.push(w2Parent);
    }

    const title = arrangement === 'shared'
      ? 'Alternating Weeks Preview'
      : arrangement === 'primary'
        ? 'Primary Custody Preview'
        : 'Default Schedule Preview';

    const renderWeek = (week: string[], label: string, yOffset: number) => {
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
        <text x="30" y="50" font-family="Arial, sans-serif" font-size="11" fill="#6b7280">Week 1 &amp; Week 2 pattern</text>
        <text x="10" y="${startY + 22}" font-family="Arial, sans-serif" font-size="9" fill="#6b7280">W1</text>
        ${renderWeek(week1, 'Week 1', 0)}
        <text x="10" y="${startY + 66}" font-family="Arial, sans-serif" font-size="9" fill="#6b7280">W2</text>
        ${renderWeek(week2, 'Week 2', 44)}
        <rect x="30" y="${height - 30}" width="10" height="10" rx="2" fill="#FFA54C" />
        <text x="46" y="${height - 21}" font-family="Arial, sans-serif" font-size="10" fill="#9ca3af">${parentALabel}</text>
        <rect x="140" y="${height - 30}" width="10" height="10" rx="2" fill="#4CAF7C" />
        <text x="156" y="${height - 21}" font-family="Arial, sans-serif" font-size="10" fill="#9ca3af">Co-parent</text>
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
