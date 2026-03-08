'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { Message, ScheduleDay } from '@/lib/types';

// ── Message Classification ──
// Detect calculation-trace style messages for special rendering

function isCalculationTrace(text: string): boolean {
  const lower = text.toLowerCase();
  // Must be a multi-line structured trace, not a short status message
  const isMultiLine = text.includes('\n') && text.split('\n').length >= 3;
  if (!isMultiLine) return false;

  return (
    lower.includes('fairness window') ||
    lower.includes('current schedule metrics') ||
    lower.includes('parent responses:') ||
    lower.includes('weekly schedule review') ||
    lower.includes('monthly schedule report') ||
    // Only match "schedule disruption" when it's a full trace (starts with it as a heading)
    lower.startsWith('schedule disruption')
  );
}

function isDisruptionAlert(text: string): boolean {
  return text.startsWith('Schedule disruption detected.');
}

function isDaySummary(text: string): boolean {
  return text.includes('No action required.') && !text.includes('disruption');
}

// ── Calculation Trace Renderer ──

function CalculationTrace({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = text.split('\n');

  // Split into summary (first 3 lines) and detail (rest)
  const summaryLines = lines.slice(0, 3).filter(Boolean);
  const detailLines = lines.slice(3);

  return (
    <div className="font-mono">
      <div className="text-[11px] leading-relaxed">
        {summaryLines.map((line, i) => (
          <div key={i} className={line.startsWith('[') ? statusLineClass(line) : ''}>
            {line}
          </div>
        ))}
      </div>
      {detailLines.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1.5 text-[10px] text-lab-500 hover:text-lab-700 flex items-center gap-1"
          >
            <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {expanded ? 'Hide details' : 'View calculation trace'}
          </button>
          {expanded && (
            <div className="mt-1.5 pt-1.5 border-t border-lab-100 text-[10px] leading-relaxed text-lab-600">
              {detailLines.map((line, i) => {
                if (!line.trim()) return <div key={i} className="h-1.5" />;
                return (
                  <div key={i} className={statusLineClass(line)}>
                    {line}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function statusLineClass(line: string): string {
  if (line.startsWith('[+]')) return 'text-green-600';
  if (line.startsWith('[-]')) return 'text-red-500';
  if (line.startsWith('[=]')) return 'text-lab-400';
  if (line.startsWith('Result:') || line.startsWith('Constraint:')) return 'font-medium';
  return '';
}

// ── Disruption Alert Renderer ──

function DisruptionAlert({ text }: { text: string }) {
  const lines = text.split('\n').filter(Boolean);
  return (
    <div className="border-l-2 border-amber-400 pl-2">
      <div className="text-[11px] font-semibold text-amber-700 mb-1">{lines[0]}</div>
      {lines.slice(1).map((line, i) => (
        <div key={i} className="text-[11px] text-lab-600">{line}</div>
      ))}
    </div>
  );
}

// ── Day Summary Renderer ──

function DaySummaryBubble({ text }: { text: string }) {
  const lines = text.split('\n').filter(Boolean);
  return (
    <div className="text-[11px] text-lab-500 font-mono">
      {lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
}

interface PhoneSimulatorProps {
  label: string;
  phone: string;
  color: string;
  messages: Message[];
  onSend: (text: string) => void;
  onConnect: () => void;
  connected: boolean;
  sending: boolean;
  quickActions?: string[];
  schedule?: ScheduleDay[];
  parentALabel?: string;
  parentBLabel?: string;
  onViewSchedule?: () => void;
}

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isScheduleCreatedMessage(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('schedule is now created') || lower.includes('schedule has been created');
}

function SchedulePreview({ schedule, parentALabel, parentBLabel, onView }: {
  schedule: ScheduleDay[];
  parentALabel: string;
  parentBLabel: string;
  onView?: () => void;
}) {
  // Show first 14 days as a compact grid
  const preview = schedule.slice(0, 14);
  if (preview.length === 0) return null;

  return (
    <div className="mt-2 bg-lab-50 rounded-lg p-2.5 border border-lab-100">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-4 h-4 text-lab-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-[11px] font-medium text-lab-600">Schedule Preview</span>
      </div>

      {/* Week headers */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DAY_ABBR.map(d => (
          <div key={d} className="text-center text-[9px] text-lab-400 font-medium">{d}</div>
        ))}
      </div>

      {/* Day grid — 2 weeks */}
      {[0, 1].map(week => {
        const weekDays = preview.slice(week * 7, (week + 1) * 7);
        // Pad to start on correct day of week
        const firstDow = weekDays.length > 0 ? new Date(weekDays[0].date).getDay() : 0;
        const padded = week === 0
          ? [...Array(firstDow).fill(null), ...weekDays]
          : weekDays;

        return (
          <div key={week} className="grid grid-cols-7 gap-0.5 mb-0.5">
            {padded.slice(0, 7).map((day, i) => {
              if (!day) return <div key={`pad-${i}`} className="h-5" />;
              const dateNum = new Date(day.date).getDate();
              const isA = day.assignedTo === 'parent_a';
              return (
                <div
                  key={day.date}
                  className={`h-5 rounded text-center text-[9px] leading-5 font-medium ${
                    isA
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-green-100 text-green-700'
                  } ${day.isTransition ? 'ring-1 ring-lab-300' : ''}`}
                  title={`${day.date}: ${isA ? parentALabel : parentBLabel}${day.isTransition ? ' (transition)' : ''}`}
                >
                  {dateNum}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex items-center gap-3 mt-1.5">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded bg-orange-100 border border-orange-200" />
          <span className="text-[9px] text-lab-400">{parentALabel}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded bg-green-100 border border-green-200" />
          <span className="text-[9px] text-lab-400">{parentBLabel}</span>
        </div>
      </div>

      {/* View full schedule button */}
      {onView && (
        <button
          onClick={onView}
          className="mt-2 w-full py-1.5 text-[11px] font-medium text-lab-600 bg-white border border-lab-200 rounded hover:bg-lab-50 flex items-center justify-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          View Full Calendar
        </button>
      )}
    </div>
  );
}

function linkifyText(text: string): ReactNode[] {
  const pattern = /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)|(https?:\/\/[^\s)]+)/g;
  const result: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      result.push(
        <img key={match.index} src={match[2]} alt={match[1] || 'Schedule'}
          className="max-w-full rounded-lg mt-1.5 block" />
      );
    } else {
      const url = match[3];
      if (/\/messaging\/media\/.*\.png/i.test(url) || /\.(png|jpg|jpeg|gif)(\?|$)/i.test(url)) {
        result.push(
          <img key={match.index} src={url} alt="Schedule"
            className="max-w-full rounded-lg mt-1.5 block" />
        );
      } else {
        result.push(
          <a key={match.index} href={url} target="_blank" rel="noopener noreferrer"
            className="underline text-inherit">
            {url.length > 50 ? url.slice(0, 50) + '...' : url}
          </a>
        );
      }
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }
  return result.length > 0 ? result : [text];
}

export function PhoneSimulator({
  label,
  phone,
  color,
  messages,
  onSend,
  onConnect,
  connected,
  sending,
  quickActions,
  schedule,
  parentALabel,
  parentBLabel,
  onViewSchedule,
}: PhoneSimulatorProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function handleSend() {
    if (!input.trim() || sending) return;
    onSend(input.trim());
    setInput('');
  }

  return (
    <div className="flex flex-col h-full">
      {/* Phone Header */}
      <div
        className="px-3 py-2 rounded-t-lg flex items-center justify-between"
        style={{ backgroundColor: color }}
      >
        <div>
          <div className="text-white text-sm font-semibold">{label}</div>
          <div className="text-white/70 text-[10px]">{phone}</div>
        </div>
        {!connected && (
          <button
            onClick={onConnect}
            className="px-3 py-1 text-xs bg-white/20 text-white rounded hover:bg-white/30"
          >
            Connect
          </button>
        )}
        {connected && (
          <span className="text-[10px] text-white/70">Connected</span>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-lab-50 p-3 space-y-2 phone-scroll"
        style={{ minHeight: 300 }}
      >
        {messages.length === 0 && (
          <div className="text-center text-lab-300 text-xs mt-8">
            Click Connect to start
          </div>
        )}
        {messages.map(msg => {
          const isUser = msg.from === 'user';
          const isSystem = msg.from === 'system';
          const isTrace = isSystem && isCalculationTrace(msg.text);
          const isAlert = isSystem && isDisruptionAlert(msg.text);
          const isDaySum = isSystem && isDaySummary(msg.text);

          return (
            <div
              key={msg.id}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${
                  isUser
                    ? 'bg-lab-700 text-white rounded-br-sm'
                    : isAlert
                    ? 'bg-amber-50 border border-amber-200 text-lab-800 rounded-bl-sm'
                    : isTrace
                    ? 'bg-slate-50 border border-slate-200 text-lab-800 rounded-bl-sm'
                    : isDaySum
                    ? 'bg-white border border-lab-200 text-lab-600 rounded-bl-sm'
                    : 'bg-white border border-lab-200 text-lab-800 rounded-bl-sm'
                }`}
              >
                {isAlert ? (
                  <DisruptionAlert text={msg.text} />
                ) : isTrace ? (
                  <CalculationTrace text={msg.text} />
                ) : isDaySum ? (
                  <DaySummaryBubble text={msg.text} />
                ) : (
                  linkifyText(msg.text)
                )}
                {isSystem && isScheduleCreatedMessage(msg.text) && schedule && schedule.length > 0 && (
                  <SchedulePreview
                    schedule={schedule}
                    parentALabel={parentALabel || 'Parent A'}
                    parentBLabel={parentBLabel || 'Parent B'}
                    onView={onViewSchedule}
                  />
                )}
              </div>
            </div>
          );
        })}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-white border border-lab-200 px-3 py-2 rounded-xl rounded-bl-sm">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-lab-300 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-lab-300 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                <div className="w-1.5 h-1.5 bg-lab-300 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {connected && quickActions && quickActions.length > 0 && (
        <div className="px-3 py-1.5 bg-white border-t border-lab-100 flex gap-1.5 flex-wrap">
          {quickActions.map((action, i) => (
            <button
              key={i}
              onClick={() => onSend(action)}
              disabled={sending}
              className="px-2 py-1 text-[11px] bg-lab-100 text-lab-600 rounded-full hover:bg-lab-200 disabled:opacity-50"
            >
              {action}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      {connected && (
        <div className="p-2 bg-white border-t border-lab-200 rounded-b-lg">
          <div className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 text-sm border border-lab-200 rounded-full focus:outline-none focus:ring-1 focus:ring-lab-400"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Type a message..."
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="px-4 py-2 text-sm rounded-full disabled:opacity-30"
              style={{ backgroundColor: color, color: 'white' }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
