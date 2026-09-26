const vaultLabel = document.querySelector('#vault-label');
const pending = document.querySelector('#pending');
const retry = document.querySelector('#retry');
const list = document.querySelector('#tasks');
const message = document.querySelector('#message');
const form = document.querySelector('#task-form');

function actionButton(label, action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const result = await action();
      if (result) {
        message.textContent = result;
        await refresh();
      }
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  return button;
}

function showEditor(item, task) {
  const editor = document.createElement('form');
  editor.className = 'edit-form';
  const titleLabel = document.createElement('label');
  titleLabel.textContent = 'Title';
  const title = document.createElement('input');
  title.name = 'title';
  title.required = true;
  title.maxLength = 200;
  title.value = task.title;
  titleLabel.append(title);
  const colourLabel = document.createElement('label');
  colourLabel.textContent = 'Colour';
  const colour = document.createElement('select');
  colour.name = 'colour';
  for (const value of ['sage', 'blue', 'peach', 'lavender']) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value[0].toUpperCase() + value.slice(1);
    colour.append(option);
  }
  colour.value = task.colour || 'sage';
  colourLabel.append(colour);
  const save = document.createElement('button');
  save.type = 'submit';
  save.textContent = 'Save changes';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => refresh().catch(error => { message.textContent = error.message; }));
  editor.append(titleLabel, colourLabel, save, cancel);
  editor.addEventListener('submit', async event => {
    event.preventDefault();
    save.disabled = true;
    try {
      await window.focusDesk.editTask(task.id, title.value, colour.value);
      message.textContent = 'Changes saved locally. Check vault status for logging.';
      await refresh();
    } catch (error) {
      message.textContent = error.message;
      save.disabled = false;
    }
  });
  item.replaceChildren(editor);
  title.focus();
}

async function refresh() {
  const state = await window.focusDesk.getState();
  vaultLabel.textContent = state.vaultPath || 'No vault selected. Select an existing Obsidian vault to begin.';
  const count = state.pendingEvents.length;
  pending.hidden = retry.hidden = count === 0;
  pending.textContent = count ? `${count} event(s) pending: task saved locally, but vault logging failed. Restore the original vault and retry.` : '';
  document.querySelector('#add-task').disabled = !state.vaultPath;
  list.replaceChildren();
  for (const task of state.tasks) {
    const item = document.createElement('li');
    item.dataset.taskId = task.id;
    item.className = `task-card colour-${task.colour || 'sage'}${task.status === 'completed' ? ' completed' : ''}`;
    const info = document.createElement('div');
    info.className = 'task-info';
    const title = document.createElement('strong');
    title.textContent = task.title; // Never interpret a user's title as HTML.
    const status = document.createElement('span');
    status.textContent = task.status === 'completed' ? 'Completed' : 'Open';
    info.append(title, status);
    const actions = document.createElement('div');
    actions.className = 'task-actions';
    actions.append(
      actionButton('Focus', () => {
        document.querySelector('#focus-task').value = task.id;
        document.querySelector('#focus-description').value = '';
        updateStartAvailability();
        document.querySelector('#focus').scrollIntoView({ behavior: 'smooth' });
      }),
      actionButton('Edit', () => showEditor(item, task)),
      actionButton(task.status === 'completed' ? 'Reopen' : 'Complete', async () => {
        await (task.status === 'completed' ? window.focusDesk.reopenTask(task.id) : window.focusDesk.completeTask(task.id));
        return task.status === 'completed' ? 'Task reopened.' : 'Task complete!';
      }),
      actionButton('Delete', async () => {
        if (!window.confirm(`Delete “${task.title}”? The task will be removed, but its vault events will remain.`)) return null;
        await window.focusDesk.deleteTask(task.id);
        return 'Task deleted locally. Check vault status for logging.';
      })
    );
    item.append(info, actions);
    list.append(item);
  }
  if (!state.tasks.length) {
    const item = document.createElement('li');
    item.className = 'empty';
    item.textContent = 'No tasks yet. Add one above.';
    list.append(item);
  }
  renderFocus(state, true);
}

document.querySelector('#choose-vault').addEventListener('click', async () => {
  try {
    await window.focusDesk.chooseVault();
    message.textContent = '';
  } catch (error) {
    message.textContent = error.message;
  }
  await refresh();
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await window.focusDesk.createTask(form.elements.title.value);
    form.reset();
    message.textContent = 'Task saved locally. Check the vault status above for logging.';
  } catch (error) {
    message.textContent = error.message;
  }
  await refresh();
});

retry.addEventListener('click', async () => {
  try {
    await window.focusDesk.retryPending();
    message.textContent = 'Retry finished. Check the vault status above.';
  } catch (error) {
    message.textContent = error.message;
  }
  await refresh();
});

refresh().catch(error => { message.textContent = error.message; });

const focusTask = document.querySelector('#focus-task');
const focusDescription = document.querySelector('#focus-description');
const focusMessage = document.querySelector('#focus-message');
let latestState = null;
let focusBusy = false;

function updateStartAvailability() {
  document.querySelector('#focus-start').disabled = !latestState?.vaultPath || !!latestState.activeSession ||
    !(focusTask.value || focusDescription.value.trim());
}

function formatClock(ms) {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function renderFocus(state, updateTasks = false) {
  latestState = state;
  if (updateTasks) {
    const selected = focusTask.value;
    focusTask.replaceChildren(new Option('No task — use a description instead', ''));
    for (const task of state.tasks) focusTask.add(new Option(task.title, task.id));
    focusTask.value = state.tasks.some(task => task.id === selected) ? selected : '';
  }
  const minutes = document.querySelector('#focus-minutes');
  if (document.activeElement !== minutes) minutes.value = state.focusMinutes;
  const session = state.activeSession;
  document.querySelector('#focus-setup').hidden = !!session;
  document.querySelector('#focus-active').hidden = !session;
  updateStartAvailability();
  if (session) {
    document.querySelector('#focus-label').textContent = session.taskTitle || session.description;
    const elapsed = session.status === 'running' ? Math.max(0, Date.now() - session.segmentStartedAt) : 0;
    document.querySelector('#focus-clock').textContent = formatClock(session.plannedMs - session.activeMs - elapsed);
    document.querySelector('#focus-status').textContent = session.status === 'interrupted'
      ? 'Interrupted while the app was closed. Resume or Cancel; closed time is not counted.'
      : session.status === 'paused' ? 'Paused — this time is not counted.' : 'Focusing';
    document.querySelector('#focus-pause').hidden = session.status !== 'running';
    document.querySelector('#focus-resume').hidden = session.status === 'running';
    document.querySelector('#focus-finish').hidden = session.status === 'interrupted';
    document.querySelector('#focus-extend').hidden = session.status === 'interrupted' || session.extended;
    document.querySelector('#focus-stop').textContent = session.status === 'interrupted' ? 'Cancel interrupted session' : 'Stop / Cancel';
  }
  const history = document.querySelector('#focus-history');
  history.replaceChildren();
  for (const completed of [...state.sessions].reverse()) {
    const item = document.createElement('li');
    const label = completed.taskTitle || completed.description;
    const duration = (completed.actualMs / 1000).toFixed(1);
    item.textContent = `${label} — ${duration} seconds active — ${new Date(completed.completedAt).toLocaleString()}`;
    history.append(item);
  }
  if (!state.sessions.length) {
    const item = document.createElement('li');
    item.className = 'empty';
    item.textContent = 'No completed focus sessions yet.';
    history.append(item);
  }
  const count = state.pendingEvents.length;
  pending.hidden = retry.hidden = count === 0;
  pending.textContent = count ? `${count} event(s) pending: saved locally but vault logging failed. Restore the original vault and retry.` : '';
}

async function refreshFocus() {
  if (focusBusy) return;
  renderFocus(await window.focusDesk.getState());
}

async function focusAction(action, success) {
  if (focusBusy) return;
  focusBusy = true;
  try {
    await action();
    focusMessage.textContent = success;
  } catch (error) {
    focusMessage.textContent = error.message;
  } finally {
    focusBusy = false;
    await refresh();
  }
}

focusTask.addEventListener('change', () => {
  if (focusTask.value) focusDescription.value = '';
  updateStartAvailability();
});
focusDescription.addEventListener('input', () => {
  if (focusDescription.value.trim()) focusTask.value = '';
  updateStartAvailability();
});
document.querySelector('#focus-settings').addEventListener('submit', event => {
  event.preventDefault();
  focusAction(() => window.focusDesk.setFocusMinutes(Number(document.querySelector('#focus-minutes').value)), 'Focus length saved for the next session.');
});
document.querySelector('#focus-start').addEventListener('click', () => {
  const taskId = focusTask.value || null;
  const description = taskId ? '' : focusDescription.value;
  focusAction(() => window.focusDesk.startFocus({ taskId, description }), 'Focus started.');
});
document.querySelector('#focus-pause').addEventListener('click', () => focusAction(() => window.focusDesk.pauseFocus(), 'Focus paused.'));
document.querySelector('#focus-resume').addEventListener('click', () => focusAction(() => window.focusDesk.resumeFocus(), 'Focus resumed.'));
document.querySelector('#focus-extend').addEventListener('click', () => focusAction(() => window.focusDesk.extendFocus(), 'Added five minutes.'));
document.querySelector('#focus-finish').addEventListener('click', () => focusAction(() => window.focusDesk.finishFocus(), 'Focus completed; the task stays open.'));
document.querySelector('#focus-stop').addEventListener('click', () => {
  if (window.confirm('Stop and cancel this focus session? Partial time will not count in completed history.')) {
    focusAction(() => window.focusDesk.stopFocus(), 'Focus cancelled; partial time was not added to history.');
  }
});
setInterval(() => refreshFocus().catch(error => { focusMessage.textContent = error.message; }), 500);
