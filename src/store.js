// Only the Electron main process loads this module; the browser never writes files.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const COLOURS = ['sage', 'blue', 'peach', 'lavender'];

function createStore(dataFile) {
  let state = fs.existsSync(dataFile)
    ? JSON.parse(fs.readFileSync(dataFile, 'utf8'))
    : { vaultPath: null, tasks: [], pendingEvents: [] };

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
        const dir = path.join(event.vaultPath, 'FocusDesk', 'tasks');
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

  function eventFor(task, type, previous) {
    const now = new Date();
    const date = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = -now.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const numericOffset = `${sign}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')}:${String(Math.abs(offset) % 60).padStart(2, '0')}`;
    const id = randomUUID();
    const before = previous ? `- Previous title: ${previous.title}\n- Previous colour: ${previous.colour || 'sage'}\n` : '';
    const markdown = `# FocusDesk task event\n\n- Event ID: ${id}\n- Date: ${date}\n- Time: ${time}\n- Timezone: ${timezone} (UTC${numericOffset})\n- Event type: ${type}\n- Status: ${task.status}\n- Task ID: ${task.id}\n${before}- Title: ${task.title}\n- Colour: ${task.colour || 'sage'}\n`;
    state.pendingEvents.push({ id, vaultPath: state.vaultPath, markdown });
    save(); // Task and its pending log become durable together, before attempting vault I/O.
    retryPending();
  }

  function validTitle(title) {
    if (typeof title !== 'string' || !title.trim()) throw new Error('Enter a task title.');
    const cleaned = title.trim().replace(/\s+/g, ' ');
    if (cleaned.length > 200) throw new Error('Task title must be 200 characters or fewer.');
    return cleaned;
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

  function createTask(title) {
    if (!state.vaultPath) throw new Error('Select an Obsidian vault first.');
    const cleaned = validTitle(title);
    return change(() => {
      const task = { id: randomUUID(), title: cleaned, colour: 'sage', status: 'open' };
      state.tasks.push(task);
      eventFor(task, 'task-created');
      return task;
    });
  }

  function editTask(id, title, colour) {
    const task = state.tasks.find(item => item.id === id);
    if (!task) throw new Error('Task not found.');
    const nextTitle = validTitle(title);
    if (!COLOURS.includes(colour)) throw new Error('Choose a valid task colour.');
    if (task.title === nextTitle && (task.colour || 'sage') === colour) return structuredClone(task);
    const previous = { ...task };
    return change(() => {
      task.title = nextTitle;
      task.colour = colour;
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

  return { getState, selectVault, createTask, editTask, completeTask, reopenTask, deleteTask, retryPending };
}

module.exports = { createStore };
