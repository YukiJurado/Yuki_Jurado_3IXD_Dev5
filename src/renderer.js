const vaultLabel = document.querySelector('#vault-label');
const pending = document.querySelector('#pending');
const retry = document.querySelector('#retry');
const list = document.querySelector('#task-list');
const message = document.querySelector('#message');
const form = document.querySelector('#task-form');

function showPage() {
  const page = ['tasks', 'timer', 'stats'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'tasks';
  for (const section of document.querySelectorAll('.page')) section.hidden = section.id !== page;
  for (const link of document.querySelectorAll('[data-page-link]')) {
    if (link.dataset.pageLink === page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', showPage);
showPage();

function detailsFrom(description, focus, breakInput) {
  return { description: description.value, focusMinutes: Number(focus.value), breakMinutes: Number(breakInput.value) };
}

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
  const descriptionLabel = document.createElement('label');
  descriptionLabel.textContent = 'Description (optional)';
  const description = document.createElement('textarea');
  description.maxLength = 500;
  description.value = task.description || '';
  descriptionLabel.append(description);
  const focusLabel = document.createElement('label');
  focusLabel.textContent = 'Suggested focus minutes';
  const focus = document.createElement('input');
  focus.type = 'number'; focus.min = '1'; focus.max = '180'; focus.required = true;
  focus.value = task.focusMinutes ?? 25;
  focusLabel.append(focus);
  const breakLabel = document.createElement('label');
  breakLabel.textContent = 'Suggested break minutes';
  const breakInput = document.createElement('input');
  breakInput.type = 'number'; breakInput.min = '1'; breakInput.max = '180'; breakInput.required = true;
  breakInput.value = task.breakMinutes ?? 10;
  breakLabel.append(breakInput);
  const save = document.createElement('button');
  save.type = 'submit';
  save.textContent = 'Save changes';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => refresh().catch(error => { message.textContent = error.message; }));
  editor.append(titleLabel, colourLabel, descriptionLabel, focusLabel, breakLabel, save, cancel);
  editor.addEventListener('submit', async event => {
    event.preventDefault();
    save.disabled = true;
    try {
      await window.focusDesk.editTask(task.id, title.value, colour.value, detailsFrom(description, focus, breakInput));
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
    if (task.description) {
      const description = document.createElement('p');
      description.textContent = task.description;
      info.append(description);
    }
    const suggestions = document.createElement('span');
    suggestions.textContent = `${task.focusMinutes ?? 25} min focus · ${task.breakMinutes ?? 10} min break`;
    info.append(suggestions);
    const actions = document.createElement('div');
    actions.className = 'task-actions';
    actions.append(
      actionButton('Focus', () => {
        document.querySelector('#focus-task').value = task.id;
        document.querySelector('#focus-description').value = '';
        applySelection();
        updateStartAvailability();
        location.hash = 'timer';
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
    await window.focusDesk.createTask(form.elements.title.value, detailsFrom(
      document.querySelector('#task-description'), document.querySelector('#task-focus'), document.querySelector('#task-break')
    ));
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
let reportPeriod = 'day';
let reportSignature = '';

function applySelection() {
  const task = latestState?.tasks.find(item => item.id === focusTask.value);
  const focus = document.querySelector('#focus-minutes');
  const breakInput = document.querySelector('#session-break-minutes');
  focus.value = task?.focusMinutes ?? latestState?.focusMinutes ?? 25;
  breakInput.value = task?.breakMinutes ?? latestState?.breakMinutes[(Number(focus.value) <= 25) ? 'short' : 'long'] ?? 10;
}

function formatFocusTime(ms) {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1).replace(/\.0$/, '')} sec`;
  const minutes = ms / 60_000;
  if (minutes >= 60) {
    const rounded = Math.round(minutes);
    return `${Math.floor(rounded / 60)} hr ${rounded % 60} min`;
  }
  return `${(Math.round(minutes * 10) / 10).toFixed(1).replace(/\.0$/, '')} min`;
}

function renderReport(state) {
  const today = new Date();
  const signature = JSON.stringify([reportPeriod, today.toDateString(), state.sessions, state.tasks.map(task => [task.id, task.title, task.colour])]);
  if (signature === reportSignature) return;
  reportSignature = signature;
  const { start, end, bars, totalMs } = window.FocusDeskReport.buildReport(state.sessions, state.tasks, reportPeriod, today);
  const date = value => value.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const lastDay = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
  document.querySelector('#report-range').textContent = reportPeriod === 'day' ? date(start) : `${date(start)} – ${date(lastDay)}`;
  document.querySelector('#report-total').textContent = `Total focus: ${formatFocusTime(totalMs)}`;
  const list = document.querySelector('#report-bars');
  list.replaceChildren();
  if (!bars.length) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'No completed focus time in this period yet.';
    list.append(empty);
  }
  const maximum = Math.max(...bars.map(bar => bar.actualMs), 1);
  for (const bar of bars) {
    const row = document.createElement('li');
    row.className = 'report-row';
    const label = document.createElement('span');
    label.textContent = bar.label;
    const time = document.createElement('strong');
    time.textContent = formatFocusTime(bar.actualMs);
    const graphic = document.createElement('progress');
    graphic.className = `report-bar colour-${['sage', 'blue', 'peach', 'lavender'].includes(bar.colour) ? bar.colour : 'other'}`;
    graphic.max = maximum;
    graphic.value = bar.actualMs;
    graphic.setAttribute('aria-label', `${bar.label}: ${time.textContent}`);
    row.append(label, time, graphic);
    list.append(row);
  }
}

for (const button of document.querySelectorAll('[data-report-period]')) button.addEventListener('click', () => {
  reportPeriod = button.dataset.reportPeriod;
  for (const choice of document.querySelectorAll('[data-report-period]')) choice.setAttribute('aria-pressed', String(choice === button));
  reportSignature = '';
  if (latestState) renderReport(latestState);
});

function updateStartAvailability() {
  document.querySelector('#focus-start').disabled = !latestState?.vaultPath || !!latestState.activeSession || !!latestState.activeBreak ||
    !(focusTask.value || focusDescription.value.trim());
}

function formatClock(ms) {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function renderFocus(state, updateTasks = false) {
  const previousTask = focusTask.value;
  const previousFocus = document.querySelector('#focus-minutes').value;
  const previousBreak = document.querySelector('#session-break-minutes').value;
  latestState = state;
  renderReport(state);
  if (updateTasks) {
    const selected = focusTask.value;
    focusTask.replaceChildren(new Option('No task — use a description instead', ''));
    for (const task of state.tasks) focusTask.add(new Option(task.title, task.id));
    focusTask.value = state.tasks.some(task => task.id === selected) ? selected : '';
  }
  if (focusTask.value !== previousTask || !previousFocus || !previousBreak) applySelection();
  const session = state.activeSession;
  const reminder = document.querySelector('#break-reminder');
  const reminderText = document.querySelector('#break-reminder-text');
  let breakReminder = '';
  if (state.breakOffer && !state.activeBreak) {
    breakReminder = `Focus complete. Your ${state.breakOffer.minutes}-minute break is ready when you are.`;
  } else if (session?.status === 'running') {
    const elapsed = Math.max(0, Date.now() - session.segmentStartedAt);
    const remaining = session.plannedMs - session.activeMs - elapsed;
    const threshold = Math.min(60_000, Math.max(10_000, session.plannedMs / 10));
    if (remaining > 0 && remaining <= threshold) breakReminder = 'Your break is coming soon.';
  }
  reminder.hidden = !breakReminder;
  if (reminderText.textContent !== breakReminder) reminderText.textContent = breakReminder;
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
  const shortInput = document.querySelector('#short-break');
  const longInput = document.querySelector('#long-break');
  if (document.activeElement !== shortInput) shortInput.value = state.breakMinutes.short;
  if (document.activeElement !== longInput) longInput.value = state.breakMinutes.long;
  document.querySelector('#break-offer').hidden = !state.breakOffer || !!state.activeBreak;
  document.querySelector('#break-active').hidden = !state.activeBreak;
  if (state.breakOffer) document.querySelector('#break-offer-label').textContent =
    `Optional ${state.breakOffer.kind} break: ${state.breakOffer.minutes} minutes`;
  if (state.activeBreak) {
    const current = state.activeBreak;
    document.querySelector('#break-label').textContent = `${current.kind} break${current.status === 'paused' ? ' — paused after closing the app' : ''}`;
    const elapsed = current.status === 'running' ? Math.max(0, Date.now() - current.segmentStartedAt) : 0;
    document.querySelector('#break-clock').textContent = formatClock(current.remainingMs - elapsed);
    document.querySelector('#break-resume').hidden = current.status !== 'paused';
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
  applySelection();
  updateStartAvailability();
});
focusDescription.addEventListener('input', () => {
  if (focusDescription.value.trim()) { focusTask.value = ''; applySelection(); }
  updateStartAvailability();
});
document.querySelector('#focus-settings').addEventListener('submit', event => event.preventDefault());
document.querySelector('#focus-start').addEventListener('click', () => {
  if (!document.querySelector('#focus-settings').reportValidity()) return;
  const taskId = focusTask.value || null;
  const description = taskId ? '' : focusDescription.value;
  const minutes = Number(document.querySelector('#focus-minutes').value);
  const breakMinutes = Number(document.querySelector('#session-break-minutes').value);
  focusAction(() => window.focusDesk.startFocus({ taskId, description, minutes, breakMinutes }), 'Focus started.');
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

async function breakAction(action, success) {
  try {
    await action();
    document.querySelector('#break-message').textContent = success;
    await refresh();
  } catch (error) {
    document.querySelector('#break-message').textContent = error.message;
  }
}
document.querySelector('#break-settings').addEventListener('submit', event => {
  event.preventDefault();
  breakAction(() => window.focusDesk.setBreakMinutes(
    Number(document.querySelector('#short-break').value), Number(document.querySelector('#long-break').value)
  ), 'Break lengths saved.');
});
document.querySelector('#break-start').addEventListener('click', () => breakAction(() => window.focusDesk.startBreak(), 'Break started.'));
document.querySelector('#break-resume').addEventListener('click', () => breakAction(() => window.focusDesk.resumeBreak(), 'Break resumed.'));
document.querySelector('#break-finish').addEventListener('click', () => breakAction(() => window.focusDesk.finishBreak(), 'Break finished.'));
document.querySelector('#break-stop').addEventListener('click', () => breakAction(() => window.focusDesk.stopBreak(), 'Break stopped.'));
setInterval(() => refreshFocus().catch(error => { focusMessage.textContent = error.message; }), 500);
