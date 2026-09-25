# Research — FocusDesk (combined student focus app)

**Source distinction.** “My review” below paraphrases Yuki's *App Research-Assignment 1.pdf*; these are the student's judgments, not hands-on test results. “Verified online” means I checked the linked vendor's public page, not that I installed or tested its app. Assignment obligations come from *3IXD_Dev5_Assignment_1.pdf*, under “Assignment” and “Minimum requirements.” Both PDFs were supplied as attachments and are not currently in this repository. Vendor pages and plan limits can change.

## Assignment requirements (not product choices)

The brief calls for research on at least three to-do apps and three Pomodoro/time-tracking apps, with sources, essential versus useful/unnecessary features, and one or two custom ideas. The deliverable must be a local desktop app (one combined app is allowed) that works offline, saves locally, lets users manage and complete/reopen tasks, and supports focus start/pause/stop/complete, breaks, configurable focus/break lengths, task or description linkage, and completed-session review. It must write clear, consistent append-only Markdown events to a **user-selected Obsidian vault**: task creation/edit/completion/reopening/deletion and focus start/completion/cancellation. Entries need date, time, timezone, event type/status and relevant details; completed focus entries need **actual duration** and task/activity. These requirements come from the assignment PDF, not the competing apps. The brief also requires a Grill session, short PRD with testable criteria, three meaningful visual artifacts, Git/GitHub use, a clean-clone README, a final PDF report and a real app-generated vault sample. None is proven complete by this research document.

## Three task apps compared

| App | My review: observation / judgment | Verified online: what the vendor says | Take / scope judgment |
| --- | --- | --- | --- |
| [Todoist](https://www.todoist.com/features) | It feels beginner-friendly and lets users make visually structured tasks. I would leave out multi-user assignments. This is a personal impression, **not a usability test**. | The feature page lists Quick Add, projects, priorities, labels, task descriptions, sections/subtasks, and shared projects with assigned tasks.[1] | **Essential for us:** clear task entry and visible task state. **Useful:** a small amount of structure. **Unnecessary now:** shared projects, assignments, rich filters and integrations. |
| [Microsoft To Do](https://support.microsoft.com/en-us/todo/what-s-new-in-microsoft-to-do) | I liked its simplicity, Outlook connection and “groups,” but would not build Microsoft/Outlook account integration for this solo offline app. Ease of use is my opinion. | Microsoft describes **list groups** (groups of lists), list sharing/assignment, and Outlook integration; tasks can also have steps, dates and reminders.[2][3] | **Useful but deferred:** grouping lists. The draft PRD explicitly says **no groups in v1**; a color per task is a smaller personalization choice. **Unnecessary:** account and Outlook integration. “Groups” here does **not** mean grouping individual tasks. |
| [TickTick](https://ticktick.com/) | I liked having tasks and a Pomodoro timer together; I would leave out collaborators. | Its site lists to-do lists, calendar views, Pomodoro, habit tracking, statistics and shared lists with assignments.[4] | **Useful pattern:** link focused time to work in a single app. **Unnecessary now:** habit tracking, calendar suite and collaboration. It is a reference, not proof that its implementation works offline. |

**Comparison:** Todoist emphasizes organizing tasks, Microsoft To Do adds list/Outlook workflows, and TickTick demonstrates task-plus-timer breadth. For a solo student, a small task list and direct “focus on this task” action carry more value than team or ecosystem features. That last sentence is a product judgment, not a measured user finding.

## Three timer / time-tracking apps compared

| App | My review: observation / judgment | Verified online: what the vendor says | Take / scope judgment |
| --- | --- | --- | --- |
| [Pomofocus](https://pomofocus.io/) | I liked simple customizable focus intervals and day/week/month visual reports; I would omit estimated finish time. | Its site describes tasks linked to a customizable timer, breaks, estimated pomodoros, an estimated finish time, and visual reports by day, week and month.[5] | **Essential for us:** focus/break timing. **Useful:** completed-time report. **Unnecessary:** estimating finish times. |
| [Toggl Track](https://toggl.com/track/features) | I liked one-click timing and reporting and wrote that automated background tracking might be useful. I would omit agency/team reporting and required fields. I did **not** test tracking accuracy. | Toggl lists one-click timers, a private app/browser-activity timeline, offline tracking that later syncs, configurable reports, team invoicing and required fields.[6] | **Useful:** explicit start/stop and linking a time record to a task. **Deferred:** automatic background tracking; it conflicts with the draft PRD's non-goal and adds privacy/implementation complexity. **Unnecessary:** billing and team administration. “Offline tracking” here does not prove a wholly local app. |
| [Clockify](https://clockify.me/) | My review described a free plan with unlimited users/projects, reporting, and admin features; I wanted free, uncapped time tracking, not GPS/kiosk. **Correction:** the unlimited-*users* claim is no longer supported by the current pricing page. | Clockify advertises timer, timesheet, reports, auto tracker, kiosk and location tools.[7] Its current pricing page lists **free tracking for up to five users**, unlimited tracking and projects; kiosk is in Basic and GPS tracking in Pro.[8] | **Useful:** a no-friction timer and simple report. **Unnecessary:** kiosk, GPS, timesheets and invoicing. Free-plan limits are vendor terms, not a feature or constraint of our own app. |

**Comparison:** Pomofocus is the closest model for structured focus/break cycles; Toggl is stronger as a general work timer and reporting suite; Clockify emphasizes team timekeeping. This is a comparison of public descriptions plus my review, **not a hands-on benchmark**.

## Chosen features and why (my decisions, not brief mandates)

My review concluded with three ideas: a timer attached to a task, a day/week/month focus report, and task colors for difficulty or appearance. The attached draft PRD names the app **FocusDesk**, targets a student working offline, and chooses one combined desktop app. The timer link helps answer “what should I work on?”; a modest report shows where actual study time went; a small color palette gives visual distinction without a full calendar or grouping system. These are design hypotheses, not validated user needs.

For the first version, keep task create/view/edit/delete/complete/reopen; locally persisted tasks and sessions; a focus timer tied to a task **or short activity**; configurable focus and break times; start/pause/stop/complete; completed-session history; and required Obsidian event logging. The draft PRD additionally proposes an optional five-minute extension, automatic completion when a focus timer reaches zero (without completing the task), a 10-minute break after sessions of 25 minutes or less and 30 minutes after longer ones, a bar chart of **actual focused time per task** across day/week/month, and a task-color palette. Those extras are **chosen scope**, not assignment requirements; simplify the chart/extension before sacrificing required logging or stop/cancel behavior if time runs short. The draft chooses Electron with HTML/CSS/plain JavaScript, Tasks/Focus/Report views, and one repository; implementation and feasibility remain untested. Accounts, cloud sync, team features, automatic background tracking, complex groups and calendars are non-goals.

### Missing or still uncertain

- No hands-on testing evidence or screenshots of the six products was supplied. Preserve the reviews as opinions and vendor claims as claims; do not present either as observed behavior.
- The draft PRD mentions “cancel” but the brief also says **stop and complete**: decide the exact distinction and log a stopped-before-completion session as cancelled. Specify how manual completion differs from the timer reaching zero and how actual duration excludes pauses.
- The required user-selected vault must work offline and remain append-only. The draft does not yet specify what happens if the vault is unavailable or a write fails, nor the precise folders/file naming and event schema. Resolve in the Grill/PRD before coding.
- The report's treatment of sessions linked only to a short activity (rather than a task), and the meaning of day/week/month boundaries and timezone, need explicit rules. The brief requires session review, but **not** a chart.
- Grouping appears as a useful idea in the Microsoft review, while the draft PRD says no groups in v1; background auto-tracking appears in the Toggl review, while the draft PRD excludes it. Treat the later draft PRD as the current choice unless Yuki changes it.
- The PDFs do not establish that the three visual references, Grill session, final report, vault sample, clean-clone test, or Sunday deadline have been completed; the PDF brief itself does **not** state a Sunday deadline. These are next deliverables or scheduling context, not research findings.

## Sources

[1] https://www.todoist.com/features
[2] https://support.microsoft.com/en-us/todo/what-s-new-in-microsoft-to-do
[3] https://support.microsoft.com/en-us/outlook/calendar/manage-tasks-with-to-do-in-outlook
[4] https://ticktick.com
[5] https://pomofocus.io
[6] https://toggl.com/track/features
[7] https://clockify.me
[8] https://clockify.me/pricing
