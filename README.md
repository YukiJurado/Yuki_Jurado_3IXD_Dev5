# FocusDesk — tasks and focus sessions

An offline Electron desktop app for student tasks and focus work. It includes task lifecycle, focus sessions, optional short/long breaks, and a day/week/month focus report. Data persists locally, with append-only Markdown focus/task events in a selected Obsidian vault. See [PRD](docs/PRD.md) for the full scope.

## Run in VS Code

1. Install Node.js and npm. Open this repository folder in VS Code (**File → Open Folder**).
2. Open **Terminal → New Terminal**. Run `npm ci` to install Electron (internet required for the first install; using the installed app afterward is offline).
3. Run `npm start`. Stop with Ctrl+C in the terminal. On macOS, closing the window can leave Electron running; use its Quit menu or Ctrl+C.
4. Click **Choose vault folder** and select the **root of an existing Obsidian vault** (the folder containing `.obsidian`). If needed, create one in Obsidian first. FocusDesk writes new files under `<vault>/FocusDesk/tasks/` and `<vault>/FocusDesk/focus/`; it does not rewrite older event files.

`npm test` runs the automated storage/timing checks. No account or cloud service is needed while running.

## Use the app

- **Tasks:** Add a title (default Sage colour). Each task card has **Focus**, **Edit** (title/colour), **Complete/Reopen**, and **Delete** (with confirmation). Focus completion does **not** complete its task.
- **Focus:** Set a focus length from 1 to 180 whole minutes (default 25) and click **Save length**. Choose a task *or* type a short activity description; Start remains disabled without either. The task card's **Focus** button selects it for you. **Pause** stops counting time; **Resume** continues. **+5 minutes** is available once per session. **Finish early** saves measured active time; reaching zero does the same automatically. **Stop / Cancel** asks for confirmation and does not add partial time to completed-session history.
- **Close and reopen:** A running or paused session becomes **Interrupted**. On reopening, choose **Resume** or **Cancel interrupted session**; time while the app was closed is not counted. After an unexpected crash, up to roughly one second of recent active time may be lost because the app checkpoints once per second. It never silently completes a recovered session.
- **Breaks:** Save short/long lengths (defaults 10/30 minutes). Completing a focus plan of 25 minutes or less offers a short break; a longer plan offers a long break. The offer is optional. Start shows a countdown; Finish or Stop ends the break. Closing the app pauses a running break at the last saved checkpoint; reopen and press Resume. Breaks are local-only, with no vault break events or completed-focus history entries.
- **History:** Completed focus sessions are listed below the timer with actual active seconds and local completion time. They survive restart. Cancelled sessions are not in this list. Task titles are snapshotted when focus starts, so editing or deleting a task does not relabel earlier sessions.
- **Report:** Scroll to **Focus report** and choose Day, Week, or Month. Horizontal bars show actual completed focus time by task; description-only sessions are grouped under **Other activities**. The week begins Monday in your computer's local timezone. Current task names appear even when renamed; deleted tasks keep their last saved session title. Breaks and cancelled sessions are excluded.

## Short manual test

1. Select a vault and add `Read chapter 3`. Click its **Focus** button. Set length to **1 minute** and save it. Click Start, wait briefly, Pause, wait several seconds, Resume, then Finish early. Check the list shows the actual active seconds (less than the planned minute), the task remains Open, and `FocusDesk/focus/` has one `focus-start` and one `focus-completed` `.md` event with matching session ID, task ID/title snapshot, date/time/timezone, and actual active duration.
2. Type `Review notes` without selecting a task, Start, then **Stop / Cancel**. Check the confirmation and that no completed-history row is added. A `focus-cancelled` event should appear.
3. Start another 1-minute activity and let the timer reach zero. Check one completion event and a history row showing actual focused time. For the extension, start a separate session, click **+5 minutes** once, and check the button disappears and the remaining time grows; Finish early to avoid waiting.
4. Start a session and close the window while it runs. Reopen the app: it must say **Interrupted** and offer Resume or Cancel, without adding closed-app time. Resume and Finish or choose Cancel. Check the history and events accordingly.
5. To test logging failure, rename the vault folder while a session is running, then Finish. The local history should remain, with a pending warning. Restore the **original folder name**, click **Retry pending events**, and check the focus event appears once. Pending events block switching vaults.

6. Save short/long break lengths as **1** and **2** minutes. Complete a 1-minute-plan focus early; the optional short offer should say 1 minute. Start it, watch the countdown decrease, then Finish. Start and complete a 26-minute-plan focus early; the offer should be long (2 minutes). Start it and Stop. Check the focus-history rows and active seconds did not change while breaking. Close/reopen during another break: it should be paused and offer Resume, without counting time closed.
7. Complete focus once for each of two tasks and once for a description-only activity. In **Focus report**, check the bars and totals for Day, Week, and Month. Rename one task: its earlier focus time should stay in the same bar. Delete a task only if it is disposable; its completed time should remain in the report.

## How it fits together

`src/main.js` owns the window, folder picker, one-second checkpoint timer and close handling. `src/preload.js` exposes only named actions to the page. `src/index.html`, `src/style.css`, and `src/renderer.js` display and operate tasks, focus and break controls, history and report. `src/report.js` totals completed focus sessions by local date and task ID. `src/store.js` saves state in Electron's app-data `state.json` and queues vault events before writing them as new files. `tests/store.test.js` covers tasks; `tests/focus.test.js` and `tests/break.test.js` use controllable clocks to verify timing without long waits; `tests/report.test.js` covers period and grouping rules. `package-lock.json` pins dependency versions for repeatable installs.

## Limits

The report shows the current day, week or month; earlier periods are not selectable in this version. Breaks are locally saved countdowns, not recorded sessions or Markdown events. A vault must contain `.obsidian`. If vault logging fails, task or session changes remain locally saved, but pending events must be retried for their original vault before switching. Keep backups of your app data and vault; this is student-project software. Native folder-picker click-through still needs a user-run manual check on machines where desktop automation lacks permission.
