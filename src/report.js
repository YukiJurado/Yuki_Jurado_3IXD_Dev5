// Shared by the Electron page and Node tests. Dates are interpreted in the computer's local timezone.
function buildReport(sessions, tasks, period, reference = new Date()) {
  if (!['day', 'week', 'month'].includes(period)) throw new Error('Choose day, week, or month.');
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const day = reference.getDate();
  let start;
  let end;
  if (period === 'day') {
    start = new Date(year, month, day);
    end = new Date(year, month, day + 1);
  } else if (period === 'week') {
    const monday = day - (reference.getDay() + 6) % 7;
    start = new Date(year, month, monday);
    end = new Date(year, month, monday + 7);
  } else {
    start = new Date(year, month, 1);
    end = new Date(year, month + 1, 1);
  }

  const currentTasks = new Map(tasks.map(task => [task.id, task]));
  const groups = new Map();
  for (const session of sessions) {
    if (session.status !== 'completed' || !Number.isFinite(session.actualMs) || session.actualMs <= 0) continue;
    const completed = new Date(session.completedAt);
    if (Number.isNaN(completed.getTime()) || completed < start || completed >= end) continue;
    const key = session.taskId || 'other';
    if (!groups.has(key)) groups.set(key, {
      taskId: session.taskId || null,
      label: session.taskId ? session.taskTitle || 'Untitled task' : 'Other activities',
      colour: session.taskId ? 'sage' : 'other',
      actualMs: 0
    });
    const group = groups.get(key);
    group.actualMs += session.actualMs;
    // For a deleted task, retain the latest title saved with its session.
    if (session.taskId && completed >= (group.latestCompletion || 0)) {
      group.label = session.taskTitle || 'Untitled task';
      group.latestCompletion = completed.getTime();
    }
  }
  const bars = [...groups.values()].map(group => {
    if (group.taskId && currentTasks.has(group.taskId)) {
      group.label = currentTasks.get(group.taskId).title;
      group.colour = currentTasks.get(group.taskId).colour || 'sage';
    }
    delete group.latestCompletion;
    return group;
  }).sort((a, b) => (a.taskId === null) - (b.taskId === null) || b.actualMs - a.actualMs || a.label.localeCompare(b.label));
  return { start, end, bars, totalMs: bars.reduce((total, bar) => total + bar.actualMs, 0) };
}

if (typeof module !== 'undefined') module.exports = { buildReport };
if (typeof window !== 'undefined') window.FocusDeskReport = { buildReport };
