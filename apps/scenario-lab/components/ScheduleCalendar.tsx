'use client';

import { useEffect, useRef } from 'react';
import { ScheduleDay } from '@/lib/types';

interface ScheduleCalendarProps {
  days: ScheduleDay[];
  parentALabel: string;
  parentBLabel: string;
}

export function ScheduleCalendar({ days, parentALabel, parentBLabel }: ScheduleCalendarProps) {
  const calRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!calRef.current || days.length === 0) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let calInstance: any = null;

    // Dynamic import to avoid SSR issues
    Promise.all([
      import('@fullcalendar/core'),
      import('@fullcalendar/daygrid'),
    ]).then(([{ Calendar }, { default: dayGridPlugin }]) => {
      if (!calRef.current) return;

      const events = days.map(d => ({
        title: d.assignedTo === 'parent_a' ? parentALabel : parentBLabel,
        start: d.date,
        allDay: true,
        backgroundColor: d.assignedTo === 'parent_a' ? '#FFA54C' : '#4CAF7C',
        borderColor: d.assignedTo === 'parent_a' ? '#FFA54C' : '#4CAF7C',
        textColor: '#fff',
      }));

      calInstance = new Calendar(calRef.current, {
        plugins: [dayGridPlugin],
        initialView: 'dayGridMonth',
        initialDate: days[0]?.date,
        events,
        headerToolbar: {
          left: 'prev,next',
          center: 'title',
          right: '',
        },
        height: 'auto',
        dayMaxEvents: 1,
      });

      calInstance.render();
    });

    return () => {
      calInstance?.destroy();
    };
  }, [days, parentALabel, parentBLabel]);

  if (days.length === 0) {
    return (
      <div className="text-center py-8 text-lab-300 text-sm">
        No schedule data yet. Complete onboarding to see the calendar.
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-4 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-parentA" />
          <span className="text-xs text-lab-500">{parentALabel}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-parentB" />
          <span className="text-xs text-lab-500">{parentBLabel}</span>
        </div>
      </div>
      <div ref={calRef} />
    </div>
  );
}
