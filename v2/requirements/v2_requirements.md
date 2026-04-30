# Tic Tac Toe — Software Requirements Specification

**Version:** 2.0 (Web Edition)
**Platform:** Static Web Application — pure HTML5, CSS3, and vanilla JavaScript (ES2020+)
**Distribution:** Single static site, runnable by double-clicking `index.html` (file:// protocol) or by serving via any static web host
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

This document specifies the requirements for **version 2.0** of the Tic Tac Toe application. V2 re-platforms the v1 console game into a **browser-based, single-page web application** built entirely with static assets (HTML, CSS, JavaScript) — no server, no build tools, and no third-party runtime frameworks. The user opens `index.html` in any modern browser (Chrome, Firefox, Edge, or Safari) — including by double-clicking the file from the file system — and the entire game runs client-side.

The game retains v1's gameplay essentials — two play modes (Human vs Human, Human vs AI), three AI difficulty levels (Easy, Medium, Hard / Minimax), persistent scores, replay flow, and graceful exit — but adapts every interaction to a graphical browser context using mouse, touch, and keyboard input.

**New in V2 (high level):**

- **Web UI** replacing the terminal interface (FR-W01 onward).
- **Three selectable visual themes** — *Beach*, *Mountains*, *Desert* — each with its own full-screen background image and unique X/O symbols (FR-W02).
- **Three brand-new gameplay/UX features** not present in v1 (FR-W20, FR-W21, FR-W22 — see §2.4 below).

**Target Audience:** Casual players who prefer a polished visual experience over a terminal, on desktop or mobile browsers.

**Out-of-scope reminders (see §8):** real-time online multiplayer, server-side accounts, native mobile apps, custom board sizes (still 3×3), localisation beyond English.

---

## 2. Functional Requirements

The functional requirements are organised into four groups:
- **§2.1 — Carried-over gameplay requirements** (adapted from v1).
- **§2.2 — Web-platform requirements** (new structural requirements for the browser).
- **§2.3 — Theme system requirements** (the three-theme requirement).
- **§2.4 — Three new gameplay/UX features** (additional V2 enhancements).

### 2.1 Gameplay Requirements (Carried Over and Adapted)

#### FR-001 · Main Menu and Game Mode Selection

**Description:**
On application load, and whenever the user navigates back to the main menu, the system shall display a graphical main menu allowing the user to choose a game mode or system action.

**Acceptance Criteria:**
- The main menu displays clickable buttons (each also keyboard-focusable and `Enter`-activatable) for:
  1. **Human vs Human**
  2. **Human vs AI**
  3. **View Scores**
  4. **Reset Scores**
  5. **Help / Instructions**
  6. **Theme: [current theme]** (opens the theme picker, FR-W02)
- Selecting **Human vs Human** opens the player-name entry screen (FR-003).
- Selecting **Human vs AI** opens AI difficulty selection (FR-002), then player-name entry.
- Selecting **View Scores** displays the cumulative scoreboard (FR-014) and offers a "Back" control.
- Selecting **Reset Scores** triggers the score-reset flow (FR-015).
- Selecting **Help** opens the help panel (UI-006).
- The current theme is visibly indicated on the menu and applied on initial load.
- A "Quit" option is **not** required (browsers do not allow programmatic tab closure); instead, the menu is the application root and may be revisited freely.

---

#### FR-002 · AI Difficulty Selection

**Description:**
When Human vs AI mode is selected, the system shall allow the player to choose one of three AI difficulty levels.

**Acceptance Criteria:**
- A panel displays three buttons:
  - **Easy** — random moves
  - **Medium** — heuristic (win / block / centre / corner / random)
  - **Hard** — unbeatable (Minimax)
- Each button has a one-sentence description below it.
- Selection is confirmed visually (button highlights as selected) and the chosen difficulty governs all AI moves until the user returns to the main menu.
- A "Back" control returns to the main menu without starting a game.

---

#### FR-003 · Player Name Entry and Validation

**Description:**
Before a game begins, the system shall prompt human players for display names via HTML text inputs and validate them.

**Acceptance Criteria:**
- HvH mode shows two labelled text inputs: "Player 1 (X)" and "Player 2 (O)".
- HvAI mode shows one text input for the human player; the AI is auto-labelled by difficulty (`AI (Easy)` / `AI (Medium)` / `AI (Hard)`).
- Names must be **1–20 characters** after trimming whitespace.
- Allowed characters: alphanumerics, spaces, hyphens (`-`), and underscores (`_`). The input field enforces this via a `pattern` attribute and JS validation; rejected characters trigger an inline error below the field.
- Leading/trailing whitespace is stripped before validation.
- Empty input is rejected with the inline error: `"Please enter a name (1–20 characters)."` Pressing Enter on an empty field accepts the default `"Player 1"` / `"Player 2"`.
- Reserved names — `AI`, `Computer`, `AI (Easy)`, `AI (Medium)`, `AI (Hard)` (case-insensitive) — are rejected with: `"That name is reserved. Please choose another."`
- In HvH mode, both players cannot share the same name (case-insensitive); duplicates trigger an inline error on the second field.
- If a name (case-insensitive) already exists in stored scores, the player's history is reused.
- A **Start Game** button is enabled only when all fields validate.

---

#### FR-004 · Board Initialisation

**Description:**
At the start of every new round, the system shall render a clean 3×3 graphical game board with all cells empty.

**Acceptance Criteria:**
- The board is rendered as a 3×3 grid of clickable/tappable cells using HTML elements (e.g., `<button>` cells inside a CSS Grid container).
- All 9 cells are unoccupied at round start.
- Cells are addressable by index `0–8` internally and by row/column visually; the 1–9 numeric scheme remains supported via keyboard shortcuts (FR-W04).
- Board state from any previous round does not persist into the new round.

---

#### FR-005 · Turn Management

**Description:**
The system shall alternate turns between the two players (or human and AI), enforcing that the player holding the first-move privilege for the current round plays `X` and moves first.

**Acceptance Criteria:**
- Within a round, after each valid move the active player switches; a player cannot move twice consecutively.
- The current player's name and symbol are clearly displayed in a turn-indicator panel above or beside the board (UI-003).
- In HvAI mode, the AI's turn advances automatically with a brief animated "thinking" indicator (UI-003).
- The first-move privilege for the round is determined by FR-006.

---

#### FR-006 · Starting-Player Fairness Across Rounds

**Description:**
To avoid the systematic first-move advantage skewing scoreboard results, the player who moves first shall alternate between rounds.

**Acceptance Criteria:**
- Round 1 of a fresh game configuration: Player 1 / the human plays `X` and moves first.
- Each subsequent "Play Again" round (FR-017) flips the starting player.
- The `X`/`O` symbol allocation always follows the first-mover for the round.
- Returning to the main menu and starting a new game configuration resets the rotation.
- The starting player and symbol assignment are announced visually before the first move of each round.
- The scoreboard always identifies players by name, never by symbol.

---

#### FR-007 · Human Player Move Input

**Description:**
On a human player's turn, the system shall accept a cell selection via mouse/touch click on the cell or via keyboard, validate it, and apply it to the board.

**Acceptance Criteria:**
- Clicking/tapping an empty cell places the active player's symbol and advances the game.
- Clicking an already-occupied cell produces no move and shows a brief shake animation on the cell plus an aria-live polite message: `"Cell is already taken — choose an empty cell."`
- Clicking outside the cells (e.g., on the board background) does nothing.
- Keyboard input is fully supported (FR-W04): keys `1`–`9` map to cells (left-to-right, top-to-bottom); arrow keys move keyboard focus between cells; `Enter`/`Space` places a move on the focused cell.
- It is impossible to place a move during the AI's turn (cells are non-interactive while AI is thinking).

---

#### FR-008 · Mid-Round Forfeit / Abandon

**Description:**
A human player shall be able to abandon the current round mid-game and return to the main menu without crashing the application.

**Acceptance Criteria:**
- A **Forfeit Round** button is visible during gameplay.
- Clicking it shows a modal confirmation: `"Forfeit this round? Your progress will not be saved as a win or loss."` with **Yes, Forfeit** and **Cancel** buttons.
- On confirmation, the round ends immediately. Forfeits are **not** recorded as a win/loss (consistent with v1).
- After confirmation, the user is returned to the main menu.
- Cancelling the modal returns the user to the same board state with no changes.
- The button is disabled (greyed-out, `aria-disabled="true"`) while the AI is thinking.
- Pressing the `Esc` key opens the same forfeit-confirm modal.

---

#### FR-009 · AI Move — Easy Difficulty

**Description:**
On Easy difficulty, the AI shall select its move uniformly at random from all available cells.

**Acceptance Criteria:**
- The AI never selects an occupied cell.
- Move selection has no strategic bias; any empty cell is equally probable.
- The chosen move is rendered with the same animation as a human move (FR-W05) and briefly highlighted.
- AI move computation completes within 200 ms; the visible "thinking" delay is artificial and capped (UI-003).
- The randomness source is injectable to support deterministic unit tests (TR-005).

---

#### FR-010 · AI Move — Medium Difficulty

**Description:**
On Medium difficulty, the AI shall apply the v1 deterministic priority-ordered heuristic.

**Acceptance Criteria:**
- The AI evaluates priorities in this strict order and plays the first applicable move:
  1. **Win** — take an immediate winning move if available.
  2. **Block** — block an opponent's immediate winning move.
  3. **Centre** — take cell index 4 (centre) if empty.
  4. **Opposite corner** — if the opponent occupies a corner and the diagonally opposite corner is empty, take it.
  5. **Empty corner** — take any empty corner.
  6. **Random** — otherwise pick any remaining empty cell at random.
- The AI never selects an occupied cell.
- AI move computation completes within 200 ms (NFR-001).

---

#### FR-011 · AI Move — Hard Difficulty

**Description:**
On Hard difficulty, the AI shall play optimally using the Minimax algorithm and shall be unbeatable.

**Acceptance Criteria:**
- The AI always selects the move with the highest Minimax score.
- A perfect human can force at most a draw; the AI never loses.
- Tie-break rules: prefer fastest win (or slowest loss); secondary tie-break is lowest cell index.
- AI move computation completes within 200 ms in the browser on the reference device (NFR-001).
- See TR-004 for algorithmic details. The function is side-effect-free and accepts an injectable RNG for tests.

---

#### FR-012 · Win Detection

**Description:**
After every move, the system shall check whether the current player has won by occupying three cells in a winning line.

**Acceptance Criteria:**
- All 8 winning lines are evaluated: 3 rows, 3 columns, 2 diagonals.
- A win is detected immediately after the move that completes the line.
- On detection, the round ends; further input is blocked.
- The winning cells are visually distinguished by:
  - A colour/glow effect (theme-dependent — see FR-W02), AND
  - A non-colour textual or shape indicator (e.g., the cells receive a `winning` CSS class that draws an outline or strike-through line) so the win is conveyed without colour (NFR-008).
- An animated line is drawn through the three winning cells (FR-W05).
- The winner's name and symbol are announced (UI-006).
- The win is recorded in the score tracker (FR-014) and persisted (FR-016).

---

#### FR-013 · Draw Detection

**Description:**
After every move, if no winning condition is met and no empty cells remain, the system shall declare a draw.

**Acceptance Criteria:**
- A draw is declared when all 9 cells are filled with no winner.
- The message `"It's a draw! Well played by both sides."` is displayed (UI-006).
- The draw is recorded in the score tracker (FR-014) and persisted (FR-016).

---

#### FR-014 · Score Tracking

**Description:**
The system shall maintain a running record for each named player across all rounds in the current session and across sessions (via persistence — FR-016).

**Acceptance Criteria:**
- Each player record tracks: **wins**, **losses**, **draws**. Games-played is the sum.
- Scores are updated immediately after each round outcome; forfeits are not recorded.
- Score data is keyed by lowercased player name; the original-casing display name is stored alongside.
- Scores from prior browser sessions (loaded from `localStorage`) continue to accumulate.
- AI records are split by difficulty: separate entries for `AI (Easy)`, `AI (Medium)`, `AI (Hard)`.
- HvH rounds are tracked per individual player name.

---

#### FR-015 · Score Reset

**Description:**
The user shall have an explicit, confirmed mechanism to clear all persisted score data.

**Acceptance Criteria:**
- The **Reset Scores** option in the main menu (FR-001) triggers this flow.
- A modal confirmation displays: `"This will permanently delete all scores. Are you sure?"` with **Delete All** and **Cancel** buttons.
- On confirm, both the in-memory score store AND the `localStorage` entry are cleared (replaced with an empty schema, preserving the schema version).
- A backup of the previous data is written to a separate `localStorage` key (`tictactoe.scores.bak`) immediately before deletion.
- On cancel, no change occurs and the menu re-displays.
- In-memory and persisted state remain in sync at all times.

---

#### FR-016 · Score Persistence

**Description:**
Player scores shall be saved to browser `localStorage` after every round so they survive page reloads, tab closes, and browser restarts.

**Acceptance Criteria:**
- Scores are written to `localStorage` under the key `tictactoe.scores.v2`.
- The data is written after every completed round (win or draw) and on the `beforeunload` and `visibilitychange` events.
- On page load, if the key exists and parses as valid JSON matching the schema, scores are loaded automatically.
- If the stored value is missing, scores start empty.
- If the stored value is corrupt (invalid JSON or schema-invalid), the corrupt value is moved to `tictactoe.scores.v2.bak`, a non-blocking warning toast is shown (`"Saved scores were corrupted and have been backed up. Starting fresh."`), and the session begins with empty scores.
- Schema validation on load checks: required fields present, numeric counters non-negative, `schema_version` recognised.
- If `localStorage` is unavailable (e.g., disabled, full, private-browsing in Safari), the game falls back to an in-memory store and shows a non-blocking warning: `"Scores will not be saved (browser storage unavailable)."` Gameplay is unaffected.
- See TR-005 for schema.

---

#### FR-017 · Replay Option

**Description:**
After each completed round, the system shall offer the players options for what to do next.

**Acceptance Criteria:**
- A panel displays three buttons:
  - **Play Again** (same settings; starts a new round with starting-player rotation per FR-006)
  - **Main Menu** (returns to FR-001 to change mode/difficulty/players)
  - **View Scoreboard** (opens the cumulative scoreboard, then returns to this panel)
- The panel appears after the round-summary display (FR-018).

---

#### FR-018 · Round Summary

**Description:**
After a win or draw, the system shall display a round summary before the replay prompt.

**Acceptance Criteria:**
- The final board state is shown with the winning line highlighted (FR-012), or with a "Draw" overlay.
- The outcome is clearly announced (winner name + symbol, or draw message).
- The current cumulative scoreboard for the participants is displayed inline (FR-014).
- A small stats block is shown for the round (display only; not persisted):
  - Total moves played.
  - Wall-clock duration (mm:ss).
  - For HvAI rounds, average AI move computation time in milliseconds.
- The replay prompt (FR-017) follows immediately below.

---

#### FR-019 · Graceful Application Exit / Page Unload

**Description:**
The user shall be able to leave the application cleanly with scores preserved, regardless of how the page is closed.

**Acceptance Criteria:**
- On the `beforeunload` and `pagehide` events, the latest in-memory scores are flushed synchronously to `localStorage`.
- If a round is mid-flight when the page is closed, the round is discarded (no score change), consistent with the v1 forfeit-not-recorded rule.
- No confirmation dialog is shown on unload (browsers heavily restrict these).
- The game does not register listeners that would prevent normal browser navigation away from the page.

---

### 2.2 Web-Platform Requirements (New)

#### FR-W01 · Single-File-Openable Static Web App

**Description:**
The application shall run entirely client-side from a static file system, openable by double-clicking `index.html` in any modern browser without any local server.

**Acceptance Criteria:**
- The application loads and runs correctly when opened via the `file://` protocol (i.e., double-clicking `index.html`).
- No `fetch()`, `XMLHttpRequest`, or dynamic `import()` calls require an HTTP server. (Static `<script src="...">` and `<link rel="stylesheet" href="...">` references to local relative paths are permitted.)
- All assets (HTML, CSS, JS, images) are bundled in a single project folder using relative paths only — no absolute or `http(s)://` references for game assets.
- The app works in the latest two stable releases of Chrome, Firefox, Edge, and Safari.
- A `README.md` in the project root explains: how to run (double-click `index.html`), supported browsers, and the project layout.

---

#### FR-W04 · Keyboard and Touch Input Support

**Description:**
All gameplay interactions shall be operable via mouse, touchscreen, and keyboard.

**Acceptance Criteria:**
- Number keys `1`–`9` place a move on the corresponding cell during a human's turn (top-left = `1`, bottom-right = `9`).
- Arrow keys (`Left`/`Right`/`Up`/`Down`) move keyboard focus between board cells.
- `Enter` or `Space` plays a move on the focused cell.
- `Esc` opens the forfeit-confirm modal during gameplay (FR-008).
- All menu buttons are reachable via `Tab`, with a visible focus outline.
- Tap targets on the board are at least 44×44 CSS pixels at default zoom (mobile-friendly).

---

#### FR-W05 · Animations and Visual Feedback

**Description:**
Significant gameplay events shall be accompanied by short, smooth visual animations that reinforce game state without delaying interaction.

**Acceptance Criteria:**
- Symbol placement: each `X` or `O` fades/scales in over 150–250 ms on placement.
- Hover state: empty cells show a faint preview of the active player's symbol on mouse hover (desktop only).
- Winning line: an SVG (or CSS) line is drawn through the three winning cells over ~400 ms.
- Cell-already-taken feedback: a brief horizontal shake animation (~250 ms) on the rejected cell.
- Animations respect the `prefers-reduced-motion` media query: when set, all transitions and animations are reduced to instantaneous transitions or fades ≤ 50 ms (NFR-008).

---

### 2.3 Theme System Requirements (New — Mandatory)

#### FR-W02 · Three Selectable Visual Themes — Beach, Mountains, Desert

**Description:**
The application shall provide exactly three pre-built visual themes — **Beach**, **Mountains**, and **Desert** — selectable from a theme picker. Each theme defines its own full-screen background, colour palette, and unique X/O symbols.

**Acceptance Criteria:**

- A **Theme Picker** is reachable from the main menu (FR-001) and from a persistent theme button visible in the top corner of every screen.
- The picker displays the three themes side-by-side as preview cards (each card shows a thumbnail of the background and the X/O symbols of that theme).
- Clicking a theme card applies the theme **immediately** without a page reload and closes the picker.
- The selected theme is persisted in `localStorage` under the key `tictactoe.theme` and restored on next page load.
- **Default theme** on first run is **Beach**.
- Each theme defines:

  | Theme     | Background                                                       | X symbol                             | O symbol                              | Accent palette                       |
  |-----------|------------------------------------------------------------------|--------------------------------------|---------------------------------------|--------------------------------------|
  | Beach     | Sandy beach with ocean horizon (image or CSS gradient + SVG)     | A starfish (🌟 or custom SVG)         | A beach ball / life ring (custom SVG) | Sand-tan / ocean-blue / coral        |
  | Mountains | Snow-capped mountain range with pine silhouettes (image or SVG)  | A pine tree (custom SVG)             | A snowflake (custom SVG)              | Forest-green / snow-white / slate    |
  | Desert    | Desert dunes with sun and cacti silhouettes (image or SVG)       | A cactus (custom SVG)                | A sun (custom SVG)                    | Sand-orange / terracotta / sky-blue  |

- Symbols are implemented as **inline SVG** (preferred) or as background images, sized to fit cleanly within a board cell (at least 60% of cell area, never overflowing).
- The X-vs-O distinction must remain unambiguous in every theme: the two symbols must differ in shape (not just colour), per NFR-008.
- Theme assets (images, SVGs, fonts if any) are stored in `assets/themes/<theme-name>/` and referenced by relative path.
- Switching theme mid-game is supported; gameplay state (board, turn, scores) is preserved.
- Each theme defines its CSS via a single namespaced class (e.g., `<body class="theme-beach">`) with all theme-specific colours scoped via CSS custom properties (e.g., `--bg-image`, `--accent-color`, `--symbol-x-url`).
- The currently active theme name is announced to assistive technology via an `aria-live` region on change (e.g., `"Theme changed to Mountains."`).

---

### 2.4 Three New V2 Features (Beyond V1)

The following three features are **net-new** to V2 and are not present in v1. Each is justified by a one-line rationale.

#### FR-W20 · Move History with Undo (NEW)

> **Rationale:** Web UIs make it cheap and natural to expose a per-move history; an undo affordance dramatically lowers friction for casual play and accidental misclicks, leveraging in-memory state with no backend.

**Description:**
The system shall maintain an in-memory move history for the current round and shall allow the human player(s) to **undo** the most recent move.

**Acceptance Criteria:**
- Each move (human or AI) is appended to a per-round history stack containing `{cellIndex, symbol, playerName, timestamp}`.
- An **Undo** button is visible on the gameplay screen.
- In **HvH** mode, clicking Undo reverts the last move and switches the turn back to the player who just moved.
- In **HvAI** mode, clicking Undo reverts **two** moves (the AI's last move plus the human's preceding move), so the human is returned to their decision point.
- Undo is disabled (greyed out, `aria-disabled="true"`) when:
  - The history is empty (no moves yet this round).
  - The round has already ended (win or draw detected).
  - The AI is currently thinking.
- Undo is **purely a within-round affordance**: it does not affect persisted scores (a round can only finish once, by win or draw).
- A keyboard shortcut `Ctrl+Z` (or `Cmd+Z` on macOS) triggers Undo.
- A round summary (FR-018) shows the move count; undone moves do not inflate the count (the history is the source of truth for "moves played").

---

#### FR-W21 · Sound Effects with Mute Toggle (NEW)

> **Rationale:** Audio cues meaningfully enhance the feel of a graphical game and are trivially implementable via the browser Web Audio API or HTML5 `<audio>` — with no backend — while a mute toggle preserves the v1 ethos that core gameplay never depends on a single sensory channel.

**Description:**
The application shall play short sound effects for key gameplay events and shall provide a persistent mute/unmute control.

**Acceptance Criteria:**
- Distinct, short (≤ 500 ms) sound effects play on:
  - Move placed (a soft click/pop).
  - Round won (a brief celebratory chime).
  - Round drawn (a neutral tone).
  - Invalid move attempted (a soft buzzer).
- A **mute toggle button** is visible in the top corner of every screen (alongside the theme button).
- The mute state is persisted in `localStorage` under the key `tictactoe.muted` (boolean).
- **Default is muted on first run** to respect users opening the page unexpectedly.
- The mute button shows a clear icon for both states (e.g., 🔊 vs 🔇) plus an `aria-label` ("Mute sound" / "Unmute sound").
- Sound assets are stored in `assets/sounds/` as `.mp3` or `.ogg`/`.wav` files (≤ 50 KB each total) referenced by relative path.
- Sound playback errors (e.g., autoplay-policy block) are caught and logged to the JS console but never disrupt gameplay.
- Sound effects are **shared across all themes** in V2 (per-theme sound is out of scope for V2).

---

#### FR-W22 · In-Game Stats Dashboard (NEW)

> **Rationale:** With persistent scores already in `localStorage`, a richer stats view is a small UI addition that adds substantial replay value — surfacing per-difficulty win rates, streaks, and head-to-head HvH records that v1's flat scoreboard could not show.

**Description:**
The application shall provide a **Stats Dashboard** screen accessible from the main menu, presenting aggregate gameplay analytics derived from the persisted score data plus extra computed metrics.

**Acceptance Criteria:**
- A **Stats Dashboard** entry is reachable from the main menu (it can replace or live alongside the basic "View Scores" option from FR-001).
- The dashboard displays at minimum:
  - **Per-player overview table** — name, wins, losses, draws, total games, **win rate %**.
  - **Current streak** per player (e.g., "Alice — W3" meaning three wins in a row, or "Bob — L2"). Streaks are computed from a per-player rolling outcome list maintained in the persisted store (extending the schema in TR-005).
  - **Best streak ever** per player (longest historical winning streak).
  - **Head-to-head summary** — for each pair of opponents who have played at least one round together, a row showing `Player A vs Player B: A-wins / draws / B-wins`. Pairs include `Human vs AI (Hard)`, etc.
  - **Aggregate session stats** — total rounds played all-time, total draws, average game duration (only for rounds whose duration was recorded in the current session — ephemeral fallback to "—" for historical rounds).
- The dashboard is sortable: clicking a table header sorts the per-player overview by that column (ascending/descending toggle).
- An "Empty state" message is shown if no rounds have ever been played: `"No games played yet — finish a round to see your stats."`
- A **Back** button returns to the main menu.
- Schema migration: when a v1-style `localStorage` payload is found (no streak/h2h fields), it is migrated forward by initialising streak fields to zero and head-to-head records to empty; the migrated payload is re-saved (TR-005).

---

## 3. Non-Functional Requirements

### NFR-001 · Performance

**Description:**
The application shall remain responsive on standard consumer hardware and on mobile devices.

**Acceptance Criteria:**
- **Reference device:** mid-range laptop with dual-core 2 GHz CPU, 4 GB RAM, latest Chrome; or mid-range smartphone (≥ 2018) with current OS.
- Initial page load (HTML + CSS + JS + theme assets) parses and renders the main menu within **2 seconds** on the reference device over local file system.
- All UI interactions (button clicks, menu transitions, cell clicks) produce a visible response within **100 ms**.
- Easy and Medium AI moves complete computation within **200 ms**.
- Hard AI (Minimax with alpha-beta pruning) computes within **200 ms**.
- Score writes to `localStorage` complete within **50 ms** (synchronous API).
- Animations run at ≥ 30 FPS on the reference device; no animation blocks user input.
- No unbounded memory growth across 100+ rounds in a single session.

---

### NFR-002 · Usability

**Description:**
The game shall be intuitive for a first-time user without external documentation.

**Acceptance Criteria:**
- The main menu, gameplay screen, and theme picker are usable without consulting `README.md`.
- All buttons have descriptive text labels (icons alone are never the sole affordance, except for the mute and theme buttons which carry both an icon and an `aria-label`).
- Error messages are specific, human-readable, and actionable.
- Cell numbering (`1`–`9`) is shown via a tooltip on hover and in the help screen.
- A first-time user can start and complete a game without assistance.
- Informal usability gate: 5 of 5 first-time test users complete a round without assistance.

---

### NFR-003 · Reliability and Error Handling

**Description:**
The application shall handle invalid input, storage failures, and unexpected JavaScript errors without crashing the page.

**Acceptance Criteria:**
- A global `window.onerror` handler catches uncaught exceptions, logs them to the console, and shows a non-blocking toast: `"Something went wrong. The current round has been reset."` The user is returned to the main menu.
- All `localStorage` access is wrapped in `try/catch`; failures are caught and surfaced via the storage-unavailable warning (FR-016).
- Invalid input on text fields is rejected inline; no exception ever reaches the console under normal use.
- Closing the tab or navigating away never corrupts the score store (atomic full-payload write per TR-005).

---

### NFR-004 · Maintainability

**Description:**
The codebase shall be modular and easy to extend.

**Acceptance Criteria:**
- Code is organised into the modules defined in TR-003.
- Public functions and classes carry JSDoc comments describing parameters, return values, and side effects.
- The codebase passes `eslint` (recommended config) with zero errors.
- No single function exceeds 50 lines; no source file exceeds 500 lines.
- Adding a new AI difficulty requires changes only inside the `ai.js` module.
- Adding a new theme requires only:
  1. A new folder under `assets/themes/<name>/`.
  2. A new CSS class block in `themes.css` (or an additional `<theme>.css`).
  3. A new entry in the themes registry array in `themes.js`.
  No changes to game logic are required to add a theme.
- A `README.md` documents installation, run instructions, and project layout.

---

### NFR-005 · Browser Compatibility and Portability

**Description:**
The application shall run on Windows, macOS, Linux, iOS, and Android using any modern browser without modification.

**Acceptance Criteria:**
- Supported browsers: latest two stable releases of **Chrome**, **Firefox**, **Edge**, **Safari** (desktop and mobile).
- The app uses only ECMAScript 2020 features that are universally supported across the above browsers (no transpilation required).
- The app uses only platform-standard Web APIs: DOM, `localStorage`, Web Audio API (or HTML5 `<audio>`), CSS3, SVG.
- No third-party JavaScript runtime libraries are bundled (no React, Vue, jQuery, etc.).
- The single permitted exception is **dev-time** Jest + jsdom (Testing Requirements, §6) — these are never loaded in the runtime page.
- All paths are relative; the app runs identically from `file://` and from any static HTTP server.

---

### NFR-006 · Data Integrity

**Description:**
The score store shall not be corrupted by partial writes or unexpected page unload.

**Acceptance Criteria:**
- All score updates use the **full-payload write** pattern: serialise the entire scores object to JSON, then assign once to `localStorage.setItem(...)`. There is no partial-state intermediate.
- The `schema_version` field is always present and validated on load.
- The score store contains no executable code — only player names and integer counters.
- On detected corruption, the corrupt payload is preserved at `tictactoe.scores.v2.bak` for one cycle (overwritten on the next corruption, never accumulated unboundedly).

---

### NFR-007 · Testability

**Description:**
Core game logic shall be unit-testable in isolation.

**Acceptance Criteria:**
- Win detection, draw detection, move validation, AI move selection, score persistence, and theme registry lookups are pure functions or testable methods reachable without the DOM.
- The test suite uses **Jest** with **jsdom** environment for any DOM-dependent tests.
- Tests run via `npm test` from the project root.
- Branch coverage on the `board.js`, `ai.js`, `scoreManager.js`, and `themes.js` modules is **≥ 90%**, verified by Jest's `--coverage` flag.
- Mandatory test cases are detailed in §6.
- Randomised AI behaviour is seedable via an injectable RNG (TR-005) for reproducible tests.

---

### NFR-008 · Accessibility

**Description:**
The UI shall meet baseline accessibility standards and shall not rely on colour alone to convey information.

**Acceptance Criteria:**
- All interactive elements are reachable via keyboard (FR-W04) with a visible focus outline.
- Player symbols `X` and `O` (or their themed equivalents) are distinguishable by **shape**, not only by colour.
- Win/draw messages convey their meaning via text.
- The winning line is communicated by both a colour effect and a non-colour cue (e.g., a CSS outline / strike line — FR-012).
- Form fields have associated `<label>` elements; buttons have descriptive `aria-label` attributes when their visible text is an icon.
- An `aria-live="polite"` region announces gameplay events: turn changes, invalid moves, win/draw, theme changes.
- The application respects `prefers-reduced-motion` (FR-W05).
- The application respects `prefers-color-scheme` only insofar as the active theme tolerates it; explicit theme choice always overrides.
- Colour contrast for all text on theme backgrounds meets WCAG 2.1 AA (≥ 4.5:1 for body text, ≥ 3:1 for large text). A semi-transparent overlay panel is used behind text content where the raw background image would fail this check.

---

### NFR-009 · Localisation Readiness

**Description:**
While V2 ships in English only, the codebase shall be structured to allow translation later without refactoring.

**Acceptance Criteria:**
- All user-facing strings live in a single module/object (e.g., `strings.js` exporting `STRINGS.en`); no English strings appear inline in logic code.
- Formatted strings use named placeholder substitution (e.g., `format(STRINGS.en.winMessage, { name, symbol })`) — no positional concatenation that assumes English word order.
- This is a soft requirement; no actual translations are delivered for V2.

---

## 4. User Interface Requirements

### UI-001 · Main Menu Display

**Description:**
The application shall display a clean, themed main menu on load and whenever the user returns to it.

**Acceptance Criteria:**
- The main menu shows the title `TIC TAC TOE` prominently at the top in a stylised heading.
- A row of large, tappable buttons (FR-001) is centred on the screen.
- A header bar displays:
  - Current theme indicator (clickable → theme picker, FR-W02).
  - Mute toggle (FR-W21).
- A footer/sidebar shows the current top scores summary (top 3 players by wins) for context.
- The current theme's background image fills the viewport behind a semi-transparent panel that hosts the menu controls (NFR-008 contrast).

---

### UI-002 · Board Rendering

**Description:**
The game board shall be rendered as a clearly readable 3×3 grid using CSS Grid.

**Acceptance Criteria:**
- The board is a `<div role="grid">` containing nine `<button role="gridcell">` elements.
- Each cell displays either the active player's themed symbol (FR-W02) or, when empty, a faint position number `1`–`9` shown only on focus/hover (legend behaviour).
- The grid uses CSS `grid-template-columns: repeat(3, 1fr)` with crisp dividers (1–2 px borders or theme-styled lines).
- The board reflows responsively: it is centred, sized to fit the viewport, and never larger than 80% of the shorter viewport dimension on desktop or 90% on mobile.
- Cell contents are vertically and horizontally centred.

---

### UI-003 · Turn Indicator

**Description:**
Before each move, the system shall clearly indicate whose turn it is.

**Acceptance Criteria:**
- A turn-indicator panel above (or to the side of) the board shows: `"<Player Name>'s turn"` plus the player's themed symbol.
- The panel highlights (e.g., with a coloured border or glow) the active player.
- In HvAI mode, when the AI is thinking, the panel changes to: `"AI is thinking..."` with a small spinner.
- The "thinking" delay is artificial and bounded: at most ~600 ms, only added when the actual computation is faster than that. AI cells become non-interactive during this period.

---

### UI-004 · Input Feedback

**Description:**
All user inputs shall produce immediate visual feedback.

**Acceptance Criteria:**
- Hovering an empty cell on a desktop browser shows a faint preview of the active player's symbol (FR-W05).
- Clicking an empty cell places the symbol with a fade-in animation.
- Clicking an occupied cell triggers the cell-shake animation (FR-W05) and an `aria-live` polite message.
- All button presses produce a brief visual depression / colour change.

---

### UI-005 · Invalid Input Feedback

**Description:**
All invalid inputs shall produce immediate, descriptive inline error messages or visual cues.

**Acceptance Criteria:**
- Already-occupied cell click: shake animation plus `aria-live` message `"Cell is already taken — choose an empty cell."`
- Invalid name in the name-entry form: an inline error appears below the field with a specific reason ("Name too long", "Name contains invalid characters", "That name is reserved", etc.).
- Errors clear automatically once the user corrects the input.

---

### UI-006 · Game Result Announcement

**Description:**
The outcome of each round shall be announced with a prominent, visually distinct message and an animated overlay.

**Acceptance Criteria:**
- Win: a centred overlay shows `"🎉 <Player Name> wins!"` with the winning themed symbol; the winning line is drawn through the three winning cells (FR-012).
- Draw: a centred overlay shows `"It's a draw! Well played by both sides."`
- The overlay does not block the board from view (it is positioned above the board with a semi-transparent backdrop).
- The overlay includes a **Continue** button that dismisses it and reveals the round-summary panel (FR-018) with the replay options.
- The result is also announced via the `aria-live="polite"` region (NFR-008).

---

### UI-007 · Scoreboard Display / Stats Dashboard

**Description:**
Scoreboard and stats views shall be formatted for easy reading on any screen size.

**Acceptance Criteria:**
- Scores are presented in an HTML `<table>` with a header row.
- Columns for the basic scoreboard: `Player`, `Wins`, `Losses`, `Draws`, `Played`.
- Default sort: descending by wins; secondary by fewer losses; tertiary alphabetical by name.
- The Stats Dashboard (FR-W22) extends this with `Win Rate %`, `Current Streak`, `Best Streak`, plus the head-to-head and aggregate sections.
- Tables are horizontally scrollable on narrow viewports rather than overflowing.
- An "Empty state" message is shown when no scores exist.

---

### UI-008 · Help / Instructions Screen

**Description:**
A help screen shall be accessible from the main menu and shall describe gameplay in plain language.

**Acceptance Criteria:**
- Reachable from main-menu (FR-001 option 5).
- Contents include: rules of Tic Tac Toe, the cell-numbering convention `1`–`9`, descriptions of the three AI difficulty levels, the mid-round forfeit shortcut (FR-008 / `Esc`), keyboard controls (FR-W04), undo behaviour (FR-W20), how to switch themes (FR-W02), and how to mute (FR-W21).
- A **Close** button returns the user to the main menu.
- The screen is keyboard-navigable; `Esc` closes it.

---

### UI-009 · Theme Picker UI

**Description:**
The theme picker shall present the three themes with previews and apply a chosen theme instantly.

**Acceptance Criteria:**
- Opens as a modal overlay or dedicated panel reachable from the main menu and from the persistent header theme button.
- Three theme cards arranged horizontally on desktop, vertically on narrow mobile viewports.
- Each card shows: theme name, a thumbnail image of the background, and a small inline display of the X/O symbols.
- Clicking/tapping a card applies the theme immediately, persists the choice (FR-W02), and closes the picker.
- The currently active theme card is visually marked as selected (e.g., border highlight + checkmark).

---

### UI-010 · Responsive Layout

**Description:**
The UI shall adapt smoothly to a range of viewport sizes from ~320 px wide (small phones) to ≥ 1920 px (large desktops).

**Acceptance Criteria:**
- A CSS-based responsive layout (Flexbox + Grid + media queries) reorganises menu and gameplay screens at breakpoints (e.g., 480 px, 768 px, 1024 px).
- The board scales proportionally to the viewport (UI-002).
- No horizontal scrolling appears at any supported viewport width.
- Touch targets are at least 44×44 CSS pixels (FR-W04).
- The theme picker becomes single-column below 600 px width.

---

## 5. Technical Requirements

### TR-001 · Languages and Runtime

**Description:**
The game shall be implemented with vanilla web technologies only.

**Acceptance Criteria:**
- HTML5 for markup.
- CSS3 (including Custom Properties and Grid) for styling.
- JavaScript ES2020 (vanilla, no transpilation) for logic. Modules use either standard ES modules (`<script type="module">`) **or** a single concatenated classic-script load order — whichever loads correctly under `file://` in all four target browsers (note: Chrome's `file://` ES-module restrictions favour classic scripts; choose accordingly during implementation).
- No Node.js runtime is required to play the game — only to run tests.

---

### TR-002 · Dependencies

**Description:**
The game shall ship with zero runtime dependencies.

**Acceptance Criteria:**
- `package.json` lists **devDependencies only**: `jest`, `jest-environment-jsdom`, `eslint` (and any helpers strictly required by these).
- No runtime dependencies (`dependencies`) are declared.
- All third-party dev tools are version-pinned (exact versions, not `^` ranges) for reproducibility.

---

### TR-003 · Code Architecture

**Description:**
The codebase shall follow a modular architecture with strict separation of concerns.

**Acceptance Criteria:**
- Project layout:

  ```
  /
  ├── index.html
  ├── README.md
  ├── package.json
  ├── .eslintrc.json
  ├── jest.config.js
  ├── css/
  │   ├── base.css
  │   └── themes.css
  ├── js/
  │   ├── main.js          # entry: wires UI to game; DOM event listeners
  │   ├── game.js          # game orchestration; turn management
  │   ├── board.js         # pure board state; move application; win/draw checks
  │   ├── player.js        # player factory / classes
  │   ├── ai.js            # AI strategies (Easy/Medium/Hard); injectable RNG
  │   ├── scoreManager.js  # localStorage load/save/migrate; schema validation
  │   ├── themes.js        # theme registry; apply/persist active theme
  │   ├── history.js       # move-history stack & undo (FR-W20)
  │   ├── audio.js         # sound effects + mute toggle (FR-W21)
  │   ├── stats.js         # stats dashboard computations (FR-W22)
  │   ├── ui.js            # DOM rendering, modal management, animations
  │   └── strings.js       # all user-facing strings (NFR-009)
  ├── assets/
  │   ├── themes/
  │   │   ├── beach/        # background.jpg/svg, x.svg, o.svg, thumb.jpg
  │   │   ├── mountains/    # ditto
  │   │   └── desert/       # ditto
  │   └── sounds/           # move.mp3, win.mp3, draw.mp3, invalid.mp3
  └── tests/
      ├── board.test.js
      ├── ai.test.js
      ├── scoreManager.test.js
      ├── themes.test.js
      ├── history.test.js
      ├── stats.test.js
      └── game.test.js
  ```

- Dependency direction: `main.js → ui.js → {game.js, themes.js, audio.js}`; `game.js → {board.js, player.js, ai.js, scoreManager.js, history.js}`; `stats.js` reads from `scoreManager.js`.
- No DOM access is permitted in `board.js`, `ai.js`, `scoreManager.js`, `themes.js` (data layer), `history.js`, or `stats.js`. The DOM is touched only by `ui.js`, `main.js`, and `audio.js`.
- The `Board` class accepts dimensions as constructor parameters (default 3×3) to ease future extension.
- No circular imports.

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
- The algorithm is contained within `ai.js` and exposed via a single function: `getBestMove(board, aiSymbol, rng = Math.random)`.
- The function is **side-effect-free** (does not mutate the input board).
- Tie-break among equally-scored optimal moves: lowest-indexed cell (after the depth-aware score has resolved most ties).
- Hard AI never loses, verified by §6's mandatory tests.

---

### TR-005 · Score Storage Format and Schema

**Description:**
Scores shall be persisted in `localStorage` as a structured, versioned JSON document.

**Acceptance Criteria:**
- Storage key: `tictactoe.scores.v2`.
- Backup key (on corruption): `tictactoe.scores.v2.bak`.
- Theme key: `tictactoe.theme`. Mute key: `tictactoe.muted`.
- JSON schema (V2):

  ```json
  {
    "schema_version": 2,
    "players": {
      "alice": {
        "display_name": "Alice",
        "wins": 3,
        "losses": 1,
        "draws": 1,
        "current_streak": { "type": "W", "count": 2 },
        "best_streak": 3,
        "recent_outcomes": ["W","L","D","W","W"]
      },
      "ai (hard)": {
        "display_name": "AI (Hard)",
        "wins": 5, "losses": 0, "draws": 2,
        "current_streak": { "type": "W", "count": 5 },
        "best_streak": 5,
        "recent_outcomes": ["W","D","W","W","D","W","W"]
      }
    },
    "head_to_head": {
      "alice|ai (hard)": { "a": "alice", "b": "ai (hard)", "a_wins": 1, "b_wins": 5, "draws": 2 }
    }
  }
  ```

- Player keys are **lowercase** for case-insensitive lookup; original casing preserved in `display_name`.
- `recent_outcomes` is an append-only list of single-character codes (`W`/`L`/`D`) with no fixed cap (a max of 100 entries per player is recommended; older entries truncated).
- Head-to-head keys are constructed by sorting the two lowercased names alphabetically and joining with `|`.
- A single in-memory write replaces the entire stored payload (NFR-006).
- Migration: on load, if `schema_version === 1` (or absent) and the old v1 fields are detected, fields `current_streak`, `best_streak`, `recent_outcomes`, and the top-level `head_to_head` object are added with safe defaults; the migrated payload is re-saved with `schema_version = 2`.
- The AI's randomness source is **injectable**: production passes `Math.random`, tests pass a seeded mulberry32 / xorshift RNG.

---

### TR-006 · Theme Registry

**Description:**
Themes shall be defined declaratively in a single registry to make adding/maintaining themes simple.

**Acceptance Criteria:**
- `themes.js` exports a registry array:

  ```js
  export const THEMES = [
    { id: "beach",     name: "Beach",     cssClass: "theme-beach",     symbolX: "assets/themes/beach/x.svg",     symbolO: "assets/themes/beach/o.svg",     thumb: "assets/themes/beach/thumb.jpg" },
    { id: "mountains", name: "Mountains", cssClass: "theme-mountains", symbolX: "assets/themes/mountains/x.svg", symbolO: "assets/themes/mountains/o.svg", thumb: "assets/themes/mountains/thumb.jpg" },
    { id: "desert",    name: "Desert",    cssClass: "theme-desert",    symbolX: "assets/themes/desert/x.svg",    symbolO: "assets/themes/desert/o.svg",    thumb: "assets/themes/desert/thumb.jpg" }
  ];
  ```
- Functions exported: `getActiveTheme()`, `setActiveTheme(id)`, `getThemeById(id)`, `listThemes()`.
- `setActiveTheme(id)` updates `document.body.className`, persists to `localStorage`, and dispatches a `themechange` custom event for any subscribers (e.g., the symbol renderer).
- An invalid theme id passed to `setActiveTheme` throws a descriptive Error (caught by callers, never reaches the user).

---

### TR-007 · Input Handling and Validation

**Description:**
All user input shall be validated before processing.

**Acceptance Criteria:**
- Reusable validation helpers exist in `ui.js`:
  - `validatePlayerName(raw) → { ok: boolean, value?: string, error?: string }`
  - `attemptMove(cellIndex) → boolean` (returns `false` if the cell is occupied or it is not a human's turn).
- Form submissions are blocked (`event.preventDefault()`) until validation passes.
- Keyboard event handlers ignore key presses when their corresponding action is not currently legal (e.g., `1`–`9` during the AI's turn).

---

### TR-008 · Error Handling and Logging

**Description:**
The application shall handle runtime errors gracefully and log diagnostic information to the browser console.

**Acceptance Criteria:**
- `window.addEventListener('error', ...)` and `window.addEventListener('unhandledrejection', ...)` are registered in `main.js`; both log a structured message to `console.error` and trigger the recovery toast (NFR-003).
- All `localStorage` access is wrapped in `try/catch`.
- Audio playback errors are caught and logged (FR-W21).
- `console.log` is not used in production code; only `console.warn` and `console.error`.
- A single global `DEBUG` flag in `main.js` (default `false`) gates verbose logging useful during development.

---

### TR-009 · Versioning

**Description:**
The application shall expose a version number from a single authoritative source.

**Acceptance Criteria:**
- `APP_VERSION` constant defined in `js/main.js` (or a small `js/version.js`), following Semantic Versioning (`MAJOR.MINOR.PATCH`), starting at `2.0.0`.
- The version is shown in the footer of the main menu and in the help screen.
- The same value populates the `version` field in `package.json`.
- The version is referenced by `scoreManager.js` schema-migration logic for compatibility decisions.

---

### TR-010 · Static-Hosting Compatibility

**Description:**
The site shall run identically when opened from `file://` and when served from any static HTTP server.

**Acceptance Criteria:**
- All asset references in HTML, CSS, and JS use **relative paths** (e.g., `assets/themes/beach/x.svg`, not `/assets/...`).
- No `fetch`, `XMLHttpRequest`, or `import()` of local files at runtime (which fail under some browsers' `file://` security model).
- If ES modules are used, they must be tested under `file://` in all four target browsers (NFR-005); if any browser fails, the implementation must fall back to classic concatenated scripts.

---

## 6. Testing Requirements

### TR-T01 · Test Framework and Tooling

**Description:**
Automated unit tests shall be implemented using **Jest** with the **jsdom** environment.

**Acceptance Criteria:**
- `package.json` declares `jest` and `jest-environment-jsdom` as devDependencies.
- `npm test` runs the entire test suite from the project root with no additional configuration.
- `npm run test:coverage` runs Jest with `--coverage` and prints branch/line coverage summaries.
- A CI-friendly invocation gates the build at branch coverage **≥ 90%** for `board.js`, `ai.js`, `scoreManager.js`, and `themes.js`.
- Tests are organised one file per module under `tests/`, mirroring the `js/` directory layout.

### TR-T02 · Mandatory Test Cases

**`board.js`:**
- All 8 winning lines (3 rows, 3 columns, 2 diagonals) are detected for both `X` and `O`.
- Draw detection on a full board with no winner.
- Move-validation rejects: out-of-range indices, already-occupied cells, moves on a finished board.
- Board is immutable from the caller's perspective: `applyMove` returns a new state or operates on an internal copy without leaking references.

**`ai.js`:**
- Easy AI: across many seeded runs, every chosen cell is empty (property test).
- Medium AI: for each of the six priority rules, at least one fixture board exists where the rule is the deciding factor and the chosen move matches expectation.
- Hard AI:
  - Never loses against a random opponent across ≥ 1000 seeded games.
  - Plays a known optimal opening response in every starting position (centre / corner / edge fixtures).
  - Tie-break verifies lowest-index preference among equally-scored moves.
- All AI functions accept an injected RNG and produce identical output for identical seeds.

**`scoreManager.js`:**
- Round-trip: save a non-trivial scores object → reload → deep-equals the original.
- Corrupt JSON in `localStorage`: load returns empty scores AND moves the corrupt value to the `.bak` key.
- v1 → v2 schema migration: a v1-shaped payload is upgraded with safe defaults and re-saved with `schema_version = 2`.
- Updating a player's record after a win/loss/draw correctly increments counts, updates `current_streak`, and updates `best_streak` when surpassed.
- Head-to-head records are correctly created and updated for new and existing pairs.
- `localStorage` unavailable: methods catch the exception and fall back to the in-memory store without throwing.

**`themes.js`:**
- `listThemes()` returns exactly three entries with ids `beach`, `mountains`, `desert`.
- `setActiveTheme('mountains')` updates `document.body.className` to include `theme-mountains` and persists to `localStorage`.
- `setActiveTheme('invalid-id')` throws.
- `getActiveTheme()` after a fresh load with no persisted theme returns the default (`beach`).
- A `themechange` custom event is dispatched on every successful `setActiveTheme` call.

**`history.js` (FR-W20):**
- Pushing moves and undoing in HvH reverts one move and switches the active player.
- Undoing in HvAI reverts two moves (AI + human) and leaves the human as the active player.
- Undo on an empty history is a no-op (does not throw, does not crash).
- Undo is rejected when the round is over.

**`stats.js` (FR-W22):**
- Win-rate computation handles zero games (returns `0` or `"—"`, not `NaN`).
- Current-streak computation correctly distinguishes W, L, D streaks.
- Best-streak computation correctly identifies the longest historical W run.
- Head-to-head aggregation across many rounds matches a brute-force reference computation on the same input data.

**`game.js`:**
- A full HvH round can be simulated end-to-end with mocked players, ending in the correct outcome and triggering exactly one score update.
- A full HvAI round (Hard) ends in a draw or AI win — never a human win — across ≥ 100 random seeds.
- Starting-player rotation flips correctly across consecutive rounds (FR-006).
- Forfeit during a round produces no score change and resets game state.

### TR-T03 · DOM-Touching Tests (jsdom)

- A small set of integration-flavoured tests verify that `ui.js` correctly renders the board after `applyMove` and updates the turn indicator. These tests run under the `jsdom` environment.
- Theme application tests verify that `setActiveTheme` causes the expected CSS class to appear on `document.body` in jsdom.

### TR-T04 · Test Determinism

- All AI tests use a seeded RNG (e.g., mulberry32) injected into `getBestMove` and the Easy/Medium AI move pickers.
- All time-dependent assertions (e.g., AI move latency) use Jest's fake timers to avoid wall-clock flakiness, **except** the latency-budget tests which use real timers and tolerate up to 2× the budget under CI noise (so 400 ms instead of 200 ms).
- Tests that touch `localStorage` either run in jsdom (which provides a clean `localStorage` per test) or use a small in-memory shim with `beforeEach` reset.

### TR-T05 · Continuous Validation

- Linting (`eslint`) runs as part of `npm test` (`pretest` script).
- A failed lint run fails the test command.
- A coverage shortfall (< 90% on the four core modules) fails the test command.

---

## 7. Assumptions & Constraints

| #   | Assumption / Constraint                                                                                                                                |
|-----|--------------------------------------------------------------------------------------------------------------------------------------------------------|
| A1  | The user has a modern browser (Chrome, Firefox, Edge, or Safari — latest two stable versions).                                                         |
| A2  | The user's browser permits `localStorage` access. If not, scores are session-only with a warning (FR-016).                                             |
| A3  | The user can open `index.html` from the local file system (`file://`) without browser-imposed CORS restrictions blocking local relative-path assets.   |
| A4  | The board size is fixed at 3×3 for V2; the `Board` class is parameterised to ease future extension.                                                    |
| A5  | Concurrent multi-tab access to the same `localStorage` key is out of scope; the last-write-wins. (Could be addressed via `storage` event in a future.) |
| A6  | The reserved names `AI`, `Computer`, and `AI (Easy/Medium/Hard)` (case-insensitive) are rejected as human names (FR-003).                              |
| A7  | All theme images and SVGs are bundled with the application; no remote/CDN assets.                                                                      |
| A8  | The system clock is reliable enough for round-duration measurements (FR-018) and timestamps in the move history (FR-W20).                              |
| A9  | Audio autoplay may be blocked by the browser until the first user interaction; this is accepted (FR-W21 mutes by default).                              |
| A10 | No build step is permitted: the source files served are the source files written.                                                                       |

---

## 8. Out of Scope

The following are explicitly **not** delivered in V2:

- **Real-time online or networked multiplayer.**
- **Server-side accounts, authentication, or cloud sync.**
- **Native mobile (iOS/Android) apps.**
- **Custom board sizes** (e.g., 4×4, 5×5) — fixed at 3×3.
- **Localisation** — English only for V2; codebase is structured for translation (NFR-009).
- **AI vs AI mode** — only HvH and HvAI are supported.
- **Build tools, bundlers, transpilers** (Webpack, Vite, Babel, TypeScript).
- **Runtime third-party JS frameworks** (React, Vue, jQuery, etc.).
- **Per-theme sound packs** — V2 ships one shared sound pack (FR-W21).
- **More than three themes** — V2 ships exactly Beach, Mountains, Desert (FR-W02).
- **More than three new features beyond v1** — V2 ships exactly Move History/Undo, Sound Effects, and Stats Dashboard (§2.4).
- **Forfeit-as-loss semantics** — forfeits remain unrecorded (FR-008), unchanged from v1.
- **Spectator mode / replay export.**

---

## 9. Glossary

- **HvH** — Human vs Human local play (both players share the same browser).
- **HvAI** — Human vs AI play.
- **Round** — A single game played from empty board to win or draw.
- **Session** — The period from loading the page to closing the tab. Scores persist across sessions via `localStorage`.
- **Minimax** — A recursive decision algorithm for two-player zero-sum games selecting the move that minimises the opponent's maximum payoff.
- **Alpha-beta pruning** — An optimisation of Minimax that skips branches proven irrelevant to the final decision.
- **Forfeit** — A player's voluntary mid-round abandonment (FR-008); not recorded as a win/loss.
- **Theme** — A bundled set of visual assets (background, X symbol, O symbol, accent colours) selectable from the theme picker (FR-W02).
- **Schema version** — Integer field in the persisted scores payload identifying the data-format version, enabling forward-compatible migration (TR-005).
- **Reference device** — Performance baseline defined in NFR-001: dual-core 2 GHz CPU, 4 GB RAM, latest Chrome on desktop; or a mid-range smartphone (≥ 2018) on mobile.
- **jsdom** — A pure-JavaScript implementation of the DOM used by Jest to test DOM-touching code without a real browser.
- **`localStorage`** — Browser-provided synchronous key–value store, scoped per origin, persisting across sessions.

---

*End of Software Requirements Specification — Tic Tac Toe v2.0 (Web Edition)*
