# Implementation notebook — first working slice

## Decisions
- Followed the already-confirmed PRD/Grill decisions; no new product scope. Task cards and add action take their cue from Task-List-Sketch; timer and stats sketches are reserved for later stages.
- Plain JavaScript + Electron, with a sandboxed page and a narrow preload API. The Electron main process alone performs file I/O.
- Local `state.json` contains tasks, selected vault, and pending events. A temporary file is renamed into place for each save. The vault receives a unique `.md` file per event via exclusive creation; retry checks an existing file's exact contents before clearing a pending event.
- The app requires a selected folder containing `.obsidian`. Missing vault writes do not recreate a fake vault folder. Pending events stay associated with the original vault and block switching.

## Actual checks
- Storage tests: `npm test` passed 4/4 (vault required, persistent creation/event fields, unavailable-vault retry without duplication, invalid input rejection).
- Launched `npm start` with an isolated app-data directory; Chrome DevTools protocol observed the actual Electron page. Initial page displayed a disabled Add button without a vault. With an isolated vault preselected in state, a UI form submission produced one task in `state.json`, one `.md` event, and the task in the visible list. Reloading the renderer restored the saved task. Screenshot inspected; layout is readable.
- Fresh local Git clone: `npm ci`, `npm test` (4/4), and `npm audit --audit-level=high` (0 vulnerabilities) passed. This checks installation and storage tests from committed files; a second clone window was not launched.
- `npm audit --audit-level=high` found 0 vulnerabilities after upgrading from Electron 38 to 44.4.5. Original Electron 38 install reported two high vulnerabilities; changed the version based on audit's suggested patched release and re-ran tests.
- Native folder picker click-through was **not** exercised: macOS Accessibility/Screen Recording permission for desktop automation was pending. Storage selection/validation was tested, but native dialog use should be manually checked.

## Problems / AI assistance
- AI read the PRD/research and three sketches, authored the first-stage code, tests, README and this notebook, executed storage and Electron UI checks, and diagnosed the npm audit warning before upgrading Electron. The test vault and screenshot are in a temporary scratch folder, not submission evidence.
- Remaining work after the first slice: task lifecycle and its events; focus/break timing, actual-duration history, reports; failure and crash edge cases; real user-vault manual test; report and genuine app-generated submission sample.

## Task lifecycle milestone
- Decision: four named colours (Sage default, Blue, Peach, Lavender). The task ID does not change on edit or status changes. A same-value edit makes no new event; a repeated completion/reopening is rejected. Delete removes the local task but writes a final event containing its title and colour. Older vault events are untouched.
- TDD: added failing tests before implementing edit, then completion/reopening, then deletion and multi-event outage retry. `npm test` passed 8/8 after the three green stages (5, 6, then 8 total). Independent review found a local-save failure path that left phantom in-memory changes; reproduced it with a failing test, added rollback of the in-memory state, then reached **9/9**. Also enforced the UI's 200-character title limit in storage.
- Electron smoke test: launched a real window with an isolated test data directory and vault. Exercised the page's Add, Edit title/Blue colour, Complete, Reopen and Delete controls via DevTools, including the delete confirmation. The JSON ended with zero tasks and zero pending events; the vault held **five** distinct event files, exactly one for each action. Inspected the task-card screenshot; controls were readable at the default window size. This was an isolated fixture, not the student's own vault.
- Native folder-picker automation remains blocked by pending macOS Accessibility/Screen Recording permission; selecting a user's real vault still needs a human manual check. Focus timing and report remain unbuilt.
- AI assistance: implemented and tested task lifecycle/storage and UI, prepared manual instructions, reviewed results and limitations. No timer/report claims.
- After committing this milestone, a fresh local Git clone passed `npm ci`, `npm test` (9/9), and `npm audit --audit-level=high` (0 vulnerabilities). This clean-clone check installed dependencies and ran storage tests; it did not launch a second GUI window.
