// Only the Electron main process loads this module; the browser never writes files.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const COLOURS = ['sage', 'blue', 'peach', 'lavender'];

function createStore(dataFile, { now = Date.now } = {}) {
  let state = fs.existsSync(dataFile)
    ? JSON.parse(fs.readFileSync(dataFile, 'utf8'))
    : { vaultPath: null, tasks: [], pendingEvents: [] };
  state.focusMinutes ??= 25;
  state.sessions ??= [];
  state.activeSession ??= null;
  state.breakMinutes ??= { short: 10, long: 30 };
  state.breakOffer ??= null;
  state.activeBreak ??= null;
  if (state.activeBreak?.status === 'running') {
    state.activeBreak.status = 'paused';
    state.activeBreak.segmentStartedAt = null;
    save();
  }
  // After a crash, the last saved active checkpoint is trusted; time while closed is not.
  if (state.activeSession && ['running', 'paused'].includes(state.activeSession.status)) {
    state.activeSession.status = 'interrupted';
    state.activeSession.segmentStartedAt = null;
    save();
  }

  function save() {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    const temporary = `${dataFile}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporary, JSON.stringify(state, null, 2));
      fs.renameSync(temporary, dataFile); // Replace the whole JSON file, not half of it.
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }

  function isVault(folder) {
    return fs.existsSync(path.join(folder, '.obsidian')) &&
      fs.statSync(path.join(folder, '.obsidian')).isDirectory();
  }

  function getState() {
    return structuredClone(state);
  }

  function selectVault(folder) {
    if (state.pendingEvents.length) throw new Error('Retry pending events for the original vault before switching.');
    if (state.activeSession) throw new Error('Finish or cancel the active focus session before switching vaults.');
    if (typeof folder !== 'string' || !path.isAbsolute(folder) || !isVault(folder)) {
      throw new Error('Select an existing Obsidian vault folder (containing .obsidian).');
    }
    state.vaultPath = folder;
    save();
    return getState();
  }

  function retryPending() {
    for (const event of [...state.pendingEvents]) {
      try {
        // Never recreate a missing vault at its old location.
        if (!isVault(event.vaultPath)) throw new Error('Vault unavailable');
        const dir = path.join(event.vaultPath, 'FocusDesk', event.kind || 'tasks');
        fs.mkdirSync(dir, { recursive: true });
        const filename = path.join(dir, `${event.id}.md`);
        try {
          fs.writeFileSync(filename, event.markdown, { flag: 'wx' });
        } catch (error) {
          // A crash after writing but before clearing the queue is safe to retry.
          if (error.code !== 'EEXIST' || fs.readFileSync(filename, 'utf8') !== event.markdown) throw error;
        }
        state.pendingEvents = state.pendingEvents.filter(item => item.id !== event.id);
        save();
      } catch {
        // Keep the exact event (and its original vault) for a later retry.
      }
    }
    return getState();
  }

  function recordEvent(kind, type, status, details, vaultPath = state.vaultPath) {
    const instant = new Date(now());
    const date = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
    const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(instant);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = -instant.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const numericOffset = `${sign}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')}:${String(Math.abs(offset) % 60).padStart(2, '0')}`;
    const id = randomUUID();
    const markdown = `# FocusDesk ${kind === 'focus' ? 'focus' : 'task'} event\n\n- Event ID: ${id}\n- Date: ${date}\n- Time: ${time}\n- Timezone: ${timezone} (UTC${numericOffset})\n- Event type: ${type}\n- Status: ${status}\n${details}`;
    state.pendingEvents.push({ id, kind, vaultPath, markdown });
    save(); // Task and its pending log become durable together, before attempting vault I/O.
    retryPending();
  }

  function eventFor(task, type, previous) {
    const before = previous ? `- Previous title: ${previous.title}\n- Previous colour: ${previous.colour || 'sage'}\n` : '';
    recordEvent('tasks', type, task.status, `- Task ID: ${task.id}\n${before}- Title: ${task.title}\n- Colour: ${task.colour || 'sage'}\n- Description: ${task.description || ''}\n- Suggested focus minutes: ${task.focusMinutes ?? 25}\n- Suggested break minutes: ${task.breakMinutes ?? 10}\n`);
  }

  function validTitle(title) {
    if (typeof title !== 'string' || !title.trim()) throw new Error('Enter a task title.');
    const cleaned = title.trim().replace(/\s+/g, ' ');
    if (cleaned.length > 200) throw new Error('Task title must be 200 characters or fewer.');
    return cleaned;
  }

  function validMinutes(value, label) {
    if (!Number.isInteger(value) || value < 1 || value > 180) throw new Error(`${label} must be 1 to 180 whole minutes.`);
    return value;
  }

  function taskDetails(details = {}, previous = {}) {
    const description = details.description ?? previous.description ?? '';
    if (typeof description !== 'string' || description.length > 500) throw new Error('Description must be 500 characters or fewer.');
    return {
      description: description.trim(),
      focusMinutes: validMinutes(details.focusMinutes ?? previous.focusMinutes ?? 25, 'Suggested focus length'),
      breakMinutes: validMinutes(details.breakMinutes ?? previous.breakMinutes ?? 10, 'Suggested break length')
    };
  }

  function change(operation) {
    const before = getState();
    try {
      return operation();
    } catch (error) {
      // If the local JSON write fails, don't leave an uncommitted task/event in memory.
      state = before;
      throw error;
    }
  }

  function createTask(title, details) {
    if (!state.vaultPath) throw new Error('Select an Obsidian vault first.');
    const cleaned = validTitle(title);
    const options = details === undefined ? null : taskDetails(details);
    return change(() => {
      const task = { id: randomUUID(), title: cleaned, colour: 'sage', status: 'open', ...(options || {}) };
      state.tasks.push(task);
      eventFor(task, 'task-created');
      return task;
    });
  }

  function editTask(id, title, colour, details) {
    const task = state.tasks.find(item => item.id === id);
    if (!task) throw new Error('Task not found.');
    const nextTitle = validTitle(title);
    if (!COLOURS.includes(colour)) throw new Error('Choose a valid task colour.');
    const options = details === undefined ? null : taskDetails(details, task);
    if (task.title === nextTitle && (task.colour || 'sage') === colour &&
      (!options || (task.description || '') === options.description && (task.focusMinutes ?? 25) === options.focusMinutes && (task.breakMinutes ?? 10) === options.breakMinutes)) return structuredClone(task);
    const previous = { ...task };
    return change(() => {
      task.title = nextTitle;
      task.colour = colour;
      if (options) Object.assign(task, options);
      eventFor(task, 'task-edited', previous);
      return structuredClone(task);
    });
  }

  function setTaskStatus(id, from, to, type) {
    const task = state.tasks.find(item => item.id === id);
    if (!task) throw new Error('Task not found.');
    if (task.status !== from) throw new Error(`Task is already ${to}.`);
    return change(() => {
      task.status = to;
      eventFor(task, type);
      return structuredClone(task);
    });
  }

  function completeTask(id) {
    return setTaskStatus(id, 'open', 'completed', 'task-completed');
  }

  function reopenTask(id) {
    return setTaskStatus(id, 'completed', 'open', 'task-reopened');
  }

  function deleteTask(id) {
    const index = state.tasks.findIndex(item => item.id === id);
    if (index < 0) throw new Error('Task not found.');
    change(() => {
      const [task] = state.tasks.splice(index, 1);
      eventFor({ ...task, status: 'deleted' }, 'task-deleted');
    });
  }

  function focusDetails(session, actual = null) {
    const link = session.taskId
      ? `- Task ID: ${session.taskId}\n- Task title: ${session.taskTitle}\n`
      : `- Activity: ${session.description}\n`;
    return `- Session ID: ${session.id}\n${link}- Planned minutes: ${session.plannedMs / 60_000}\n${actual === null ? '' : `- Actual active duration: ${actual} ms\n`}`;
  }

  function startFocus({ taskId = null, description = '', minutes, breakMinutes } = {}) {
    if (!state.vaultPath) throw new Error('Select an Obsidian vault first.');
    if (state.activeSession) throw new Error('A focus session is already active.');
    if (state.activeBreak) throw new Error('Finish or stop the break before starting focus.');
    if (taskId && description.trim()) throw new Error('Select either a task or a description.');
    if (!taskId && (typeof description !== 'string' || !description.trim())) throw new Error('Select a task or description.');
    const task = taskId && state.tasks.find(item => item.id === taskId);
    if (taskId && !task) throw new Error('Task not found.');
    const activity = task ? null : validTitle(description);
    const plan = validMinutes(minutes ?? task?.focusMinutes ?? state.focusMinutes, 'Focus length');
    const breakLength = breakMinutes === undefined ? (task?.breakMinutes ?? null) : validMinutes(breakMinutes, 'Break length');
    return change(() => {
      const session = {
        id: randomUUID(), taskId: task ? task.id : null, taskTitle: task ? task.title : null,
        description: activity, vaultPath: state.vaultPath, status: 'running',
        startedAt: new Date(now()).toISOString(), activeMs: 0, segmentStartedAt: now(),
        plannedMs: plan * 60_000, configuredMinutes: plan, breakMinutes: breakLength, extended: false
      };
      state.breakOffer = null;
      state.activeSession = session;
      recordEvent('focus', 'focus-start', 'running', focusDetails(session), session.vaultPath);
      return structuredClone(session);
    });
  }

  function stopFocus() {
    if (!state.activeSession) throw new Error('No active focus session.');
    if (state.activeSession.status === 'running') {
      tick();
      if (!state.activeSession) throw new Error('Focus session already completed at zero.');
    }
    return change(() => {
      const session = state.activeSession;
      if (session.status === 'running') session.activeMs += Math.min(session.plannedMs - session.activeMs, Math.max(0, now() - session.segmentStartedAt));
      state.activeSession = null;
      recordEvent('focus', 'focus-cancelled', 'cancelled', focusDetails(session, Math.round(session.activeMs)), session.vaultPath);
    });
  }

  function activeFocus() {
    if (!state.activeSession) throw new Error('No active focus session.');
    return state.activeSession;
  }

  function accrue(session) {
    if (session.status !== 'running') return;
    const current = now();
    session.activeMs = Math.min(session.plannedMs, session.activeMs + Math.max(0, current - session.segmentStartedAt));
    session.segmentStartedAt = current;
  }

  function pauseFocus() {
    if (activeFocus().status !== 'running') throw new Error('Focus is not running.');
    return change(() => {
      accrue(state.activeSession);
      state.activeSession.status = 'paused';
      save();
      return getState().activeSession;
    });
  }

  function resumeFocus() {
    if (!['paused', 'interrupted'].includes(activeFocus().status)) throw new Error('Focus is not paused or interrupted.');
    return change(() => {
      state.activeSession.status = 'running';
      state.activeSession.segmentStartedAt = now();
      save();
      return getState().activeSession;
    });
  }

  function finishFocus() {
    if (activeFocus().status === 'interrupted') throw new Error('Resume or cancel the interrupted session first.');
    return change(() => {
      const session = state.activeSession;
      accrue(session);
      const finished = { ...session, status: 'completed', actualMs: Math.round(session.activeMs), completedAt: new Date(now()).toISOString() };
      delete finished.segmentStartedAt;
      state.sessions.push(finished);
      state.activeSession = null;
      const kind = (session.configuredMinutes ?? session.plannedMs / 60_000) <= 25 ? 'short' : 'long';
      state.breakOffer = { kind, minutes: session.breakMinutes ?? state.breakMinutes[kind] };
      recordEvent('focus', 'focus-completed', 'completed', focusDetails(finished, finished.actualMs), finished.vaultPath);
      return structuredClone(finished);
    });
  }

  function tick() {
    if (state.activeBreak?.status === 'running') change(() => {
      settleBreak();
      if (state.activeBreak.remainingMs === 0) state.activeBreak = null;
      save();
    });
    if (state.activeSession?.status !== 'running') return getState();
    change(() => {
      accrue(state.activeSession);
      save();
    });
    if (state.activeSession.activeMs >= state.activeSession.plannedMs) finishFocus();
    return getState();
  }

  function interruptFocus() {
    if (state.activeBreak?.status === 'running') change(() => {
      settleBreak();
      state.activeBreak.status = 'paused';
      state.activeBreak.segmentStartedAt = null;
      save();
    });
    if (!state.activeSession || state.activeSession.status === 'interrupted') return getState();
    return change(() => {
      accrue(state.activeSession);
      state.activeSession.status = 'interrupted';
      state.activeSession.segmentStartedAt = null;
      save();
      return getState();
    });
  }

  function setFocusMinutes(minutes) {
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) throw new Error('Focus length must be 1 to 180 whole minutes.');
    return change(() => {
      state.focusMinutes = minutes;
      save();
      return minutes;
    });
  }

  function extendFocus() {
    activeFocus();
    tick();
    if (!state.activeSession) throw new Error('Focus session already completed.');
    if (state.activeSession.extended) throw new Error('Focus session already extended.');
    return change(() => {
      state.activeSession.plannedMs += 5 * 60_000;
      state.activeSession.extended = true;
      save();
      return getState().activeSession;
    });
  }

  function setBreakMinutes(short, long) {
    if (![short, long].every(value => Number.isInteger(value) && value >= 1 && value <= 180)) {
      throw new Error('Break lengths must be 1 to 180 whole minutes.');
    }
    return change(() => {
      state.breakMinutes = { short, long };
      save();
      return getState().breakMinutes;
    });
  }

  function settleBreak() {
    const current = now();
    state.activeBreak.remainingMs = Math.max(0, state.activeBreak.remainingMs - Math.max(0, current - state.activeBreak.segmentStartedAt));
    state.activeBreak.segmentStartedAt = current;
  }

  function startBreak() {
    if (!state.breakOffer || state.activeSession || state.activeBreak) throw new Error('No break is available to start.');
    return change(() => {
      const { kind, minutes } = state.breakOffer;
      state.activeBreak = { kind, plannedMs: minutes * 60_000, remainingMs: minutes * 60_000, status: 'running', segmentStartedAt: now() };
      state.breakOffer = null;
      save();
      return getState().activeBreak;
    });
  }

  function resumeBreak() {
    if (state.activeBreak?.status !== 'paused') throw new Error('No paused break to resume.');
    return change(() => {
      state.activeBreak.status = 'running';
      state.activeBreak.segmentStartedAt = now();
      save();
      return getState().activeBreak;
    });
  }

  function finishBreak() {
    if (!state.activeBreak) throw new Error('No active break.');
    return change(() => { state.activeBreak = null; save(); });
  }

  function stopBreak() { return finishBreak(); }

  return { getState, selectVault, createTask, editTask, completeTask, reopenTask, deleteTask, retryPending, startFocus, stopFocus, pauseFocus, resumeFocus, finishFocus, tick, interruptFocus, setFocusMinutes, extendFocus, setBreakMinutes, startBreak, resumeBreak, finishBreak, stopBreak };
}

module.exports = { createStore };
