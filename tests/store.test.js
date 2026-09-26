const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStore } = require('../src/store');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'focusdesk-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const vault = path.join(root, 'My Vault');
  fs.mkdirSync(path.join(vault, '.obsidian'), { recursive: true });
  return { root, vault, data: path.join(root, 'app', 'state.json') };
}

test('requires a selected Obsidian vault before creating a task', t => {
  const { data } = fixture(t);
  const store = createStore(data);
  assert.throws(() => store.createTask('Read chapter'), /vault/i);
});

test('creates a locally persistent task and one Markdown event in the selected vault', t => {
  const { data, vault } = fixture(t);
  const store = createStore(data);
  store.selectVault(vault);
  const task = store.createTask('Read chapter');
  assert.equal(task.title, 'Read chapter');
  assert.equal(createStore(data).getState().tasks[0].id, task.id);
  const dir = path.join(vault, 'FocusDesk', 'tasks');
  const files = fs.readdirSync(dir);
  assert.equal(files.length, 1);
  const md = fs.readFileSync(path.join(dir, files[0]), 'utf8');
  assert.match(md, /Event type: task-created/);
  assert.match(md, /Status: open/);
  assert.match(md, /Date: \d{4}-\d\d-\d\d/);
  assert.match(md, /Time: \d\d:\d\d:\d\d/);
  assert.match(md, /Timezone: /);
  assert.ok(md.includes(`Task ID: ${task.id}`));
  assert.match(md, /Title: Read chapter/);
  assert.equal(store.getState().pendingEvents.length, 0);
});

test('keeps the task and pending event when vault disappears, then retries once', t => {
  const { data, vault } = fixture(t);
  const store = createStore(data);
  store.selectVault(vault);
  fs.renameSync(vault, vault + '-away');
  const task = store.createTask('Offline task');
  assert.equal(createStore(data).getState().tasks[0].id, task.id);
  assert.equal(createStore(data).getState().pendingEvents.length, 1);
  assert.throws(() => store.selectVault(vault + '-away'), /pending/i);
  fs.renameSync(vault + '-away', vault);
  store.retryPending();
  store.retryPending();
  assert.equal(createStore(data).getState().pendingEvents.length, 0);
  assert.equal(fs.readdirSync(path.join(vault, 'FocusDesk', 'tasks')).length, 1);
});

test('rejects blank titles and non-vault folders', t => {
  const { data, root, vault } = fixture(t);
  const store = createStore(data);
  assert.throws(() => store.selectVault(root), /Obsidian/i);
  store.selectVault(vault);
  assert.throws(() => store.createTask('  '), /title/i);
  assert.throws(() => store.createTask('x'.repeat(201)), /200/);
  assert.equal(store.getState().tasks.length, 0);
});

test('failed local save leaves no phantom edit, status change, or deletion', t => {
  const { data, vault } = fixture(t);
  const store = createStore(data);
  store.selectVault(vault);
  const task = store.createTask('Before');
  const dir = path.join(vault, 'FocusDesk', 'tasks');
  const appDir = path.dirname(data);
  for (const [action, check] of [
    [() => store.editTask(task.id, 'After', 'blue'), state => assert.equal(state.tasks[0].title, 'Before')],
    [() => store.completeTask(task.id), state => assert.equal(state.tasks[0].status, 'open')],
    [() => store.deleteTask(task.id), state => assert.equal(state.tasks.length, 1)]
  ]) {
    fs.renameSync(appDir, appDir + '-away');
    fs.writeFileSync(appDir, 'blocking directory creation');
    assert.throws(action);
    check(store.getState());
    assert.equal(store.getState().pendingEvents.length, 0);
    fs.unlinkSync(appDir);
    fs.renameSync(appDir + '-away', appDir);
    assert.equal(fs.readdirSync(dir).length, 1);
  }
  store.completeTask(task.id);
  assert.equal(createStore(data).getState().tasks[0].status, 'completed');
  assert.equal(fs.readdirSync(dir).length, 2);
});

test('editing title and colour persists and appends one event with before/after details', t => {
  const { data, vault } = fixture(t);
  const store = createStore(data);
  store.selectVault(vault);
  const task = store.createTask('Draft notes');
  const dir = path.join(vault, 'FocusDesk', 'tasks');
  const first = fs.readdirSync(dir)[0];
  const original = fs.readFileSync(path.join(dir, first), 'utf8');
  const updated = store.editTask(task.id, 'Revised notes', 'blue');
  assert.equal(updated.title, 'Revised notes');
  assert.equal(updated.colour, 'blue');
  assert.equal(createStore(data).getState().tasks[0].colour, 'blue');
  const files = fs.readdirSync(dir);
  assert.equal(files.length, 2);
  assert.equal(fs.readFileSync(path.join(dir, first), 'utf8'), original);
  const md = fs.readFileSync(path.join(dir, files.find(file => file !== first)), 'utf8');
  assert.match(md, /Event type: task-edited/);
  assert.match(md, /Status: open/);
  assert.match(md, /Previous title: Draft notes/);
  assert.match(md, /Title: Revised notes/);
  assert.match(md, /Colour: blue/);
  assert.ok(md.includes(`Task ID: ${task.id}`));
  store.editTask(task.id, 'Revised notes', 'blue');
  assert.equal(fs.readdirSync(dir).length, 2, 'unchanged edit is not another event');
  assert.throws(() => store.editTask(task.id, '   ', 'blue'), /title/i);
  assert.throws(() => store.editTask(task.id, 'x'.repeat(201), 'blue'), /200/);
  assert.throws(() => store.editTask(task.id, 'Valid', 'not-a-colour'), /colour/i);
  assert.throws(() => store.editTask('missing', 'Valid', 'blue'), /not found/i);
  assert.equal(fs.readdirSync(dir).length, 2);
});

test('complete and reopen persist distinct append-only events; repeated state is rejected', t => {
  const { data, vault } = fixture(t);
  const store = createStore(data);
  store.selectVault(vault);
  const task = store.createTask('Study');
  const dir = path.join(vault, 'FocusDesk', 'tasks');
  store.completeTask(task.id);
  assert.equal(createStore(data).getState().tasks[0].status, 'completed');
  assert.throws(() => store.completeTask(task.id), /already completed/i);
  store.reopenTask(task.id);
  assert.equal(createStore(data).getState().tasks[0].status, 'open');
  assert.throws(() => store.reopenTask(task.id), /already open/i);
  const contents = fs.readdirSync(dir).map(file => fs.readFileSync(path.join(dir, file), 'utf8'));
  assert.equal(contents.length, 3);
  for (const [type, status] of [['task-completed', 'completed'], ['task-reopened', 'open']]) {
    const event = contents.find(md => md.includes(`Event type: ${type}`));
    assert.ok(event, type);
    assert.ok(event.includes(`Status: ${status}`));
    assert.ok(event.includes(`Task ID: ${task.id}`));
    assert.match(event, /Date: \d{4}-\d\d-\d\d/);
    assert.match(event, /Time: \d\d:\d\d:\d\d/);
    assert.match(event, /Timezone: /);
  }
  assert.throws(() => store.completeTask('missing'), /not found/i);
  assert.equal(fs.readdirSync(dir).length, 3);
});

test('deleting removes local task but preserves its snapshot in one new event', t => {
  const { data, vault } = fixture(t);
  const store = createStore(data);
  store.selectVault(vault);
  const task = store.createTask('Old task');
  store.editTask(task.id, 'Final title', 'peach');
  const dir = path.join(vault, 'FocusDesk', 'tasks');
  const before = new Map(fs.readdirSync(dir).map(file => [file, fs.readFileSync(path.join(dir, file), 'utf8')]));
  store.deleteTask(task.id);
  assert.equal(createStore(data).getState().tasks.length, 0);
  const files = fs.readdirSync(dir);
  assert.equal(files.length, before.size + 1);
  for (const [file, md] of before) assert.equal(fs.readFileSync(path.join(dir, file), 'utf8'), md);
  const deleted = fs.readFileSync(path.join(dir, files.find(file => !before.has(file))), 'utf8');
  assert.match(deleted, /Event type: task-deleted/);
  assert.match(deleted, /Status: deleted/);
  assert.match(deleted, /Title: Final title/);
  assert.match(deleted, /Colour: peach/);
  assert.ok(deleted.includes(`Task ID: ${task.id}`));
  assert.throws(() => store.deleteTask(task.id), /not found/i);
  assert.equal(fs.readdirSync(dir).length, files.length);
});

test('edit, complete, reopen and delete queue separately while vault is missing, then retry once', t => {
  const { data, vault } = fixture(t);
  const store = createStore(data);
  store.selectVault(vault);
  const task = store.createTask('Before');
  fs.renameSync(vault, vault + '-away');
  store.editTask(task.id, 'After', 'lavender');
  store.completeTask(task.id);
  store.reopenTask(task.id);
  store.deleteTask(task.id);
  assert.equal(createStore(data).getState().pendingEvents.length, 4);
  assert.equal(createStore(data).getState().tasks.length, 0);
  fs.renameSync(vault + '-away', vault);
  const dir = path.join(vault, 'FocusDesk', 'tasks');
  const original = fs.readdirSync(dir)[0];
  const contents = fs.readFileSync(path.join(dir, original), 'utf8');
  createStore(data).retryPending();
  createStore(data).retryPending();
  assert.equal(createStore(data).getState().pendingEvents.length, 0);
  assert.equal(fs.readdirSync(dir).length, 5);
  assert.equal(fs.readFileSync(path.join(dir, original), 'utf8'), contents);
  for (const type of ['task-created', 'task-edited', 'task-completed', 'task-reopened', 'task-deleted']) {
    assert.equal(fs.readdirSync(dir).filter(file => fs.readFileSync(path.join(dir, file), 'utf8').includes(`Event type: ${type}`)).length, 1);
  }
});

test('optional task details persist, validate, and keep older tasks compatible', t => {
  const { data, vault } = fixture(t);
  const store = createStore(data);
  store.selectVault(vault);
  const task = store.createTask('Essay', { description: 'Draft an outline', focusMinutes: 40, breakMinutes: 12 });
  assert.equal(createStore(data).getState().tasks[0].description, 'Draft an outline');
  assert.equal(task.focusMinutes, 40);
  const edited = store.editTask(task.id, 'Essay', 'blue', { description: '', focusMinutes: 25, breakMinutes: 10 });
  assert.equal(edited.description, '');
  assert.equal(edited.breakMinutes, 10);
  assert.throws(() => store.createTask('Bad', { focusMinutes: 0 }), /1.*180/);
  assert.throws(() => store.editTask(task.id, 'Essay', 'blue', { breakMinutes: 181 }), /1.*180/);
  const legacy = store.createTask('Older task');
  assert.equal(legacy.focusMinutes, undefined);
  assert.equal(store.editTask(legacy.id, 'Older task', 'sage').title, 'Older task');
  assert.equal(createStore(data).getState().tasks.length, 2);
});
