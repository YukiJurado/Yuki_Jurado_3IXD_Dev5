const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStore } = require('../src/store');

function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'focusdesk-break-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const vault = path.join(root, 'vault');
  fs.mkdirSync(path.join(vault, '.obsidian'), { recursive: true });
  const data = path.join(root, 'state.json');
  let time = Date.parse('2026-09-26T12:00:00Z');
  const clock = () => time;
  const store = createStore(data, { now: clock });
  store.selectVault(vault);
  return { store, data, clock, advance: ms => { time += ms; } };
}

test('short and long break offers use configurable lengths and never alter focus history', t => {
  const { store, data, advance } = setup(t);
  assert.deepEqual(store.getState().breakMinutes, { short: 10, long: 30 });
  assert.throws(() => store.setBreakMinutes(0, 30), /1.*180/);
  store.setBreakMinutes(2, 3);
  store.setFocusMinutes(25);
  store.startFocus({ description: 'Short plan' });
  advance(2_000);
  store.finishFocus();
  assert.deepEqual(store.getState().breakOffer, { kind: 'short', minutes: 2 });
  store.startBreak();
  assert.equal(store.getState().activeBreak.plannedMs, 120_000);
  advance(4_000);
  store.finishBreak();
  assert.equal(createStore(data).getState().sessions.length, 1);
  assert.equal(store.getState().activeBreak, null);
  assert.equal(store.getState().breakOffer, null);
  store.setFocusMinutes(26);
  store.startFocus({ description: 'Long plan' });
  advance(1_000);
  store.finishFocus();
  assert.deepEqual(store.getState().breakOffer, { kind: 'long', minutes: 3 });
  store.startBreak();
  assert.equal(store.getState().activeBreak.plannedMs, 180_000);
  store.stopBreak();
  assert.equal(createStore(data).getState().sessions.length, 2);
  assert.deepEqual(createStore(data).getState().sessions.map(s => s.actualMs), [2_000, 1_000]);
});

test('break counts down to zero, persists and excludes closed-app time', t => {
  const { store, data, clock, advance } = setup(t);
  store.setBreakMinutes(1, 30);
  store.setFocusMinutes(1);
  store.startFocus({ description: 'Study' });
  store.finishFocus();
  store.startBreak();
  advance(20_000);
  store.tick();
  assert.equal(store.getState().activeBreak.remainingMs, 40_000);
  advance(30_000);
  const reopened = createStore(data, { now: clock });
  assert.equal(reopened.getState().activeBreak.status, 'paused');
  assert.equal(reopened.getState().activeBreak.remainingMs, 40_000);
  reopened.resumeBreak();
  advance(40_000);
  reopened.tick();
  assert.equal(reopened.getState().activeBreak, null);
  assert.equal(reopened.getState().sessions.length, 1);
  assert.equal(reopened.getState().sessions[0].actualMs, 0);
});

test('30 minutes of focus plus an optional 10-minute break takes 40 minutes but records 30', t => {
  const { store, clock, advance } = setup(t);
  const startedAt = clock();
  const task = store.createTask('Study chapter');
  store.startFocus({ taskId: task.id, minutes: 30, breakMinutes: 10 });
  advance(30 * 60_000);
  store.tick();
  assert.equal(store.getState().tasks[0].status, 'completed');
  assert.equal(store.getState().sessions[0].actualMs, 30 * 60_000);
  assert.deepEqual(store.getState().breakOffer, { kind: 'long', minutes: 10 });
  store.startBreak();
  advance(10 * 60_000);
  store.tick();
  assert.equal(store.getState().activeBreak, null);
  assert.equal(store.getState().sessions[0].actualMs, 30 * 60_000);
  assert.equal(clock() - startedAt, 40 * 60_000);
});
