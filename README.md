# Mirror OA

Single-session browser app for interview prep. You create one session, add problems, start one shared countdown, optionally open a floating timer window, and close the session into a summary screen.

## Tech Stack

- HTML5 for the page structure and reusable templates.
- CSS3 for layout, theme, responsive behavior, and modal styling.
- Vanilla JavaScript for state, rendering, timer logic, local storage, and floating window behavior.
- Browser APIs used:
	- `localStorage` for persistence.
	- `setInterval` for countdown updates.
	- `crypto.randomUUID()` for problem ids.
	- `AudioContext` for the time-up alert.
	- `DocumentPictureInPicture` when available, with `window.open()` fallback.

## Project Files

- [index.html](c:\Users\DSUNDAR\Desktop\the%20dsundar\code%20widget\index.html): main app structure, templates, and summary modal markup.
- [styles.css](c:\Users\DSUNDAR\Desktop\the%20dsundar\code%20widget\styles.css): full visual system, layout, timer card, status pills, and session summary modal styles.
- [app.js](c:\Users\DSUNDAR\Desktop\the%20dsundar\code%20widget\app.js): all app state, event wiring, timer logic, rendering, persistence, PiP popup sync, and summary generation.

## App Flow

1. The app starts in `initialize()` in [app.js](c:\Users\DSUNDAR\Desktop\the%20dsundar\code%20widget\app.js).
2. Saved session data is restored by `hydrateState()`.
3. DOM events are connected in `bindEvents()`.
4. The user fills the session form and saves it through `handleAddProblem()`.
5. The saved session is rendered by `render()`.
6. Starting the timer calls `handleStart()`, which sets `endTimestamp` and begins `startTicking()`.
7. Each timer tick updates `remainingSeconds`, persists state, and rerenders the timer.
8. Problem statuses are updated with `updateProblemStatus()`.
9. Opening the floating window uses `openPipWindow()`, `setupPipDocument()`, and `renderPip()`.
10. Closing the session calls `clearAllProblems()`, which snapshots a summary, resets the active session, and shows the summary modal.
11. Returning home closes the summary through `closeSessionSummary()`.

## Where The Logic Lives

### State and DOM references

Located near the top of [app.js](c:\Users\DSUNDAR\Desktop\the%20dsundar\code%20widget\app.js).

- `state`: current session data, timer state, PiP references, and last session summary.
- `elements`: cached DOM nodes used across the app.

### Session builder logic

Located in [app.js](c:\Users\DSUNDAR\Desktop\the%20dsundar\code%20widget\app.js).

- `handleAddProblem()`: validates form input and saves a full session.
- `ensureSessionRows()` / `addSessionRow()` / `resetSessionRows()`: manage editable problem rows.
- `openSessionEditor()`: reopens the builder with current session values.
- `getSessionRowValues()`: reads builder input values.

### Timer logic

Located in [app.js](c:\Users\DSUNDAR\Desktop\the%20dsundar\code%20widget\app.js).

- `handleStart()`: starts the countdown.
- `startTicking()` / `stopTicking()`: manage the interval.
- `finishTimer()`: stops the session when time reaches zero and plays the alert sound.
- `syncRemainingToSession()`: resets countdown time from session minutes.
- `formatTime()` and `formatDuration()`: convert seconds to readable strings.

### Rendering logic

Located in [app.js](c:\Users\DSUNDAR\Desktop\the%20dsundar\code%20widget\app.js).

- `render()`: top-level UI update path.
- `renderProblems()`: paints the current problem list.
- `getProblemsRenderSignature()`: prevents unnecessary list rerenders during timer ticks.
- `renderSessionSummary()`: shows the close-session summary modal.

### Problem status logic

Located in [app.js](c:\Users\DSUNDAR\Desktop\the%20dsundar\code%20widget\app.js).

- `normalizeProblemStatus()`: keeps statuses constrained to `unsolved`, `attempted`, or `solved`.
- `updateProblemStatus()`: updates one problem and rerenders.
- `getStatusLabel()`: maps internal status values to UI labels.

### Session summary logic

Located in [app.js](c:\Users\DSUNDAR\Desktop\the%20dsundar\code%20widget\app.js) and [index.html](c:\Users\DSUNDAR\Desktop\the%20dsundar\code%20widget\index.html).

- `buildSessionSummary()`: creates a snapshot before the active session is cleared.
- `renderSessionSummary()`: fills the modal UI.
- `createSummaryCountPill()` and `createSummaryProblemItem()`: generate summary rows.
- `closeSessionSummary()`: dismisses the modal and leaves the app at the home state.

### Floating timer logic

Located in [app.js](c:\Users\DSUNDAR\Desktop\the%20dsundar\code%20widget\app.js).

- `openPipWindow()`: opens Document Picture-in-Picture or popup fallback.
- `setupPipDocument()`: builds the floating window DOM.
- `renderPip()` / `renderPipProblemList()`: keep the floating window synced with the main app.

### Persistence logic

Located in [app.js](c:\Users\DSUNDAR\Desktop\the%20dsundar\code%20widget\app.js).

- `hydrateState()`: restores from local storage on load.
- `persistState()`: saves active session state to `pip-dsa-timer-state`.

## How To Run

Open [index.html](c:\Users\DSUNDAR\Desktop\the%20dsundar\code%20widget\index.html) in a Chromium-based browser.

## How To Make Further Changes

### Add a new field to the session

1. Add the input markup in [index.html](c:\Users\DSUNDAR\Desktop\the%20dsundar\code%20widget\index.html).
2. Cache the element in `elements` inside [app.js](c:\Users\DSUNDAR\Desktop\the%20dsundar\code%20widget\app.js).
3. Save it inside `state`.
4. Restore and persist it through `hydrateState()` and `persistState()`.
5. Include it in `render()` if it affects the visible UI.

### Change the timer behavior

1. Update `handleStart()`, `startTicking()`, `finishTimer()`, or `syncRemainingToSession()` in [app.js](c:\Users\DSUNDAR\Desktop\the%20dsundar\code%20widget\app.js).
2. Keep `remainingSeconds`, `isRunning`, and `endTimestamp` consistent.
3. Recheck the session summary because elapsed time depends on the same timer state.

### Change the session summary

1. Update modal markup in [index.html](c:\Users\DSUNDAR\Desktop\the%20dsundar\code%20widget\index.html).
2. Update modal styles in [styles.css](c:\Users\DSUNDAR\Desktop\the%20dsundar\code%20widget\styles.css).
3. Update `buildSessionSummary()` and `renderSessionSummary()` in [app.js](c:\Users\DSUNDAR\Desktop\the%20dsundar\code%20widget\app.js).

### Change the problem status UI

1. Update the problem template in [index.html](c:\Users\DSUNDAR\Desktop\the%20dsundar\code%20widget\index.html).
2. Update status styles in [styles.css](c:\Users\DSUNDAR\Desktop\the%20dsundar\code%20widget\styles.css).
3. Update `renderProblems()`, `normalizeProblemStatus()`, and `getStatusLabel()` in [app.js](c:\Users\DSUNDAR\Desktop\the%20dsundar\code%20widget\app.js).

### Change the floating widget

1. Update `setupPipDocument()` and `renderPip()` in [app.js](c:\Users\DSUNDAR\Desktop\the%20dsundar\code%20widget\app.js).
2. If you add more fields to the widget, keep both the initial setup path and the rerender path aligned.

## Guardrails For Future Changes

- Do not rerender the problem list on every timer tick unless list content actually changed. The current guard is `getProblemsRenderSignature()`.
- If you add state that should survive refresh, it must be included in both `hydrateState()` and `persistState()`.
- If you change close-session behavior, preserve the summary snapshot before clearing session state.
- If you add new problem statuses, update all of these together: normalization, label mapping, summary counts, summary styles, and problem-item UI.
- If PiP behavior changes, test both native Picture-in-Picture support and popup fallback.

## Current Feature Summary

- Single named session.
- Multiple problems inside one session.
- One shared countdown timer.
- Inline problem status pills.
- Close-session summary modal.
- Floating timer window with popup fallback.
- Local storage persistence.
- Keyboard shortcuts for start, close, and focus.

# mirror-OA