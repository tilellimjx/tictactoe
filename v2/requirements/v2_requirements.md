# Tic Tac Toe — Software Requirements Specification

**Version:** 2.0 (Web Edition)
**Platform:** Static Web Application (HTML5 + CSS3 + ES2015+ JavaScript), runnable by double-clicking `index.html`
**Status:** Approved for implementation

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Functional Requirements](#2-functional-requirements)
3. [Non-Functional Requirements](#3-non-functional-requirements)
4. [User Interface Requirements](#4-user-interface-requirements)
5. [Technical Requirements](#5-technical-requirements)
6. [Testing Requirements](#6-testing-requirements)
7. [Assumptions & Constraints](#7-assumptions--constraints)
8. [Out of Scope](#8-out-of-scope)
9. [Glossary](#9-glossary)

---

## 1. Project Overview

This document specifies the requirements for **Tic Tac Toe v2**, a fully client-side, browser-based reimplementation of the v1 console game described in `requirements_final.md`. The application supports the same two play modes — **Human vs Human (HvH)** and **Human vs AI (HvAI)** — with the same three AI difficulty levels (Easy, Medium, Hard) and the same fairness, scoring, and replay semantics, all adapted to a graphical web UI.

V2 introduces three significant additions on top of the v1 feature set:

1. **Three selectable visual themes** — *Beach*, *Mountains*, *Desert* — each with a distinctive background and a unique pair of X/O symbols (per the v2 enhancement request).
2. **Move history with undo / redo** — a new gameplay-enhancing feature unique to v2.
3. **Match-mode (best-of-N)** — a session-shaping feature unique to v2.
4. **Sound effects with mute toggle** — a new sensory feature unique to v2 (sound was explicitly out-of-scope in v1; see v1 §7).

(Three new features total, plus the required theme system. See §2.20–§2.22 for full specs and rationales.)

**Target Audience:** Casual players on desktop or mobile browsers. The product favours visual polish, accessibility, and frictionless use — no install step, no server, no account.

**Distribution model:** A small static-site bundle (one HTML entry plus CSS and JS files). Opening `index.html` directly via the local filesystem (`file://`) launches the game with full functionality; no web server, no build step, and no internet connection are required at runtime.

---

## 2. Functional Requirements

### FR-001 · Main Menu and Game Mode Selection

**Description:**
On page load, and whenever the user navigates back to the main menu, the application shall present a graphical menu allowing the user to choose a game mode or system action.

**Acceptance Criteria:**
- The menu is a styled HTML view (not a numbered text list) and presents the following options as clickable buttons:
  1. Human vs Human
  2. Human vs AI
  3. View Scores
  4. Reset Scores
  5. Help / Instructions
  6. Theme: Beach / Mountains / Desert (theme picker — see FR-019)
  7. Settings (sound toggle, match length — see FR-021, FR-022)
- Selecting **Human vs Human** initiates an HvH session and proceeds to player-name entry (FR-003).
- Selecting **Human vs AI** proceeds to AI difficulty selection (FR-002), then to player-name entry.
- Selecting **View Scores** displays the cumulative scoreboard (FR-014) in a modal or dedicated view.
- Selecting **Reset Scores** triggers the score-reset flow (FR-015).
- Selecting **Help** opens the help screen (UI-008).
- Quitting is handled implicitly by closing the browser tab; an explicit "Return to Main Menu" button is provided everywhere a game session is in progress.
- Any keyboard activation (Enter / Space) on a focused menu button is equivalent to a click.
- Invalid programmatic states (e.g., navigating to a sub-menu before required selections) are prevented by disabling buttons rather than throwing errors.

---

### FR-002 · AI Difficulty Selection

**Description:**
When Human vs AI mode is selected, the system shall allow the player to choose one of three AI difficulty levels.

**Acceptance Criteria:**
- A sub-view displays three buttons:
  - `Easy — random moves`
  - `Medium — heuristic (win / block / centre / corner / random)`
  - `Hard — unbeatable (Minimax)`
- The selection is visually confirmed (the chosen card highlights) and a confirmation message appears (`"Difficulty set to: Hard"`).
- The chosen difficulty governs all AI moves for the entire game session until the user returns to the main menu.
- A "Back" button returns to the main menu without persisting any selection.

---

### FR-003 · Player Name Entry and Validation

**Description:**
Before a game begins, the application shall prompt each human player to enter a display name and validate it via an HTML form.

**Acceptance Criteria:**
- In HvH mode, two separate text inputs are shown, labelled `Player 1 (X)` and `Player 2 (O)`.
- In HvAI mode, one text input is shown for the human player; the AI is labelled by difficulty (`AI (Easy)`, `AI (Medium)`, `AI (Hard)`).
- Names must be **1–20 characters** in length after trimming whitespace.
- Allowed characters: alphanumerics, spaces, hyphens (`-`), and underscores (`_`). All other characters are rejected client-side, including HTML tags and control characters. Input must be sanitised before being inserted into the DOM (use `textContent`, never `innerHTML`, for player-supplied strings — see TR-007).
- Leading and trailing whitespace is stripped before validation.
- Empty input is rejected with an inline error rendered next to the field; alternatively the user may accept the default name (`Player 1` / `Player 2`) by clicking a "Use default" button.
- The names `AI`, `Computer`, `AI (Easy)`, `AI (Medium)`, and `AI (Hard)` (case-insensitive) are reserved for the system and rejected with: `"That name is reserved. Please choose another."`
- In HvH mode, two players may not share the same name (case-insensitive); a duplicate triggers an inline error on the Player 2 field.
- If the entered name (case-insensitive) matches an existing record in `localStorage`, that player's history is reused and continues to accumulate.
- The form's "Start Game" button is disabled while any field is invalid.

---

### FR-004 · Board Initialisation

**Description:**
At the start of every new round, the system shall initialise a clean 3×3 game board with all cells empty.

**Acceptance Criteria:**
- All 9 cells are unoccupied at round start.
- Cells are addressed internally by indices 0–8 (left-to-right, top-to-bottom). The UI maps these to the rendered grid; clicking a cell selects it (no numeric keyboard input is required, but keyboard navigation per UI-002 is supported).
- The board state from any previous round does not persist into the new round.
- Any prior win-line highlight, undo/redo history (FR-020), and animation state are cleared.

---

### FR-005 · Turn Management

**Description:**
The system shall alternate turns between the two players (or human and AI), enforcing that the player holding the first-move privilege for the current round plays `X` and moves first.

**Acceptance Criteria:**
- Within a round, after each valid move the active player switches; a player cannot move twice in succession.
- The current player's name and symbol are clearly displayed in the turn indicator (UI-003) before each turn.
- In HvAI mode, when it is the AI's turn the controller advances automatically and disables click-input on the board until the AI move resolves.
- The first-move privilege for each round is determined by FR-006.

---

### FR-006 · Starting-Player Fairness Across Rounds

**Description:**
To avoid systematic first-move advantage skewing scoreboard results across a multi-round session, the player who moves first shall alternate between rounds.

**Acceptance Criteria:**
- In round 1 of a fresh game configuration, Player 1 / the human plays `X` and moves first.
- In each subsequent round started via FR-017's "Play Again", the starting player alternates.
- The X/O symbol allocation follows the first-mover for the round — the player who moves first in a given round always plays `X`.
- The starting-player rotation resets when the user returns to the main menu and starts a new game configuration.
- The current round's starting player and symbol assignment are clearly announced in a banner above the board before the first move.
- The scoreboard always identifies players by name (not by symbol).

---

### FR-007 · Human Player Move Input

**Description:**
On a human player's turn, the system shall accept a cell selection via mouse click, touch tap, or keyboard, validate it, and apply it to the board.

**Acceptance Criteria:**
- The 3×3 grid is rendered as 9 interactive cells (`<button>` elements for accessibility).
- Clicking, tapping, or pressing Enter / Space on a focused empty cell places the current player's symbol there.
- Clicking an already-occupied cell is a no-op and triggers a brief "shake" animation plus an inline message: `"Cell is already taken."` (UI-005).
- Cells the active player has not yet selected during their turn highlight on hover/focus to indicate they are clickable.
- Keyboard navigation: arrow keys move focus across the grid, Enter / Space selects.
- A "Forfeit Round" button is always visible during a round and triggers the forfeit flow (FR-008).
- Input is disabled during AI thinking, during animations, and after a round ends.

---

### FR-008 · Mid-Round Forfeit / Abandon

**Description:**
A human player shall be able to abandon the current round mid-game and return to the main menu.

**Acceptance Criteria:**
- Clicking the "Forfeit Round" button (always visible during a round) opens a confirmation modal: `"Forfeit this round?"` with `Yes` / `No` buttons.
- On confirmation, the round ends immediately. The forfeit is **not** recorded as a win/loss — the round is treated as if it never occurred (consistent with v1).
- After confirmation, the system returns to the main menu (FR-001).
- Cancelling returns the player to the same board with state unchanged.
- Forfeit is unavailable during the AI's turn; the button is disabled until control returns to the human.

---

### FR-009 · AI Move — Easy Difficulty

**Description:**
On Easy difficulty, the AI shall select its move uniformly at random from all currently available cells.

**Acceptance Criteria:**
- The AI never selects an occupied cell.
- Move selection has no strategic bias; any empty cell is equally probable.
- The chosen cell is announced visually (a brief "AI plays cell N" toast or status line) and the placement is animated (UI-006).
- The AI move completes within 500 ms perceived latency (NFR-001).
- The randomness source is replaceable via a seedable PRNG (TR-005) so unit tests can be deterministic.

---

### FR-010 · AI Move — Medium Difficulty

**Description:**
On Medium difficulty, the AI shall apply a deterministic priority-ordered heuristic.

**Acceptance Criteria:**
- The AI evaluates the following priorities in order and plays the first applicable move:
  1. **Win** — if the AI has an immediate winning move, take it.
  2. **Block** — if the opponent has an immediate winning move, block it.
  3. **Centre** — if the centre cell is empty, take it.
  4. **Opposite corner** — if the opponent occupies a corner and the diagonally opposite corner is empty, take it.
  5. **Empty corner** — take any empty corner.
  6. **Random** — otherwise pick any remaining empty cell at random.
- The AI never selects an occupied cell.
- The chosen cell is announced and animated.
- The AI move completes within 500 ms (NFR-001).

---

### FR-011 · AI Move — Hard Difficulty

**Description:**
On Hard difficulty, the AI shall play optimally using the Minimax algorithm and shall be unbeatable.

**Acceptance Criteria:**
- The AI always selects the move with the highest Minimax score.
- A perfect human can force at most a draw; the AI never loses.
- The AI never selects an occupied cell.
- Tie-break among equally-scored optimal moves: prefer the move that wins in the fewest plies (or loses in the most plies); secondary tie-break is the lowest-indexed cell.
- The chosen cell is announced and animated.
- The AI move completes within 200 ms on the reference machine (NFR-001).
- See TR-004 for algorithmic details.

---

### FR-012 · Win Detection

**Description:**
After every move, the system shall check whether the current player has won by occupying three cells in a winning line.

**Acceptance Criteria:**
- All 8 winning lines are evaluated: 3 rows, 3 columns, 2 diagonals.
- A win is detected immediately after the move that completes the line.
- On detection, the round ends, further input on the board is disabled, and the winning player's name and symbol are announced (e.g., `"Alice (X) wins!"`).
- The three winning cells are visually distinguished by a CSS class adding a coloured background AND an SVG/CSS strike-through line drawn over them (visual + structural, so colour is never the sole signal — NFR-008).
- The win is recorded in the score tracker (FR-014) and persisted (FR-016).

---

### FR-013 · Draw Detection

**Description:**
After every move, if no winning condition is met and no empty cells remain, the system shall declare a draw.

**Acceptance Criteria:**
- A draw is declared when all 9 cells are filled with no winner.
- The message `"It's a draw! Well played by both sides."` is displayed prominently.
- The draw is recorded in the score tracker (FR-014) and persisted (FR-016).

---

### FR-014 · Score Tracking

**Description:**
The system shall maintain a running record for each named player across all rounds in the current session and across sessions (via persistence — FR-016).

**Acceptance Criteria:**
- Each player record tracks: **wins**, **losses**, and **draws**. Games-played is computed as the sum on display.
- Scores are updated immediately after each round outcome (win or draw); forfeits (FR-008) are not recorded.
- Score data is keyed by lowercased player name; the original-casing display name is stored alongside.
- Scores accumulated in previous sessions (loaded from `localStorage` on startup) continue to accumulate across sessions.
- AI records are split by difficulty: separate entries for `AI (Easy)`, `AI (Medium)`, and `AI (Hard)`.
- HvH rounds are tracked per individual player name (not per "Player 1 / Player 2" slot).

---

### FR-015 · Score Reset

**Description:**
The user shall have an explicit, confirmed mechanism to clear all persisted score data.

**Acceptance Criteria:**
- The `Reset Scores` option in the main menu (FR-001) triggers this flow.
- A confirmation modal is displayed: `"This will permanently delete all scores. Are you sure?"` with `Yes, delete` / `Cancel` buttons.
- On confirmation, the in-memory score store and the `localStorage` entry are cleared (replaced with an empty schema, preserving the `schema_version` field).
- A backup is written to a separate `localStorage` key (`tictactoe_scores_backup`) before deletion, allowing manual recovery via developer tools if needed.
- On cancel, no change is made and the menu re-displays.
- In-memory and persisted state are kept in sync at all times.

---

### FR-016 · Score Persistence

**Description:**
Player scores shall be saved to the browser's `localStorage` after every round so they are not lost when the page is closed or refreshed.

**Acceptance Criteria:**
- Scores are written to `localStorage` under the key `tictactoe_scores` as a JSON string.
- The store is updated after every completed round (win or draw) and before page unload (`beforeunload` listener).
- On startup, if the entry exists and is schema-valid, scores are loaded automatically.
- If the entry is missing, an empty store is initialised.
- If the entry is corrupted (invalid JSON or schema-invalid), a non-blocking warning toast is shown, the corrupt value is moved to `tictactoe_scores_corrupt_backup`, and the session starts with empty in-memory scores.
- Schema validation on load checks: required fields present, numeric counters non-negative, schema version recognised.
- See TR-005 for the schema.
- If `localStorage` is unavailable (e.g., disabled by browser policy or quota exceeded), the application falls back to an in-memory store and shows a one-time banner: `"Scores cannot be saved in this browser session."` Gameplay is otherwise unaffected.

---

### FR-017 · Replay Option

**Description:**
After each completed round, the system shall offer the players options for what to do next.

**Acceptance Criteria:**
- A modal or end-of-round panel displays buttons: `Play Again (same settings)`, `Return to Main Menu`, `Change Theme`.
- `Play Again` starts a new round with the same players and settings, resetting only the board; the starting player rotates per FR-006.
- `Return to Main Menu` returns to the main menu (FR-001).
- `Change Theme` opens the theme picker (FR-019) inline, then returns to the end-of-round panel.
- If a match (FR-022) is in progress and not yet decided, the only option offered is `Next Round`; `Return to Main Menu` is also offered with a confirmation that abandoning ends the match without a winner.

---

### FR-018 · Round Summary

**Description:**
After a win or draw, the system shall display a round summary before/within the replay prompt.

**Acceptance Criteria:**
- The final board state is shown with the winning line highlighted (FR-012) when applicable.
- The outcome is clearly announced (winner name + symbol, or draw message).
- The current cumulative scoreboard is displayed (FR-014).
- A small stats block is shown for the round (display only; not persisted):
  - Total moves played.
  - Wall-clock duration (mm:ss), measured via `performance.now()`.
  - For HvAI rounds, average AI move computation time in milliseconds.
- The replay options (FR-017) are shown immediately below the summary.

---

### FR-019 · Theme Selection (NEW in v2 — required by enhancement request)

**Description:**
The user shall be able to choose between three visual themes — **Beach**, **Mountains**, **Desert** — each of which changes the application background image and the symbols rendered for X and O.

**Acceptance Criteria:**
- A theme picker is reachable from (a) the main menu, (b) the in-game settings panel, and (c) the end-of-round panel.
- The picker displays three preview cards labelled `Beach`, `Mountains`, `Desert`. Each card shows a thumbnail of the background and the X/O symbols used.
- The currently active theme is visually marked as selected.
- Selecting a theme:
  - Applies a `data-theme="beach|mountains|desert"` attribute on the `<html>` or `<body>` element. All theme styling is driven by CSS attribute selectors and CSS custom properties (no inline-style writes from JS for theme colours).
  - Swaps the background image to the theme's image (or CSS gradient fallback if the image fails to load).
  - Swaps the X and O symbols. Each symbol is rendered as either an inline SVG or a Unicode glyph defined per theme:

    | Theme     | Background motif (image or CSS gradient)              | X symbol                  | O symbol                   |
    |-----------|-------------------------------------------------------|---------------------------|----------------------------|
    | Beach     | Sand + ocean (warm yellows + blue)                    | Palm tree (🌴 / SVG)      | Sun (☀ / SVG)              |
    | Mountains | Snow-capped peaks (cool blues + white)                | Snowflake (❄ / SVG)       | Pine tree (🌲 / SVG)       |
    | Desert    | Dunes + sky (orange + tan)                            | Cactus (🌵 / SVG)         | Tumbleweed / sun (SVG)     |

  - Both symbols within a theme are visually distinguishable from each other at a glance (NFR-008).
- The chosen theme is persisted to `localStorage` under the key `tictactoe_theme` and is restored on next load.
- The default theme on first ever launch is `Beach`.
- Switching themes mid-round is allowed and does not affect game state — only the visual rendering changes; existing X/O placements re-render with the new theme's symbols.
- Each theme defines its own colour palette (background, board grid lines, win-line colour, text colour) via CSS custom properties so contrast remains AA-compliant on every theme.

---

### FR-020 · Move History with Undo / Redo (NEW in v2 — Feature 1 of 3)

**Rationale (one-line):** Pure-client feature that adds genuine gameplay depth and a teaching aid for new players, with no analogue in v1.

**Description:**
The system shall maintain a stack-based history of all moves in the current round and shall expose Undo and Redo controls during HvH play and during the human's turn in HvAI play.

**Acceptance Criteria:**
- A history list (move-stack) records every move applied to the board within a round, in order, including the player and cell index.
- An **Undo** button is visible during a round. When clicked:
  - In HvH mode: the most recent move is reverted; the previous player becomes the active player; the redo stack gains the reverted move.
  - In HvAI mode: undo reverts both the AI's last move *and* the human's previous move (one logical "turn"), so the human regains the same decision point. If the human has not yet moved (i.e., the AI just made the opening move because the human is `O` for the round), undo is disabled.
- A **Redo** button is visible during a round. Clicking it re-applies the most recently undone move (and, in HvAI mode, also the AI move that followed it).
- Any new move clears the redo stack.
- Undo/redo is disabled (greyed out) when the corresponding stack is empty and after the round has ended.
- Undo/redo affects only board and turn state. **Outcomes already recorded in the score tracker are not retroactively edited** — undo only operates within an in-progress round.
- Keyboard shortcuts: `Ctrl/Cmd + Z` triggers undo; `Ctrl/Cmd + Shift + Z` (or `Ctrl/Cmd + Y`) triggers redo, when focus is inside the game view.
- Animations for undo/redo mirror the placement animation in reverse / replay.

---

### FR-021 · Sound Effects with Mute Toggle (NEW in v2 — Feature 2 of 3)

**Rationale (one-line):** Sound was explicitly out-of-scope in v1 (§7); browsers natively provide the Web Audio API so this is purely a client feature that adds satisfying, accessible feedback.

**Description:**
The application shall play short sound effects on key gameplay events and shall provide a clearly visible mute control whose state persists across sessions.

**Acceptance Criteria:**
- Sound events:
  - Move placement (X and O have distinct, very short tones — ≤ 150 ms).
  - Win (a brief celebratory chord — ≤ 800 ms).
  - Draw (a soft neutral tone — ≤ 600 ms).
  - Invalid-cell click (a short low "thud").
  - Theme change (a brief swoosh).
- All sounds are generated procedurally via the **Web Audio API** (`AudioContext`, `OscillatorNode`, `GainNode`) so the project ships **no audio asset files** — keeping the bundle small and avoiding browser autoplay-policy issues with `<audio>` element loading from `file://`.
- A mute button (speaker icon) is visible in the top bar of every screen. Clicking toggles between muted and unmuted; the icon visibly reflects state and has an accessible label.
- The mute state is persisted to `localStorage` under the key `tictactoe_muted` and restored on next load. Default: unmuted.
- The first sound is only played after the first user gesture (click/keypress) to comply with browsers' autoplay policy. An `AudioContext` is lazily created and resumed on first interaction.
- If the Web Audio API is unavailable, audio is silently disabled (no errors, no console noise) and the mute toggle is hidden.
- No sound shall block, delay, or otherwise gate gameplay. Audio failures never affect game state.

---

### FR-022 · Match Mode (Best-of-N) (NEW in v2 — Feature 3 of 3)

**Rationale (one-line):** Adds session-shaping competitive structure unique to v2, useful for both HvH duels and AI-difficulty challenges, with no analogue in v1.

**Description:**
The user shall be able to play a configurable best-of-N "match" consisting of multiple rounds, with a match-level scoreboard distinct from the lifetime scoreboard.

**Acceptance Criteria:**
- The Settings view (reached from the main menu) and the pre-game configuration view both expose a **Match Length** selector with options: `Single round`, `Best of 3`, `Best of 5`, `Best of 7`. The default is `Single round` (preserves v1 semantics by default).
- When a multi-round match is active:
  - A match-progress strip is visible above the board showing each round's pending/win/loss/draw status as a dot or pill, plus the running match score (e.g., `Alice 2 — 1 Bob`, draws shown separately).
  - At the end of every round the system automatically advances to the next round (using FR-017's `Next Round` button) until either the match concludes or the user exits.
  - Starting-player fairness (FR-006) continues to alternate every round within the match.
- The match concludes when one player has won more rounds than the other could possibly catch (e.g., 2 wins in a Best-of-3, regardless of remaining rounds), or when all rounds have been played. Drawn rounds count toward the played total but do not award a match win to either player; if the match ends with equal wins because of draws, the match is declared a draw.
- A match-summary screen displays:
  - The final match score.
  - The match winner (or "Match drawn").
  - Per-round outcomes in chronological order.
  - Buttons: `New Match (same settings)`, `Return to Main Menu`.
- Per-round wins, losses, and draws are still recorded in the persistent lifetime scoreboard (FR-014) exactly as they would be in single-round play. The match itself is **not** persisted across sessions in v2; closing the page mid-match abandons it.

---

## 3. Non-Functional Requirements

### NFR-001 · Performance

**Description:**
The game shall remain responsive on standard consumer hardware in modern browsers.

**Acceptance Criteria:**
- **Reference machine:** dual-core 2 GHz CPU, 4 GB RAM, current Chrome / Firefox / Edge / Safari.
- Initial page load to interactive (Time To Interactive) ≤ 1.5 s on the reference machine over `file://`.
- Click-to-render latency for human moves ≤ 100 ms.
- Easy and Medium AI moves complete within 500 ms total perceived latency.
- Hard AI (Minimax) moves complete within 200 ms.
- `localStorage` reads/writes complete within 50 ms.
- All animations run at ≥ 30 fps on the reference machine; non-essential animations may be disabled if `prefers-reduced-motion: reduce` is set (NFR-008).

---

### NFR-002 · Usability

**Description:**
The game shall be intuitive for a first-time user without external documentation.

**Acceptance Criteria:**
- The main menu, board, and end-of-round panel each fit within a 1024×768 viewport without scrolling on default browser zoom.
- All buttons and form controls have visible labels (no icon-only controls without an `aria-label`).
- All prompts state the expected input format and valid range.
- Error messages are specific, human-readable, and rendered inline next to the offending control.
- A first-time user can start and complete a round without consulting the help screen.
- No prompt requires the user to recall information shown more than one screen ago.
- The currently active theme, current player, and undo/redo availability are always visible during a round.

---

### NFR-003 · Reliability and Error Handling

**Description:**
The application shall handle invalid inputs and unexpected runtime conditions without crashing or losing data.

**Acceptance Criteria:**
- No uncaught JavaScript exception ever propagates to the browser default error overlay during normal operation. A global `window.onerror` and `window.onunhandledrejection` handler catches stragglers, logs them to the dev console, and shows a non-blocking toast: `"Something went wrong. The game will continue."`
- All input paths validate before use; invalid inputs trigger an inline error and re-prompt.
- `localStorage` failures (quota exceeded, disabled, security errors) are caught and reported per FR-016 without terminating the session.
- Asset load failures (background images, fonts) fall back gracefully to CSS-only equivalents.
- Audio failures (FR-021) never block gameplay.

---

### NFR-004 · Maintainability

**Description:**
The codebase shall be modular and easy to extend.

**Acceptance Criteria:**
- Code is organised into the modules defined in TR-003.
- ES modules (`<script type="module">`) are used for separation; each module exports a small, documented surface.
- All public functions carry JSDoc comments describing parameters, return types, and side effects.
- No single function exceeds 50 lines.
- Adding a new AI difficulty requires changes only inside the `ai.js` module (Open/Closed compliant).
- Adding a new theme requires only (a) a new entry in `themes.js`, (b) a CSS block keyed by `[data-theme="..."]`, and (c) optional new SVG symbol definitions — no changes to game logic.
- A `README.md` documents how to run the game (double-click `index.html`), the project layout, and how to run the unit tests.

---

### NFR-005 · Portability and Browser Compatibility

**Description:**
The game shall run in modern browsers without modification.

**Acceptance Criteria:**
- Supported browsers: latest two stable releases of Chrome, Firefox, Edge, and Safari (desktop and mobile).
- The application uses only standard Web Platform APIs available in all four — no vendor-prefixed properties without standard fallbacks.
- The application loads and runs identically when served over `http://` and when opened directly via `file://`. In particular: no feature shall require `fetch()` of local resources that browsers block under `file://`. All assets (CSS, JS, images, SVG) are loaded via plain `<link>` / `<script>` / `<img>` tags or inlined.
- No build step is required. There is no transpilation, bundling, or package-manager runtime dependency for end users.
- The application is responsive: it adapts to viewports from 320 px wide (mobile) to 1920 px wide (desktop) without horizontal scrolling.
- Touch input is fully supported on mobile; tap targets are ≥ 44×44 CSS pixels.

---

### NFR-006 · Data Integrity

**Description:**
The score store shall not be corrupted by interrupted writes or repeated tab refreshes.

**Acceptance Criteria:**
- All score writes serialise via a single helper that JSON-stringifies the in-memory store, then writes once to `localStorage` (writes are synchronous and atomic at the `localStorage` API level).
- A `schema_version` field is present in every persisted payload to support forward migration.
- Reads validate the schema before trusting data; invalid data is quarantined per FR-016.
- The persisted payload contains no executable content — only player names (sanitised on input — TR-007) and integer counters.

---

### NFR-007 · Testability

**Description:**
Core game logic shall be unit-testable in isolation, with quantified coverage and verified correctness guarantees.

**Acceptance Criteria:**
- Win detection, draw detection, move validation, AI move selection, score persistence, theme application, undo/redo logic, and match-mode logic are pure functions or testable methods reachable without DOM rendering. (DOM-touching code is thin and tested separately via jsdom — see §6.)
- The test suite uses **Jest** with the **jsdom** test environment.
- Tests run via `npm test` from the project root with no other configuration required.
- Tests run without user interaction and without a browser.
- Branch coverage on the `board`, `ai`, `scoreManager`, `history`, `match`, and `theme` modules is **≥ 90%**, verified by Jest's `--coverage` reporter.
- See §6 for the full testing requirement list.

---

### NFR-008 · Accessibility

**Description:**
The UI shall be usable by keyboard-only and assistive-technology users, and shall never rely on colour alone to convey information critical to gameplay.

**Acceptance Criteria:**
- All interactive controls (menu buttons, cells, dialog buttons) are reachable via Tab and operable via Enter / Space.
- The 3×3 grid has logical arrow-key navigation and an `role="grid"` / `role="gridcell"` ARIA structure.
- Player symbols (`X`/`O`, regardless of theme) are distinguishable by **shape**, not only colour.
- The winning line is conveyed by both colour AND a strike-through line element (FR-012).
- All text has WCAG 2.1 AA contrast (≥ 4.5:1) on every theme background; theme palettes are chosen and tested to meet this.
- All interactive elements have an accessible name (visible text or `aria-label`).
- Live regions (`aria-live="polite"`) announce turn changes, move outcomes, and end-of-round results to screen readers.
- The `prefers-reduced-motion: reduce` media query disables non-essential animations.
- The game is fully playable on a monochrome display and by colour-vision-deficient users with no loss of information.

---

### NFR-009 · Localisation Readiness

**Description:**
While v2 ships in English only, the codebase shall be structured to allow translation later without refactoring.

**Acceptance Criteria:**
- All user-facing strings are defined in a single `strings.js` module (or constant dictionary); no English strings appear inline in logic code.
- Formatted strings use named placeholder substitution (e.g., `t("playerWins", { name, symbol })`).
- This is a soft requirement; no actual translations are delivered for v2.

---

### NFR-010 · Privacy and Offline Operation

**Description:**
The application shall not transmit any user data and shall work fully offline.

**Acceptance Criteria:**
- The application makes zero outgoing network requests at runtime. No analytics, no telemetry, no font/script CDNs, no external APIs.
- All assets are local files within the project directory.
- The application works identically with the device offline.
- No cookies are set; storage is limited to `localStorage` keys prefixed with `tictactoe_`.

---

## 4. User Interface Requirements

### UI-001 · Main Menu Display

**Description:**
The application shall display a clear, themed main menu on load and whenever the user returns to it.

**Acceptance Criteria:**
- The menu view shows the game title `TIC TAC TOE` as a styled heading at the top.
- Mode buttons (FR-001) are stacked vertically on narrow viewports and laid out horizontally on wide viewports.
- A summary line shows the top-1 player from the lifetime scoreboard (e.g., `Top: Alice — 12 wins`) or `No scores recorded yet.` if empty.
- The current theme is visually applied to the menu (background, accent colours).
- The mute toggle (FR-021) and theme picker entry are visible in a persistent top bar.

---

### UI-002 · Board Rendering

**Description:**
The game board shall be rendered as a clearly readable 3×3 grid.

**Acceptance Criteria:**
- The grid is implemented using CSS Grid with three equal columns and rows.
- Each cell is a focusable `<button>` element of at least 80×80 CSS pixels on desktop and 60×60 on mobile, with a tap target ≥ 44×44 (NFR-005).
- Empty cells display nothing in the centre by default. On hover or keyboard focus, the cell shows a faint preview of the active player's symbol at reduced opacity to indicate it is clickable.
- Filled cells display the theme-specific X or O symbol (FR-019).
- Cells participating in a winning line receive a `.win-cell` CSS class that adds a coloured backdrop, and an SVG strike-through element overlays the three cells.
- Recently placed cells animate in (e.g., scale from 0 to 1 over 150 ms) unless `prefers-reduced-motion` is set.

---

### UI-003 · Turn Indicator

**Description:**
Before each move, the system shall clearly indicate whose turn it is.

**Acceptance Criteria:**
- A turn banner above the board shows: `"<Name>'s turn (<Symbol>)"` with the symbol rendered using the active theme's icon.
- On the AI's turn the banner reads `"AI is thinking…"` with a small spinner.
- The banner uses `aria-live="polite"` so screen readers announce changes (NFR-008).
- An artificial AI-thinking delay is bounded at 300 ms when the actual computation is faster, to avoid jarring instant moves.

---

### UI-004 · Input Affordance and Prompt

**Description:**
Human players shall be guided by consistent visual affordances.

**Acceptance Criteria:**
- Empty cells show a hover/focus state on pointer hover and keyboard focus.
- Disabled cells (occupied, or while the AI is thinking, or after the round ends) show a disabled cursor and are not focusable for click input.
- The "Forfeit Round" and "Undo / Redo" buttons (FR-020) sit in a control strip below the board.
- An ARIA-described status line beneath the board summarises remaining empty cells and turn count.

---

### UI-005 · Invalid Input Feedback

**Description:**
All invalid actions shall produce immediate, descriptive feedback without disrupting useful screen context.

**Acceptance Criteria:**
- Clicking an occupied cell triggers a 150 ms shake animation on that cell and shows an inline message: `"Cell is already taken."`
- Form-field errors (FR-003) appear inline directly under the field, in a colour with ≥ 4.5:1 contrast, and prevent submission.
- Errors are announced via `aria-live="assertive"` on a dedicated live region.
- Errors do not duplicate or accumulate visually across successive invalid actions; only the latest message is shown.

---

### UI-006 · Game Result Announcement

**Description:**
The outcome of each round shall be announced with a prominent, visually distinct message.

**Acceptance Criteria:**
- Win message: `"🎉 <Player Name> (<Symbol>) wins! Congratulations!"` rendered in a modal-like end-of-round panel.
- Draw message: `"It's a draw! Well played by both sides."`
- The final board with the winning line marked (FR-012) is visible behind / above the panel.
- The result is also written to the `aria-live` region for screen readers.
- The end-of-round panel contains the round summary (FR-018) and replay options (FR-017).

---

### UI-007 · Scoreboard Display

**Description:**
The score table shall be formatted for easy reading on every supported viewport.

**Acceptance Criteria:**
- Columns: `Player`, `Wins`, `Losses`, `Draws`, `Played`.
- A header row with sortable column headers (clicking a header re-sorts).
- Default sort: descending by wins; secondary sort by fewer losses; tertiary by alphabetical name.
- Players' display names use sanitised text rendering (TR-007).
- Empty state: `"No scores recorded yet."` shown in place of the table.
- The table is keyboard-navigable and properly labelled for screen readers (`<table>`, `<thead>`, `<tbody>`, `<th scope="col">`).

---

### UI-008 · Help / Instructions Screen

**Description:**
A help screen shall be accessible from the main menu and shall describe gameplay in plain language.

**Acceptance Criteria:**
- Reachable in one click from the main menu (FR-001 option 5).
- Contents include: rules of Tic Tac Toe; how to make a move (click, tap, or keyboard); descriptions of the three AI difficulty levels; the mid-round forfeit control (FR-008); how undo/redo works (FR-020); how match mode works (FR-022); how to change theme (FR-019); how to mute sound (FR-021); how to view and reset scores.
- A `Close` / `Back to Menu` button returns to the main menu.

---

### UI-009 · Theme Picker (NEW in v2)

**Description:**
The theme picker shall present the three themes as visual cards.

**Acceptance Criteria:**
- The picker is a modal or inline panel with three cards, each showing:
  - Theme name (`Beach` / `Mountains` / `Desert`).
  - A thumbnail preview of the background.
  - A preview of the X and O symbols rendered in that theme.
- The currently active theme has a `Selected` badge and a distinct outline.
- Clicking a card activates that theme immediately (FR-019) and updates the selected indicator.
- A `Close` button dismisses the picker.

---

### UI-010 · Match Progress Strip (NEW in v2)

**Description:**
When match mode (FR-022) is active, a progress strip shall summarise match status above the board.

**Acceptance Criteria:**
- Shows: format label (e.g., `Best of 5`), running score (`Alice 2 — 1 Bob`, plus `(1 draw)` when applicable), and a row of dots/pills representing each round (one per round, coloured/icon-coded for Player 1 win, Player 2 win, or draw, with future rounds shown muted).
- Updates immediately at the end of each round.
- Hidden entirely when the user has chosen `Single round`.

---

### UI-011 · Sound Mute Toggle (NEW in v2)

**Description:**
A persistent control shall allow the user to toggle sound at any time.

**Acceptance Criteria:**
- A speaker icon button is in the top bar of every view (menu, in-game, end-of-round, scoreboard, help).
- The icon visually distinguishes muted (slashed speaker) from unmuted (speaker with waves).
- The button has an `aria-label` of either `"Mute sound effects"` or `"Unmute sound effects"` matching its state.
- The button is hidden if Web Audio is unavailable (FR-021).

---

## 5. Technical Requirements

### TR-001 · Languages and Runtime

**Description:**
The application shall be implemented in HTML5, CSS3, and ECMAScript 2015 (ES6) or newer JavaScript, with no compilation or bundling step.

**Acceptance Criteria:**
- The codebase uses only features supported in evergreen browsers' latest two stable releases.
- The entry point is `index.html` at the project root; double-clicking it opens a fully functional game.
- ES modules are used (`<script type="module" src="src/main.js"></script>`). All modules use relative paths resolvable under `file://`.
- No third-party runtime libraries are bundled. (Dev-only dependencies for testing — Jest, jsdom — are listed in `package.json` and are not required at runtime.)
- The HTML document declares `<!DOCTYPE html>` and `<meta charset="utf-8">` and a responsive `<meta name="viewport">` tag.

---

### TR-002 · Dependencies

**Description:**
The runtime application shall have zero third-party dependencies; development dependencies shall be minimal and pinned.

**Acceptance Criteria:**
- Runtime: zero npm packages, zero external scripts, zero external stylesheets, zero external fonts. (Web fonts may be inlined as `@font-face` from local files, or omitted in favour of system font stacks.)
- Development: `package.json` declares `jest`, `jest-environment-jsdom`, and (optionally) a coverage reporter. Versions are pinned to exact patch releases.
- A lockfile (`package-lock.json`) is committed.

---

### TR-003 · Code Architecture

**Description:**
The codebase shall follow a modular architecture with clear separation of concerns. There is no framework; vanilla JS modules orchestrate views.

**Acceptance Criteria:**

Directory layout (relative to project root):

```
index.html
src/
  main.js           # Entry point; wires UI to game controller
  game.js           # Round/match orchestration; turn management; win/draw detection
  board.js          # Pure board state; move application; win-line lookup
  player.js         # Player factory: HumanPlayer, AIPlayer wrappers
  ai.js             # AI strategies (Easy/Medium/Hard); accepts injectable PRNG
  scoreManager.js   # localStorage-backed score load/save/reset; schema validation
  history.js        # Undo/redo move-stack (FR-020)
  match.js          # Match-mode (best-of-N) state machine (FR-022)
  theme.js          # Theme registry, application, persistence (FR-019)
  audio.js          # Web Audio sound effects + mute persistence (FR-021)
  ui/
    menu.js         # Main menu view
    gameView.js     # In-game view (board, turn indicator, controls)
    scoreView.js    # Scoreboard view
    helpView.js     # Help view
    themePicker.js  # Theme picker UI
    modal.js        # Generic modal helper
    toast.js        # Non-blocking notifications
  strings.js        # All user-facing strings (NFR-009)
  utils/
    sanitize.js     # HTML-safe text helpers (TR-007)
    rng.js          # Seedable pseudo-random number generator
styles/
  base.css          # Reset, layout, typography
  components.css    # Buttons, cards, modals, board grid
  themes.css        # [data-theme="beach|mountains|desert"] palettes
assets/
  images/           # Background images (one per theme; small JPG/PNG/SVG)
  symbols/          # SVG symbols for X and O per theme (optional; Unicode fallbacks)
tests/
  board.test.js
  ai.test.js
  scoreManager.test.js
  history.test.js
  match.test.js
  theme.test.js
  audio.test.js
  game.test.js
  ui.test.js        # jsdom-based DOM behaviour tests
package.json
README.md
```

- Dependency direction: `main.js` orchestrates; views import from `game`/`scoreManager`/`theme`/`audio`/etc.; pure modules (`board`, `ai`, `history`, `match`, `scoreManager`) **never** import any `ui/` module or touch the DOM directly.
- No global variables leak to `window`; everything is module-scoped.
- No circular imports.
- All DOM mutations live in `src/ui/`. Pure modules return data only.

---

### TR-004 · AI Algorithm — Hard Mode

**Description:**
The Hard AI shall use the Minimax algorithm with alpha-beta pruning.

**Acceptance Criteria:**
- Minimax recursively evaluates the game tree from the current board state.
- Scoring uses depth-aware values to prefer fast wins and slow losses:
  - AI win: `+10 - depth`
  - Human win: `depth - 10`
  - Draw: `0`
- Alpha-beta pruning is implemented to reduce search.
- Exposed as a single function in `ai.js`:
  `getBestMove(board, aiSymbol, rng = defaultRng) -> number /* cell index 0..8 */`
- The function is side-effect free (does not mutate the input board).
- Tie-break among equally-scored optimal moves: lowest-indexed cell (after the depth-aware score has resolved most ties).
- Hard AI never loses, verified by §6's mandatory tests.

---

### TR-005 · Score Persistence Format

**Description:**
Scores shall be persisted in `localStorage` as a structured, versioned JSON string.

**Acceptance Criteria:**
- Storage key: `tictactoe_scores`.
- JSON schema (v2):
  ```json
  {
    "schema_version": 2,
    "players": {
      "alice": { "display_name": "Alice", "wins": 3, "losses": 1, "draws": 1 },
      "bob":   { "display_name": "Bob",   "wins": 1, "losses": 3, "draws": 1 },
      "ai (hard)": { "display_name": "AI (Hard)", "wins": 5, "losses": 0, "draws": 2 }
    }
  }
  ```
- Player keys are lowercase for case-insensitive lookup; original casing preserved in `display_name`.
- On load, if `schema_version` is absent or unrecognised, the loader attempts a documented migration; if migration is impossible, the user is offered the choice (via toast + scoreboard banner) to reset rather than losing data silently.
- Theme preference is persisted under a separate key `tictactoe_theme` (string: `"beach" | "mountains" | "desert"`).
- Mute preference is persisted under a separate key `tictactoe_muted` (string: `"true" | "false"`).
- Randomness used by the AI is injectable via a seedable PRNG instance (`utils/rng.js`); production code does not set a fixed seed, tests do.

---

### TR-006 · Storage Locations

**Description:**
Persistent data shall live in well-defined `localStorage` keys, all prefixed with `tictactoe_`.

**Acceptance Criteria:**
- Keys used by the application:
  - `tictactoe_scores` — scores JSON (TR-005)
  - `tictactoe_scores_backup` — backup snapshot written immediately before reset (FR-015)
  - `tictactoe_scores_corrupt_backup` — quarantined invalid payload (FR-016)
  - `tictactoe_theme` — current theme
  - `tictactoe_muted` — mute state
- The application never reads or writes any other storage.
- `localStorage` failures are caught; the application degrades to in-memory state per FR-016 / NFR-003.

---

### TR-007 · Input Handling and Sanitisation

**Description:**
All user-supplied input shall be validated and rendered safely to prevent XSS or DOM injection — particularly important since player names persist across sessions and could be rendered after a future code change.

**Acceptance Criteria:**
- All input fields (FR-003) are validated against a whitelist regex on input and on submit.
- All player-supplied strings are rendered to the DOM via `textContent` or via `document.createTextNode` — never via `innerHTML`, never via template literals interpolated into `innerHTML`.
- A reusable `sanitizeName(input)` helper in `utils/sanitize.js` trims, normalises whitespace, and rejects disallowed characters.
- Form submission is blocked while any field is invalid; the submit button reflects this.

---

### TR-008 · Error Handling and Logging

**Description:**
The application shall handle runtime errors gracefully and log diagnostic information to the browser console.

**Acceptance Criteria:**
- All `localStorage`, audio, and image-load operations are wrapped in `try/catch` (or `.catch()` for promises).
- A global `window.addEventListener('error', …)` and `window.addEventListener('unhandledrejection', …)` handler logs the error and displays a non-blocking toast (NFR-003).
- A simple `logger` helper in `utils/` provides `info`, `warn`, `error` methods that write to the console; production builds (a `?debug=1` query string) toggle verbose logging.
- Log output never appears in the visible UI under normal operation.

---

### TR-009 · URL Query-String Options

**Description:**
The application shall recognise a small set of optional query-string parameters for power users and tests.

**Acceptance Criteria:**
- `?debug=1` — enables verbose console logging (TR-008).
- `?theme=beach|mountains|desert` — overrides the persisted theme on load only (does not write to `localStorage`).
- `?seed=<integer>` — seeds the AI PRNG, for reproducible manual playthroughs (does not affect production unseeded behaviour when omitted).
- Unknown parameters are ignored silently.

---

### TR-010 · Version Metadata

**Description:**
The application shall expose a version number from a single authoritative source.

**Acceptance Criteria:**
- A constant `APP_VERSION` is exported from `src/version.js`.
- The version follows Semantic Versioning (`MAJOR.MINOR.PATCH`); v2 begins at `2.0.0`.
- The same value populates the `version` field in `package.json`.
- The footer of every view displays the version in muted text.
- The version is referenced by the score-file `schema_version` migration logic (TR-005) for compatibility decisions.

---

## 6. Testing Requirements

### Test framework and execution

- Framework: **Jest** (latest stable from supported range), configured with `testEnvironment: "jsdom"` for DOM-aware tests and the default node environment for pure-logic tests.
- `npm test` runs the entire suite from the project root with no other configuration.
- `npm test -- --coverage` produces a coverage report; CI-style invocation uses `--coverage --coverageThreshold='{"global":{"branches":90,"functions":90,"lines":90,"statements":90}}'` for the listed pure modules (per NFR-007).
- Tests run without user interaction and without a real browser.
- All AI tests inject a seeded PRNG via the `utils/rng.js` helper to obtain deterministic outcomes.

### Mandatory test coverage

The following test cases are mandatory:

**Board (`tests/board.test.js`)**
- All 8 winning lines are detected for both `X` and `O`.
- A full board with no winner is detected as a draw.
- Move application on an occupied cell is rejected.
- Move application off-board (negative or > 8) is rejected.
- The board's `clone()` (or equivalent) returns an independent copy.

**AI (`tests/ai.test.js`)**
- Easy AI never selects an occupied cell (property test over many seeds).
- Medium AI takes an immediate win when available.
- Medium AI blocks an immediate threat when no immediate win is available.
- Medium AI takes the centre on an empty board.
- Hard AI never loses against a random opponent over many seeds (≥ 200 games).
- Hard AI never loses against an exhaustive opponent enumerating all legal opening sequences (or against a representative sample sufficient to demonstrate optimality).
- Hard AI's first move on an empty board is a corner or centre (i.e., a known optimal opening).
- All AI strategies are deterministic for a given seed.

**Score Manager (`tests/scoreManager.test.js`)**
- Save then reload yields identical data (round-trip).
- A corrupted `localStorage` payload is quarantined and the in-memory store starts empty (FR-016).
- A missing payload yields an empty store with a valid schema.
- Reset clears the store, writes a backup, and preserves `schema_version`.
- AI difficulty entries (`AI (Easy)`, `AI (Medium)`, `AI (Hard)`) are tracked separately.
- Names are case-insensitive on lookup but preserve display casing.

**History (Undo/Redo — `tests/history.test.js`)**
- Undo on an HvH board reverts the last move and the active player.
- Redo re-applies the most recently undone move.
- Making a new move clears the redo stack.
- Undo in HvAI mode reverts both the AI and the human's last move (one logical turn).
- Undo and Redo are no-ops when the corresponding stack is empty.
- Undo cannot revert past the start of the round.
- Undo/redo do not modify the persistent score store.

**Match (`tests/match.test.js`)**
- A best-of-3 match concludes after one player wins 2 rounds, regardless of remaining rounds.
- A best-of-5 ending 2-2-1 (with one draw) is handled correctly.
- A match where draws prevent either side from accumulating a majority ends in a match draw.
- Per-round outcomes are still recorded in the persistent score store (integration with `scoreManager`).
- Single-round mode (default) does not trigger any match-progress UI updates and disposes of match state immediately.

**Theme (`tests/theme.test.js`)**
- Applying a theme sets `data-theme` on the root element to the correct value.
- Switching themes mid-round preserves board state.
- The persisted theme is loaded on init.
- An unknown persisted theme falls back to the default (`beach`).
- Each theme defines unique X and O symbols.

**Audio (`tests/audio.test.js`)**
- The mute toggle persists to `localStorage`.
- When muted, sound-playing functions are no-ops (verified via spy on the AudioContext factory).
- When the Web Audio API is unavailable, audio functions are no-ops and emit no errors.
- Sound playback is gated until the first user gesture.

**Game controller (`tests/game.test.js`)**
- Starting-player rotation alternates across rounds (FR-006).
- Forfeit returns to the main menu without recording a score (FR-008).
- Win and draw outcomes update the score store correctly.
- Round summary stats (move count, duration) are produced.

**UI (`tests/ui.test.js`, jsdom)**
- Clicking an empty cell renders the active player's symbol there.
- Clicking an occupied cell does not change board state and triggers the shake class.
- Pressing Tab moves focus through the cells in row-major order.
- The end-of-round panel renders the correct outcome message.
- The theme picker, when activated, sets `data-theme` accordingly.
- Player names are inserted into the DOM via `textContent` (not `innerHTML`); a test injects an XSS payload as a name and asserts no `<script>` is created (TR-007).
- The `aria-live` turn announcer updates on turn change.

### Coverage gate

- Combined branch coverage on `board`, `ai`, `scoreManager`, `history`, `match`, `theme`, and the pure parts of `game` is **≥ 90%**.
- The pure-logic test files run in the default Jest (node) environment for speed; only `tests/ui.test.js` (and theme DOM tests) use `jsdom`.

---

## 7. Assumptions & Constraints

| #   | Assumption / Constraint                                                                                                                                          |
|-----|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| A1  | The user has a modern desktop or mobile browser per NFR-005.                                                                                                     |
| A2  | `localStorage` is available and writable; if not, the game falls back to in-memory state with a one-time banner (FR-016).                                        |
| A3  | Player names are unique within a session (case-insensitive); FR-003 enforces this.                                                                              |
| A4  | The board size is fixed at 3×3 for v2; the `Board` module is parameterised internally to ease future extension.                                                  |
| A5  | The application is single-tab; concurrent multi-tab access to `localStorage` may produce last-writer-wins behaviour. This is acceptable for v2.                  |
| A6  | The names `AI`, `Computer`, and `AI (Easy/Medium/Hard)` (case-insensitive) are reserved for the system and rejected as human names (FR-003).                     |
| A7  | The `performance.now()` clock is reliable for round-duration measurements (FR-018).                                                                              |
| A8  | Browsers' autoplay policies require a user gesture before audio playback; FR-021 honours this by lazily creating the AudioContext.                               |
| A9  | Background images per theme are small (each ≤ 300 KB) so total page weight stays modest; CSS gradient fallbacks cover image-load failure.                        |
| A10 | The application is opened either via `file://` (double-click) or `http://`/`https://`; both work identically (NFR-005).                                          |

---

## 8. Out of Scope

The following are explicitly **not** delivered in v2:

- **AI vs AI mode** — only HvH and HvAI are supported.
- **Online or networked multiplayer.**
- **User accounts or authentication.**
- **Server-side persistence or syncing across devices.**
- **Custom board sizes** (e.g., 4×4, 5×5) — fixed at 3×3.
- **Custom user-supplied themes.** Only the three built-in themes are selectable.
- **Localisation / internationalisation** — English only; codebase is structured for translation (NFR-009).
- **Animated background scenes or video.** Backgrounds are static images / CSS gradients.
- **Persistence of in-progress matches** — closing the page mid-match abandons it (FR-022).
- **Persistence of round-level statistics** (FR-018's stats block is display-only).
- **Forfeit-as-loss semantics** — forfeits (FR-008) are not recorded.
- **Build tooling, transpilers, or framework runtimes** — vanilla JS only.

---

## 9. Glossary

- **HvH** — Human vs Human local play.
- **HvAI** — Human vs AI play.
- **Round** — A single game played from empty board to win or draw.
- **Match** — A best-of-N sequence of rounds (FR-022).
- **Session** — The period from loading the page to closing/refreshing the tab.
- **Theme** — One of three named visual variants (Beach, Mountains, Desert) controlling background and X/O symbols (FR-019).
- **Minimax** — A recursive decision algorithm for two-player zero-sum games.
- **Alpha-beta pruning** — An optimisation of Minimax that skips branches proven irrelevant.
- **Forfeit** — A player's voluntary mid-round abandonment (FR-008); not recorded as a win/loss.
- **Undo / Redo** — Step-back and step-forward operations within an in-progress round (FR-020).
- **Schema version** — Integer field in the score payload identifying the data-format version, enabling forward-compatible migration (TR-005).
- **Reference machine** — Performance baseline defined in NFR-001.
- **PRNG** — Pseudo-random number generator. Seedable via `utils/rng.js` for deterministic tests.

---

*End of Software Requirements Specification — Tic Tac Toe v2.0 (Web Edition)*
