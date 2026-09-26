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
