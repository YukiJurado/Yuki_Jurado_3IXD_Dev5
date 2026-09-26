const test = require('node:test');
const assert = require('node:assert/strict');
const { buildReport } = require('../src/report');

// Local constructors and ISO timestamps deliberately cross the Brussels DST change.
process.env.TZ = 'Europe/Brussels';
const completed = (taskId, taskTitle, localTime, actualMs, status = 'completed') => ({
  taskId, taskTitle, actualMs, status, completedAt: localTime.toISOString()
});

test('week starts Monday and completion date, not start date, chooses the period', () => {
  const sunday = new Date(2026, 9, 25, 23, 59);
  const monday = new Date(2026, 9, 26, 0, 1);
  const sessions = [completed('a', 'A', sunday, 60_000), completed('a', 'A', monday, 120_000)];
  const before = buildReport(sessions, [], 'week', sunday);
  assert.equal(before.start.getDay(), 1);
  assert.equal(before.totalMs, 60_000);
  const after = buildReport(sessions, [], 'week', monday);
  assert.equal(after.start.getDay(), 1);
  assert.equal(after.totalMs, 120_000);
  assert.equal(buildReport(sessions, [], 'day', monday).totalMs, 120_000);
  assert.equal(buildReport(sessions, [], 'month', monday).totalMs, 180_000);
});

test('stable task ID keeps renamed task together and deleted task keeps its saved title', () => {
  const time = new Date(2026, 8, 26, 16, 0);
  const sessions = [
    completed('a', 'Old title', time, 30_000),
    completed('a', 'New title', new Date(2026, 8, 26, 17), 90_000),
    completed('deleted', 'Deleted task', time, 120_000),
    completed(null, null, time, 45_000),
    completed('a', 'New title', time, 300_000, 'cancelled')
  ];
  const report = buildReport(sessions, [{ id: 'a', title: 'Current title', colour: 'blue' }], 'day', time);
  assert.equal(report.totalMs, 285_000);
  assert.deepEqual(report.bars.map(bar => [bar.label, bar.actualMs]), [
    ['Current title', 120_000], ['Deleted task', 120_000], ['Other activities', 45_000]
  ]);
  assert.equal(report.bars[0].colour, 'blue');
  assert.equal(report.bars[2].taskId, null);
});
