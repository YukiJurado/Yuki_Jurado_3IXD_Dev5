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
  assert.equal(store.getState().tasks.length, 0);
});
