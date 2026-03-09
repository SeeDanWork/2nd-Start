/**
 * Format a week of overnight assignments into a human-readable SMS summary.
 * Groups consecutive days assigned to the same parent.
 */
export function formatWeekSchedule(
  assignments: { date: string; assignedTo: string }[],
  userRole: string,
): string {
  if (assignments.length === 0) {
    return 'No schedule found for this week.';
  }

  const sorted = [...assignments].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Group consecutive days by parent
  const blocks: { start: string; end: string; parent: string }[] = [];
  let current: { start: string; end: string; parent: string } | null = null;

  for (const a of sorted) {
    if (current && current.parent === a.assignedTo) {
      current.end = a.date;
    } else {
      if (current) blocks.push(current);
      current = { start: a.date, end: a.date, parent: a.assignedTo };
    }
  }
  if (current) blocks.push(current);

  const lines = blocks.map((block) => {
    const startDay = dayNames[new Date(block.start + 'T00:00:00').getDay()];
    const endDay = dayNames[new Date(block.end + 'T00:00:00').getDay()];
    const label = block.parent === userRole ? 'You' : 'Other Parent';
    const dayRange =
      block.start === block.end ? startDay : `${startDay}-${endDay}`;
    return ` ${dayRange}: ${label}`;
  });

  return `This week:\n${lines.join('\n')}`;
}

/**
 * Format a single day's assignment into a human-readable SMS message.
 */
export function formatDaySchedule(
  assignment: { date: string; assignedTo: string } | null,
  date: string,
  userRole: string,
): string {
  if (!assignment) {
    return `No schedule found for ${date}.`;
  }

  const dayNames = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  const d = new Date(date + 'T00:00:00');
  const dayName = dayNames[d.getDay()];

  if (assignment.assignedTo === userRole) {
    return `${dayName}: You have the kids.`;
  }
  return `${dayName}: Other Parent has the kids.`;
}
