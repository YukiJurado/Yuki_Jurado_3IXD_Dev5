const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStore } = require('../src/store');
const { buildOverview } = require('../src/vault-overview');

test('overview connects old and new task/focus events without changing event files', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'focusdesk-overview-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const vault = path.join(root, 'vault');
  fs.mkdirSync(path.join(vault, '.obsidian'), { recursive: true });
  const oldId = 'a34f7a7b-27d9-4d52-bb3b-bd5d41f1b8e0';
  const oldEvent = '# FocusDesk task event\n\n- Date: 2026-09-26\n- Time: 16:18:02\n- Event type: task-created\n- Status: open\n- Task ID: old-task\n- Title: Earlier task\n';
  const tasksDir = path.join(vault, 'FocusDesk', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(path.join(tasksDir, `${oldId}.md`), oldEvent);
  let current = Date.parse('2026-09-27T10:00:00Z');
  const store = createStore(path.join(root, 'state.json'), { now: () => current });
  store.selectVault(vault);
  const overviewPath = path.join(vault, 'FocusDesk', 'Overview.md');
  assert.match(fs.readFileSync(overviewPath, 'utf8'), new RegExp(`\\[\\[FocusDesk/tasks/${oldId}\\|task created\\]\\]`));
  const task = store.createTask('Read chapter 3');
  const session = store.startFocus({ taskId: task.id, minutes: 1 });
  current += 60_000;
  store.tick();
  const overview = fs.readFileSync(overviewPath, 'utf8');
  for (const folder of ['tasks', 'focus']) {
    for (const name of fs.readdirSync(path.join(vault, 'FocusDesk', folder)).filter(name => name.endsWith('.md'))) {
      assert.ok(overview.includes(`[[FocusDesk/${folder}/${path.basename(name, '.md')}|`));
    }
  }
  assert.match(overview, /Read chapter 3/);
  assert.match(overview, /focus completed/);
  assert.equal(fs.readFileSync(path.join(tasksDir, `${oldId}.md`), 'utf8'), oldEvent);
  assert.equal(store.getState().sessions[0].id, session.id);
  assert.equal(store.getState().pendingEvents.length, 0);
});

test('overview generation leaves a user-owned note with the same name untouched', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'focusdesk-overview-owned-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const folder = path.join(root, 'FocusDesk');
  fs.mkdirSync(folder);
  const filename = path.join(folder, 'Overview.md');
  fs.writeFileSync(filename, '# My own overview\n');
  assert.throws(() => buildOverview(root), /not created by FocusDesk/);
  assert.equal(fs.readFileSync(filename, 'utf8'), '# My own overview\n');
});
