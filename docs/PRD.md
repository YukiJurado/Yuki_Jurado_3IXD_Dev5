# FocusDesk — short PRD (agreed scope)

**Status:** Product decisions confirmed by Yuki after the Grill session. This is a specification, **not** evidence that an app has been built or tested. Source of obligations: supplied `3IXD_Dev5_Assignment_1.pdf` (“Assignment,” “Minimum requirements,” “Obsidian vault,” “PRD and design,” and “What to submit”). Product research and vendor links: [research.md](research.md). Visual artifacts: [task list](../references/Task-List-Sketch.png), [timer](../references/Timer-Sketch.png), and [stats](../references/Stats-Sketch.png). The three sketches are design references, not functional test evidence.

## Purpose, user, problem

FocusDesk is one **offline desktop** app for a student who wants to choose work, focus on it, and see where study time went without an account or cloud service. It combines a task list, configurable focus/break timer, completed-session history, and a modest report. It saves data locally and records required actions in a user-selected Obsidian vault.

## Features and priorities

**Must work first (assignment):** create/view/edit/delete and complete/reopen persistent tasks; start/pause/stop/complete focus sessions; take configurable breaks; set focus and break lengths; connect a session to a task or short activity; review completed sessions; work without internet; select a vault and write clear, consistent, append-only Markdown records for all required task and focus events.

**Chosen features:** task colour from a small palette; a Focus button on each task; one optional +5-minute extension per focus session; automatic completion when the timer reaches zero or a manual Finish-early action; a bar chart of actual completed focus time **per task** with day/week/month filters and an “Other activities” bar; a brief “Task complete” message after marking a task done. These choices come from Yuki's research, sketches, and Grill answers, not from the brief.

**Non-goals for v1:** accounts, cloud sync, collaboration, calendar, task groups, automatic app-activity tracking, estimates, billing, and automatic choice of next task. Chart animation and decorative effects are lower priority than correct logging and persistence.

## Main user flow

1. On first launch, select an existing Obsidian vault folder before using Tasks or Focus. Change it later in Settings, subject to pending-log handling.
2. Add a titled task, optionally choose a colour, and use its **Focus** button; alternatively type a short activity description on the Focus view. Select a task **or** enter a non-empty description before Start.
3. Start a focus session; pause/resume as needed, optionally add five minutes **once** before completion, Stop to cancel, Finish early, or let it complete at zero. Completing focus leaves the task open. Choose any next task yourself.
4. After a completed session, optionally start a timed break. Review completed sessions and the actual-focused-time report. Separately mark a task complete or reopen it.

## Main technical and design decisions

| Decision | Chosen approach and reason |
| --- | --- |
| App/framework | One Electron desktop app with plain HTML, CSS, and JavaScript; one repository. This keeps the student-facing code approachable while allowing local file and folder access. |
| Local storage | Store tasks, sessions, settings, and pending vault events in app-owned local files; persist on each meaningful change, not only on quit. Exact implementation (e.g. a JSON file with safe writes) is an engineering choice to validate while building. The vault is the **event history**, not the only source of live task state. |
| Vault structure | Under the selected vault, create `FocusDesk/tasks/` and `FocusDesk/focus/`. One **new**, uniquely named `.md` file per event, with a stable event ID; never silently overwrite an earlier event. Each file includes date, local time, timezone, event type, status, and the relevant task/session ID and details. A completed focus event includes **actual active duration** and linked task snapshot or activity description. On write failure, retain the event in a local pending queue, show an obvious warning, and retry without duplicating it. Pending events target their original vault; resolve them before switching vaults. |
| Layout | Three desktop views—Tasks, Focus, Report—with Settings accessible separately. Task cards show title, chosen colour, and Focus button; they do **not** need group/date/estimated-hours fields in v1. Focus foregrounds countdown and controls. Report foregrounds completed-session list and a simple bar chart. |
| Usability | Clear Start/Pause/Resume/Stop/Finish labels; Stop warns that this cancels rather than saves partial focus time. A brief confirmation follows task completion. Distinguish vault “pending” from successfully logged; never imply a failed write succeeded. |
| Alternative not chosen | Vue or a larger framework was considered in the attached draft research/PRD but omitted in favour of plain JavaScript for this short project. Separate task and timer apps would require two repositories and more integration work. |

### Timer and report rules

- Default focus: **25 minutes**, adjustable. Default short break: **10 minutes** after a session whose configured focus length is 25 minutes or less; default long break: **30 minutes** after a longer one. Both break lengths are adjustable. A break is **offered**, not started automatically, and its time never counts as focus.
- A focus session completes at zero or by **Finish early**. Record measured active time, excluding paused time. Stop means **cancel**: write the cancellation event, but omit its partial time from completed-session history and chart. On app close, save a running/paused session as interrupted; on reopen offer Resume or Cancel, excluding time while the app was closed. Do not silently complete it.
- Keep the task ID and title snapshot with a session. An edit or deletion during focus does not relabel that session. Deleted tasks do not erase completed sessions. In the report, group task sessions by stable task ID, show the current title for an existing task or saved title for a deleted one; sessions linked only to descriptions appear in “Other activities.”
- Report filters use the computer's **local timezone**, Monday-starting weeks, and the date on which each focus session **completed**. Show actual minutes, switching to hours/minutes for longer totals; never display planned duration as actual. Include sessions for open and completed tasks.

## Acceptance criteria — things to demonstrate in the actual app

1. **Offline and persistence:** With internet disconnected, create a task, close/reopen FocusDesk, and find the task unchanged. Complete a focus session, close/reopen, and find it in completed-session history. No sign-in is needed.
2. **Task lifecycle:** Create, view, edit title/colour, complete, reopen and delete a task. The task list reflects each change; completion shows the brief message. Each of creation, edit, completion, reopening and deletion produces **one** corresponding task-event `.md` file in `FocusDesk/tasks/` with the required event fields. Previous files remain intact.
3. **Session controls and linkage:** Start is disabled until a task or non-empty activity description is supplied. Starting, pausing, resuming, stopping and completing work through visible controls. A start creates a focus-start event. A session that reaches zero or is manually Finished creates a focus-completed event with measured active duration and linked task/activity. A Stopped session creates a focus-cancelled event and is **not** counted as completed time. Finishing focus leaves its task open.
4. **Timing accuracy:** Pause a short test session, wait while paused, then Finish; the recorded actual duration excludes paused time. Extend another session by +5 once; a second extension is unavailable. Set a short configurable focus length to test completion at zero without a long wait.
5. **Breaks:** Change focus, short-break and long-break settings; after a session set to at most 25 minutes, the optional break offer uses the short length, and after a longer session it uses the long length. Start and finish a break; its minutes do not appear in completed focus totals.
6. **History and chart:** Finish sessions for two tasks and one description-only activity, including one early Finish. The completed-session list shows each actual duration. Day/week/month views total only completed focus time per task ID and an “Other activities” bar; changing a task title does not split its bar, and deleting it does not erase its history. Check a Monday week boundary and local completion-date assignment.
7. **Vault failure and retry:** Rename or disconnect the selected vault folder, perform a task action, and see a clear pending-log warning while the action remains locally saved. Restore the original folder and retry; the exact event appears **once** without modifying older event files. Changing vaults while pending events exist requires resolving those events for the original vault first.
8. **Interrupted session:** Close the app during running focus, reopen, and choose Resume or Cancel. Closed-app time is not added to actual focus. A cancelled resumed session logs cancellation and stays out of completed history; a completed one records only active time.
9. **Clean clone and submission:** From a fresh clone, follow the README to install dependencies, run offline, and select a vault. The README names setup/run steps, dependencies and vault configuration. Keep Git commits during development. Submit one repository link, a final PDF report (research, PRD, three visuals and what each resolved, design/technical decisions, real vault examples, AI note, reflection), and an `.md` vault sample generated **by the running app**. Use the brief's prescribed filenames: `Yourname_3IXD_Dev5_PRD.PDF` and `Firstname_Lastname_3IXD_Dev5_Obsidiansample.md` (replace placeholders with the student's actual name).

## Visual-reference plan

- **Task-List-Sketch.png:** helped choose scannable task cards and a prominent add action; clarify card contents as *title + colour + Focus*, with no group/date/hour labels in v1.
- **Timer-Sketch.png:** helped choose a large countdown, clear controls, progress and an optional break transition; the sketch's numbers and `±10` are examples, superseded by the agreed adjustable lengths and once-per-session `+5`.
- **Stats-Sketch.png:** helped choose a completion confirmation and compact report with day/week/month views; bars mean **actual completed focus time per task**, not percentages of task completion. Mobile `reference-1.jpg` through `reference-4.jpg` inspire rounded cards/soft colours but must be adapted to desktop, not copied as a mobile layout.

## Remaining implementation checks (not product decisions)

Validate safe local-file writes, timer behavior across app suspension, vault permissions, and retry idempotency in running code. These are risks to test; do not claim them solved by this PRD. The assignment PDF does not state a Sunday deadline; the schedule constraint comes from the current project context.
