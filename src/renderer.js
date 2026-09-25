const vaultLabel = document.querySelector('#vault-label');
const pending = document.querySelector('#pending');
const retry = document.querySelector('#retry');
const list = document.querySelector('#tasks');
const message = document.querySelector('#message');
const form = document.querySelector('#task-form');

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
    item.textContent = task.title; // textContent displays titles without interpreting HTML.
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
