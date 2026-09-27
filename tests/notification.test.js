const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function appHarness(initialState, actions) {
  const handlers = new Map();
  const notifications = [];
  let checkpoint;
  let state = initialState;
  const store = {
    getState: () => structuredClone(state),
    tick: () => { state = actions.tick(state); return structuredClone(state); },
    finishFocus: () => { state = actions.finish(state); return structuredClone(state); }
  };
  class BrowserWindow {
    loadFile() {}
    on() {}
    static getAllWindows() { return []; }
  }
  class Notification {
    static isSupported() { return true; }
    constructor(options) { this.options = options; }
    show() { notifications.push(this.options); }
  }
  const electron = {
    app: { whenReady: () => Promise.resolve(), getPath: () => '/tmp', on() {}, quit() {} },
    BrowserWindow, Notification, dialog: {},
    ipcMain: { handle: (name, handler) => handlers.set(name, handler) }
  };
  const source = fs.readFileSync(path.join(__dirname, '../src/main.js'), 'utf8');
  vm.runInNewContext(source, {
    require: name => name === 'electron' ? electron : name === './store' ? { createStore: () => store } : require(name),
    __dirname: path.join(__dirname, '../src'), process, console,
    setInterval: callback => { checkpoint = callback; }
  }, { filename: 'src/main.js' });
  await Promise.resolve();
  return { handlers, notifications, checkpoint };
}

test('automatic focus completion does not push an optional break notification', async () => {
  const running = { id: 'one', status: 'running', plannedMs: 60_000, activeMs: 59_000 };
  const harness = await appHarness({ activeSession: running, breakOffer: null }, {
    tick: state => state.activeSession
      ? { activeSession: null, breakOffer: { kind: 'short', minutes: 10 } }
      : state,
    finish: state => state
  });
  harness.checkpoint();
  harness.checkpoint();
  assert.equal(harness.notifications.length, 0);
});

test('finishing early does not push an optional break notification', async () => {
  const running = { id: 'two', status: 'running', plannedMs: 25 * 60_000, activeMs: 60_000 };
  const harness = await appHarness({ activeSession: running, breakOffer: null }, {
    tick: state => state,
    finish: () => ({ activeSession: null, breakOffer: { kind: 'short', minutes: 10 } })
  });
  await harness.handlers.get('focus:finish')();
  assert.equal(harness.notifications.length, 0);
});

test('warns once shortly before a break after a longer focus session', async () => {
  const running = { id: 'three', status: 'running', plannedMs: 25 * 60_000, activeMs: 25 * 60_000 - 61_000 };
  const harness = await appHarness({ activeSession: running, breakOffer: null }, {
    tick: state => ({ ...state, activeSession: { ...state.activeSession, activeMs: state.activeSession.activeMs + 2_000 } }),
    finish: state => state
  });
  harness.checkpoint();
  harness.checkpoint();
  assert.equal(harness.notifications.length, 1);
  assert.match(harness.notifications[0].body, /break/i);
});
