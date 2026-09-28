const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStore } = require('../src/store');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'focusdesk-groups-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const vault = path.join(root, 'vault');
  fs.mkdirSync(path.join(vault, '.obsidian'), { recursive: true });
  return { vault, data: path.join(root, 'data', 'state.json') };
}

test('six user-named groups persist without changing an older ungrouped task', t => {
  const { vault, data } = fixture(t);
  const store = createStore(data);
  store.selectVault(vault);
  const olderTask = store.createTask('Existing task');
  const names = ['Subject One', 'Subject Two', 'Subject Three', 'Subject Four', 'Subject Five', 'Subject Six'];
  const groups = names.map(name => store.createGroup(name));
  assert.deepEqual(groups.map(group => group.name), names);
  assert.equal(new Set(groups.map(group => group.id)).size, 6);
  assert.deepEqual(createStore(data).getState().groups, groups);
  assert.equal(createStore(data).getState().tasks.find(task => task.id === olderTask.id).groupId ?? null, null);
  assert.throws(() => store.createGroup(' subject one '), /already exists/i);
  assert.throws(() => store.createGroup('  '), /group name/i);
  assert.throws(() => store.createGroup('x'.repeat(61)), /60/);
  assert.equal(createStore(data).getState().groups.length, 6);
});

test('task assignments, moves and ungrouping persist and append named events to the selected vault', t => {
  const { vault, data } = fixture(t);
  const store = createStore(data);
  store.selectVault(vault);
  const first = store.createGroup('Subject One');
  const second = store.createGroup('Subject Two');
  const task = store.createTask('Study', { groupId: first.id });
  const dir = path.join(vault, 'FocusDesk', 'tasks');
  const initial = fs.readdirSync(dir).map(file => fs.readFileSync(path.join(dir, file), 'utf8'));
  assert.equal(initial.length, 1);
  assert.match(initial[0], /Event type: task-created/);
  assert.match(initial[0], /Group: Subject One/);
  store.editTask(task.id, task.title, 'sage', { groupId: second.id });
  assert.equal(createStore(data).getState().tasks[0].groupId, second.id);
  const moved = fs.readdirSync(dir).map(file => fs.readFileSync(path.join(dir, file), 'utf8'));
  assert.equal(moved.length, 2);
  assert.ok(moved.includes(initial[0]), 'older event is untouched');
  assert.match(moved.find(md => !initial.includes(md)), /Previous group: Subject One[\s\S]*Group: Subject Two/);
  store.completeTask(task.id);
  const completed = fs.readdirSync(dir).map(file => fs.readFileSync(path.join(dir, file), 'utf8')).find(md => md.includes('Event type: task-completed'));
  assert.match(completed, /Group: Subject Two/);
  store.editTask(task.id, task.title, 'sage', { groupId: null });
  assert.equal(createStore(data).getState().tasks[0].groupId, null);
  const events = fs.readdirSync(dir).map(file => fs.readFileSync(path.join(dir, file), 'utf8'));
  assert.match(events.find(md => md.includes('Previous group: Subject Two')), /Group: Ungrouped/);
  store.editTask(task.id, task.title, 'sage', { groupId: null });
  assert.equal(fs.readdirSync(dir).length, events.length, 'unchanged edit adds no event');
  assert.throws(() => store.editTask(task.id, task.title, 'sage', { groupId: 'not-a-group' }), /group/i);
  assert.throws(() => store.createTask('Invalid', { groupId: 'not-a-group' }), /group/i);
  assert.equal(createStore(data).getState().tasks.length, 1);
});
