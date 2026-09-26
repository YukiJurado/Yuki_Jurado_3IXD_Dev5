# FocusDesk — task lifecycle milestone

An offline Electron desktop app for student tasks and focus work. **Current stage:** select an Obsidian vault; create/view/edit title and colour/complete/reopen/delete tasks; save locally and append one Markdown event per action. **Focus timer, breaks, sessions and report are not built yet.** See [PRD](docs/PRD.md) for the full assignment scope.

## Run in VS Code

1. Install Node.js and npm. Open this repository folder in VS Code (**File → Open Folder**).
2. Open **Terminal → New Terminal**. Run `npm ci` to install Electron (requires internet the first time; running afterward needs no internet).
3. Run `npm start`. The FocusDesk window opens. Stop with Ctrl+C in the terminal (on macOS, closing the window may leave the app running; use **Electron → Quit Electron** or Ctrl+C).
4. Click **Choose vault folder** and select the **root of an existing Obsidian vault**—the folder containing `.obsidian`. If you have none, create one in Obsidian first. Events are written under `<vault>/FocusDesk/tasks/`; existing notes are not modified.
5. Add a titled task. Its default colour is Sage. Each card has **Edit** (title and Sage/Blue/Peach/Lavender colour), **Complete** or **Reopen**, and **Delete** (asks for confirmation). Deleted tasks disappear from the list, but their vault events remain.

Run `npm test` for storage tests. The app requires no account or cloud service while running.

## Short manual test

1. Choose your vault; add `Read chapter 3`. Edit it to `Read chapter 4`, choose Blue, and save. Check the new title and coloured edge.
2. Click **Complete**: the card should say Completed and show “Task complete!” Click **Reopen**: it should say Open. Click **Delete** and confirm: the card should disappear.
3. Inspect `<vault>/FocusDesk/tasks/`: expect **five different `.md` files**, one each for `task-created`, `task-edited`, `task-completed`, `task-reopened`, `task-deleted`. Check event ID, date, time, timezone, type, status, task ID, title and colour. The edit entry also has the previous title/colour. Confirm earlier files did not change.
4. Add another task, quit and run `npm start` again; confirm its title and state remain. Repeat with a completed task if desired.
5. Failure test: rename the vault folder temporarily, edit or complete a task, and check the pending warning. Restore the folder's **original name**, click **Retry pending events**, then check that the missing event appears once without changing older files. Pending events block vault switching.

## How it fits together

`src/main.js` opens the window, owns the native folder picker, and connects task actions to storage. `src/preload.js` gives the web page only those allowed actions. `src/index.html`, `src/style.css`, and `src/renderer.js` make the page and task controls. `src/store.js` owns local JSON and vault Markdown logging. Each action saves its new task state **and a pending event together** before trying the vault; retry uses the original event ID and does not overwrite existing files. `tests/store.test.js` checks these file behaviors without opening a window. `package-lock.json` pins dependency versions for repeatable installation.

## Limits

A vault folder must contain `.obsidian`. If a vault write fails, the local task change remains, but its event needs retry before switching vaults. Keep backups of app data and vault; this is student-project software, not a finished release. Deleting a task does not delete earlier event history. The native folder picker still needs a user-run manual check on machines where desktop automation lacks permission. There is no focus timer or report yet.
