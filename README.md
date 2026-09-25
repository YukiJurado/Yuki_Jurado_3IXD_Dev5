# FocusDesk — first working slice

An offline Electron desktop app for student tasks and focus work. **Current stage:** choose an existing Obsidian vault, add/view tasks, save tasks locally, and write a task-created Markdown event. The focus timer, breaks, task edit/complete/reopen/delete, and report are **not implemented yet**. See [PRD](docs/PRD.md) for the full assignment scope.

## Run in VS Code

1. Install Node.js and npm. Open this repository folder in VS Code (**File → Open Folder**).
2. Open **Terminal → New Terminal**. Run `npm ci` to install the Electron dependency (requires internet the first time; running afterward needs no internet).
3. Run `npm start`. The FocusDesk window opens. Stop it with Ctrl+C in the terminal (on macOS, closing the window may leave the app running; use **Electron → Quit Electron** or Ctrl+C).
4. Click **Choose vault folder** and select the **root of an existing Obsidian vault**—the folder that contains `.obsidian`. If you have none, create one in Obsidian first. FocusDesk writes under `<vault>/FocusDesk/tasks/`; it does not modify existing notes.
5. Enter a title and click **Add task**. Your tasks live in Electron's app-data `state.json` (not in this repository); Markdown events live in the selected vault.

Run `npm test` for the storage checks. No account or cloud service is required while running.

## Short manual test

- Choose your vault; add `Read chapter 3`. Confirm it appears in the window.
- In Obsidian or Finder, open `FocusDesk/tasks/` inside that vault: check the new `.md` file has an event ID, date, time, timezone, type `task-created`, status `open`, task ID, and title.
- Quit and run `npm start` again; confirm the task and selected vault remain.
- For a failure test, **rename** the vault folder temporarily, add another task, and check the pending warning. Restore the folder's original name; click **Retry pending events**. Check that one new event appears, with no old event replaced. Do not switch vaults with pending events.

## How it fits together

`src/main.js` opens the window and owns Electron's native folder picker. `src/preload.js` gives the web page only a few safe operations. `src/index.html`, `src/style.css`, and `src/renderer.js` make the visible page and call those operations. `src/store.js` owns local JSON saving and vault Markdown logging. It saves task **and pending event together** first, then attempts to write the event as a new file; if that fails, the pending event survives for retry. `tests/store.test.js` checks the file behavior without opening a window. `package-lock.json` fixes the dependency versions for repeatable installs.

## Limits of this stage

Only creation has event logging so far. A folder must contain `.obsidian` to be selected. A task stays saved if vault logging fails, but a pending event must be retried before changing vaults. Keep backups of your app-data and vault; this is student-project software, not a finished release. The current UI has no task lifecycle controls or timer yet.
