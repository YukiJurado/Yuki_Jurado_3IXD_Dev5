const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStore } = require('../src/store');

function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'focusdesk-focus-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const vault = path.join(root, 'vault');
  fs.mkdirSync(path.join(vault, '.obsidian'), { recursive: true });
  const data = path.join(root, 'app', 'state.json');
  let time = Date.parse('2026-09-26T12:00:00.000Z');
  const clock = () => time;
  const advance = ms => { time += ms; };
  const store = createStore(data, { now: clock });
  store.selectVault(vault);
  const events = () => fs.readdirSync(path.join(vault, 'FocusDesk', 'focus')).map(file => fs.readFileSync(path.join(vault, 'FocusDesk', 'focus', file), 'utf8'));
  return { store, data, vault, clock, advance, events };
}

test('linked focus start snapshots task, cancel logs once without completed history', t => {
  const { store, data, advance, events } = setup(t);
  const task = store.createTask('Original');
  const session = store.startFocus({ taskId: task.id });
  assert.equal(session.taskId, task.id);
  assert.equal(session.taskTitle, 'Original');
  assert.equal(session.status, 'running');
  assert.throws(() => store.startFocus({ description: 'Another' }), /already/i);
  store.editTask(task.id, 'Renamed', 'blue');
  advance(12_345);
  store.stopFocus();
  const state = createStore(data).getState();
  assert.equal(state.sessions.length, 0);
  assert.equal(state.activeSession, null);
  assert.equal(state.tasks[0].status, 'open');
  assert.equal(events().length, 2);
  const started = events().find(md => md.includes('Event type: focus-start'));
  const cancelled = events().find(md => md.includes('Event type: focus-cancelled'));
  for (const md of [started, cancelled]) {
    assert.ok(md.includes(`Session ID: ${session.id}`));
    assert.ok(md.includes(`Task ID: ${task.id}`));
    assert.match(md, /Task title: Original/);
    assert.match(md, /Event ID: /);
    assert.match(md, /Date: \d{4}-\d\d-\d\d/);
    assert.match(md, /Time: \d\d:\d\d:\d\d/);
    assert.match(md, /Timezone: /);
  }
  assert.match(cancelled, /Status: cancelled/);
  assert.throws(() => store.stopFocus(), /no active/i);
  assert.equal(events().length, 2);
});

test('pause excludes idle time; manual Finish stores actual duration and leaves task open', t => {
  const { store, data, advance, events } = setup(t);
  const task = store.createTask('Read');
  store.startFocus({ taskId: task.id });
  advance(4_250);
  store.pauseFocus();
  advance(20_000);
  store.tick();
  assert.equal(store.getState().activeSession.activeMs, 4_250);
  store.resumeFocus();
  advance(2_500);
  const finished = store.finishFocus();
  assert.equal(finished.actualMs, 6_750);
  assert.equal(finished.taskTitle, 'Read');
  assert.equal(createStore(data).getState().sessions[0].actualMs, 6_750);
  assert.equal(createStore(data).getState().tasks[0].status, 'open');
  const completed = events().find(md => md.includes('Event type: focus-completed'));
  assert.match(completed, /Status: completed/);
  assert.match(completed, /Actual active duration: 6750 ms/);
  assert.equal(events().length, 2);
  assert.throws(() => store.finishFocus(), /no active/i);
});

test('description-only focus requires a nonempty link and a selected vault', t => {
  const { store, data } = setup(t);
  assert.throws(() => store.startFocus({}), /task or description/i);
  assert.throws(() => store.startFocus({ description: '   ' }), /task or description/i);
  assert.throws(() => store.startFocus({ taskId: 'unknown' }), /not found/i);
  assert.throws(() => store.startFocus({ taskId: 'unknown', description: 'Mixed' }), /either/i);
  const session = store.startFocus({ description: '  Study   biology  ' });
  assert.equal(session.description, 'Study biology');
  assert.equal(session.taskId, null);
  assert.equal(createStore(data).getState().activeSession.description, 'Study biology');
});

test('configurable length auto-finishes at zero with measured time and one completion event', t => {
  const { store, data, advance, events } = setup(t);
  assert.equal(store.getState().focusMinutes, 25);
  assert.throws(() => store.setFocusMinutes(0), /1.*180/);
  assert.throws(() => store.setFocusMinutes('1'), /1.*180/);
  store.setFocusMinutes(1);
  const session = store.startFocus({ description: 'Practice scales' });
  advance(59_000);
  store.tick();
  assert.equal(store.getState().activeSession.status, 'running');
  advance(1_000);
  store.tick();
  const state = createStore(data).getState();
  assert.equal(state.activeSession, null);
  assert.equal(state.focusMinutes, 1);
  assert.equal(state.sessions.length, 1);
  assert.equal(state.sessions[0].id, session.id);
  assert.equal(state.sessions[0].actualMs, 60_000);
  assert.equal(events().filter(md => md.includes('Event type: focus-completed')).length, 1);
  assert.match(events().find(md => md.includes('Event type: focus-completed')), /Activity: Practice scales/);
  store.tick();
  assert.equal(events().length, 2);
});

test('a linked task completes at zero, logs once, and offers a break', t => {
  const { store, vault, advance, events } = setup(t);
  const task = store.createTask('Finish reading', { focusMinutes: 1, breakMinutes: 3 });
  store.startFocus({ taskId: task.id });
  advance(60_000);
  store.tick();
  store.tick();
  const state = store.getState();
  assert.equal(state.tasks.find(item => item.id === task.id).status, 'completed');
  assert.equal(state.sessions[0].taskAutoCompleted, true);
  assert.deepEqual(state.breakOffer, { kind: 'short', minutes: 3 });
  assert.equal(events().filter(md => md.includes('Event type: focus-completed')).length, 1);
  const taskEvents = fs.readdirSync(path.join(vault, 'FocusDesk', 'tasks'))
    .map(file => fs.readFileSync(path.join(vault, 'FocusDesk', 'tasks', file), 'utf8'));
  assert.equal(taskEvents.filter(md => md.includes('Event type: task-completed')).length, 1);
  assert.match(taskEvents.find(md => md.includes('Event type: task-completed')), new RegExp(`Task ID: ${task.id}`));
});

test('close and reopen offers Resume or Cancel without counting closed time', t => {
  const { store, data, clock, advance, events } = setup(t);
  const session = store.startFocus({ description: 'Reading' });
  advance(3_000);
  store.interruptFocus();
  assert.equal(store.getState().activeSession.status, 'interrupted');
  advance(60_000);
  const reopened = createStore(data, { now: clock });
  assert.equal(reopened.getState().activeSession.status, 'interrupted');
  assert.equal(reopened.getState().activeSession.activeMs, 3_000);
  assert.equal(reopened.getState().sessions.length, 0);
  reopened.resumeFocus();
  advance(2_000);
  const finished = reopened.finishFocus();
  assert.equal(finished.actualMs, 5_000);
  assert.equal(finished.id, session.id);
  assert.equal(events().length, 2);
  assert.equal(createStore(data).getState().sessions[0].actualMs, 5_000);

  reopened.startFocus({ description: 'Another' });
  advance(1_000);
  reopened.interruptFocus();
  const again = createStore(data, { now: clock });
  again.stopFocus();
  assert.equal(again.getState().sessions.length, 1);
  assert.equal(events().filter(md => md.includes('Event type: focus-cancelled')).length, 1);
});

test('focus events queue for the original unavailable vault and retry without duplicates', t => {
  const { store, data, vault, advance, events } = setup(t);
  const task = store.createTask('Keep snapshot');
  fs.renameSync(vault, vault + '-away');
  store.startFocus({ taskId: task.id });
  store.deleteTask(task.id);
  advance(1_500);
  store.finishFocus();
  assert.equal(store.getState().sessions[0].taskTitle, 'Keep snapshot');
  assert.equal(createStore(data).getState().pendingEvents.length, 3); // task delete + start + finish
  assert.throws(() => store.selectVault(vault + '-away'), /pending/i);
  fs.renameSync(vault + '-away', vault);
  store.retryPending();
  store.retryPending();
  assert.equal(createStore(data).getState().pendingEvents.length, 0);
  assert.equal(events().length, 2);
  assert.equal(events().filter(md => md.includes('Event type: focus-start')).length, 1);
  assert.equal(events().filter(md => md.includes('Event type: focus-completed')).length, 1);
  assert.match(events().find(md => md.includes('Event type: focus-completed')), /Task title: Keep snapshot/);
});

test('unexpected exit discards time since last saved tick and never silently completes', t => {
  const { store, data, clock, advance, events } = setup(t);
  store.setFocusMinutes(1);
  store.startFocus({ description: 'Recovery' });
  advance(2_000);
  store.tick();
  advance(120_000); // No close hook ran: the last checkpoint is the only trusted time.
  const reopened = createStore(data, { now: clock });
  assert.equal(reopened.getState().activeSession.status, 'interrupted');
  assert.equal(reopened.getState().activeSession.activeMs, 2_000);
  assert.equal(reopened.getState().sessions.length, 0);
  assert.equal(events().length, 1);
});

test('optional +5 minutes is available once and keeps actual duration separate from plan', t => {
  const { store, advance, events } = setup(t);
  store.setFocusMinutes(1);
  store.startFocus({ description: 'Essay' });
  advance(30_000);
  const extended = store.extendFocus();
  assert.equal(extended.plannedMs, 6 * 60_000);
  assert.equal(extended.extended, true);
  assert.throws(() => store.extendFocus(), /already extended/i);
  advance(10_000);
  const finished = store.finishFocus();
  assert.equal(finished.actualMs, 40_000);
  assert.equal(finished.plannedMs, 6 * 60_000);
  assert.match(events().find(md => md.includes('Event type: focus-completed')), /Actual active duration: 40000 ms/);
});

test('a Stop click after zero cannot turn an elapsed session into a cancellation', t => {
  const { store, advance, events } = setup(t);
  store.setFocusMinutes(1);
  store.startFocus({ description: 'Elapsed' });
  advance(60_001); // The UI/main interval has not yet called tick.
  assert.throws(() => store.stopFocus(), /already completed/i);
  assert.equal(store.getState().sessions.length, 1);
  assert.equal(store.getState().sessions[0].actualMs, 60_000);
  assert.equal(events().filter(md => md.includes('focus-cancelled')).length, 0);
});

test('task suggestions initialise a session but adjustable lengths override them without changing the task', t => {
  const { store, advance } = setup(t);
  const task = store.createTask('Essay', { focusMinutes: 40, breakMinutes: 12 });
  const first = store.startFocus({ taskId: task.id, minutes: 30, breakMinutes: 8 });
  assert.equal(first.plannedMs, 30 * 60_000);
  advance(2_000);
  store.finishFocus();
  assert.deepEqual(store.getState().breakOffer, { kind: 'long', minutes: 8 });
  assert.equal(store.getState().tasks[0].focusMinutes, 40);
  const second = store.startFocus({ taskId: task.id });
  assert.equal(second.configuredMinutes, 40);
  advance(1_000);
  store.finishFocus();
  assert.deepEqual(store.getState().breakOffer, { kind: 'long', minutes: 12 });
  assert.throws(() => store.startFocus({ taskId: task.id, minutes: 0 }), /1.*180/);
  assert.throws(() => store.startFocus({ taskId: task.id, breakMinutes: 181 }), /1.*180/);
});
