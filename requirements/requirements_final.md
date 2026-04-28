# Tic Tac Toe — Software Requirements Specification

**Version:** 1.0 (Final, Synthesised)
**Platform:** Command-Line Terminal (Python 3.10+)
**Status:** Approved for implementation

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Functional Requirements](#2-functional-requirements)
3. [Non-Functional Requirements](#3-non-functional-requirements)
4. [User Interface Requirements](#4-user-interface-requirements)
5. [Technical Requirements](#5-technical-requirements)
6. [Assumptions & Constraints](#6-assumptions--constraints)
7. [Out of Scope](#7-out-of-scope)
8. [Glossary](#8-glossary)

---

## 1. Project Overview

This document specifies the requirements for a command-line Tic Tac Toe game implemented in Python 3.10+. The game supports two play modes — **Human vs Human (HvH)** and **Human vs AI (HvAI)** — with three AI difficulty levels (Easy, Medium, Hard). Scores are tracked across rounds and persisted to a local file so they survive application restarts. After each game, players may choose to play again, return to the main menu, or quit.

**Target Audience:** Casual players and computer-science learners exploring the Minimax algorithm. The design favours polish and clarity over didactic verbosity but keeps the AI implementations approachable.

**Out-of-scope reminders (see §7 for the full list):** AI vs AI mode, networked multiplayer, GUI/web frontends, custom board sizes, user accounts, sound, localisation.

---

## 2. Functional Requirements

### FR-001 · Main Menu and Game Mode Selection

**Description:**
At application startup — and whenever the user returns to the main menu — the system shall present a numbered menu allowing the user to choose a game mode or system action.

**Acceptance Criteria:**
- The menu displays the following options:
  1. Human vs Human
  2. Human vs AI
  3. View Scores
  4. Reset Scores
  5. Help / Instructions
  6. Quit
- Selecting **1** initiates a HvH game session and proceeds to player-name entry (FR-003).
- Selecting **2** proceeds to AI difficulty selection (FR-002), then to player-name entry.
- Selecting **3** displays the cumulative scoreboard (FR-014) and returns to the main menu.
- Selecting **4** triggers the score reset flow (FR-015).
- Selecting **5** displays the help screen (UI-006).
- Selecting **6** saves scores and exits the application gracefully (FR-013).
- Any input outside the valid options produces a descriptive error message and re-displays the menu without losing context.

---

### FR-002 · AI Difficulty Selection

**Description:**
When Human vs AI mode is selected, the system shall allow the player to choose one of three AI difficulty levels.

**Acceptance Criteria:**
- A sub-menu displays:
  - `[1] Easy — random moves`
  - `[2] Medium — heuristic (win / block / centre / corner / random)`
  - `[3] Hard — unbeatable (Minimax)`
- The selected difficulty is confirmed with a printed message (e.g., `"Difficulty set to: Hard"`).
- Any input outside `1–3` triggers an error message and re-displays the sub-menu.
- The chosen difficulty governs all AI moves for the entire game session until the user returns to the main menu.

---

### FR-003 · Player Name Entry and Validation

**Description:**
Before a game begins, the system shall prompt each human player to enter a display name and validate it.

**Acceptance Criteria:**
- In HvH mode, two separate name prompts are shown (e.g., `"Enter name for Player 1 (X): "`).
- In HvAI mode, one name prompt is shown for the human player; the AI is labelled by difficulty (see FR-014).
- Names must be **1–20 characters** in length after trimming whitespace.
- Allowed characters: alphanumerics, spaces, hyphens (`-`), and underscores (`_`). Control characters and terminal escape sequences are rejected.
- Leading and trailing whitespace is stripped before validation.
- Empty input (after stripping) is rejected with an inline error and the prompt is re-displayed; alternatively, the user may accept a default name (`"Player 1"` / `"Player 2"`) by pressing Enter at a confirmation prompt.
- The names `AI`, `Computer`, `AI (Easy)`, `AI (Medium)`, and `AI (Hard)` (case-insensitive) are reserved for the system and rejected with the message: `"That name is reserved. Please choose another."`
- In HvH mode, two players may not share the same name (case-insensitive); a duplicate triggers a re-prompt for Player 2.
- If the entered name (case-insensitive) matches an existing record in `scores.json`, that player's history is reused and continues to accumulate.

---

### FR-004 · Board Initialisation

**Description:**
At the start of every new round, the system shall initialise a clean 3×3 game board with all cells empty.

**Acceptance Criteria:**
- All 9 cells are unoccupied at round start.
- Cells are addressed by the **1–9 numeric scheme** (left-to-right, top-to-bottom — the only supported input format in v1).
- The board state from any previous round does not persist into the new round.
- Initialisation is triggered explicitly by the Game controller when a new round begins.

---

### FR-005 · Turn Management

**Description:**
The system shall alternate turns between the two players (or human and AI), enforcing that the player holding the first-move privilege for the current round plays `X` and moves first.

**Acceptance Criteria:**
- Within a round, after each valid move the active player switches; a player cannot move twice in succession.
- The current player's name and symbol are clearly displayed before each turn prompt (UI-003).
- In HvAI mode, when it is the AI's turn the controller advances automatically without requiring a key-press from the human.
- The first-move privilege for the round is determined by FR-006.

---

### FR-006 · Starting-Player Fairness Across Rounds

**Description:**
To avoid the systematic first-move advantage skewing scoreboard results across a multi-round session, the player who moves first shall alternate between rounds.

**Acceptance Criteria:**
- In round 1 of a fresh game configuration, Player 1 / the human plays `X` and moves first.
- In each subsequent round started via FR-012's "Play again", the starting player alternates: round 2 starts with the other player, round 3 with the original, and so on.
- The `X`/`O` symbol allocation follows the first-mover for the round — the player who moves first in a given round always plays `X`.
- The starting-player rotation resets when the user returns to the main menu and starts a new game configuration.
- The current round's starting player and symbol assignment are clearly announced before the first move.
- The scoreboard always identifies players by name (not by symbol) to avoid confusion when symbols rotate.

---

### FR-007 · Human Player Move Input

**Description:**
On a human player's turn, the system shall accept a cell selection via keyboard input, validate it, and apply it to the board.

**Acceptance Criteria:**
- The prompt reads: `"Enter position (1-9, or 'q' to quit round): "`.
- Non-integer input (excluding the quit shortcut) produces: `"Invalid input. Please enter a number between 1 and 9."` and re-prompts.
- An out-of-range number produces the same error message and re-prompts.
- Selecting an already-occupied cell produces: `"Cell [n] is already taken. Please choose an empty cell."` and re-prompts.
- Valid input places the current player's symbol on the selected cell and advances the game.
- Entering `q`, `Q`, `quit`, or `exit` triggers the forfeit flow (FR-008).
- `EOFError` (e.g., piped input ending) is caught at top level and treated as a graceful quit.

---

### FR-008 · Mid-Round Forfeit / Abandon

**Description:**
A human player shall be able to abandon the current round mid-game and return to the main menu without crashing the application.

**Acceptance Criteria:**
- Entering `q`, `Q`, `quit`, or `exit` at the move-input prompt triggers a confirmation: `"Forfeit this round? [y/N]"`.
- On confirmation, the round ends immediately. The forfeit is **not** recorded as a win/loss in v1 — the round is treated as if it never occurred.
- After confirmation, the system returns to the main menu (FR-001).
- Cancelling the confirmation returns the player to the same move prompt with the board unchanged.
- Forfeit is unavailable during the AI's turn (the AI has no input prompt); the human must wait for their next turn.

---

### FR-009 · AI Move — Easy Difficulty

**Description:**
On Easy difficulty, the AI shall select its move uniformly at random from all currently available cells.

**Acceptance Criteria:**
- The AI never selects an occupied cell.
- Move selection has no strategic bias; any empty cell is equally probable.
- The chosen cell is announced (e.g., `"AI plays at position 5"`).
- The AI move completes within 500 ms (NFR-001).
- The randomness source is injectable via a `random.Random` instance (see TR-005) to support deterministic tests.

---

### FR-010 · AI Move — Medium Difficulty

**Description:**
On Medium difficulty, the AI shall apply a deterministic priority-ordered heuristic.

**Acceptance Criteria:**
- The AI evaluates the following priorities in order and plays the first applicable move:
  1. **Win** — if the AI has an immediate winning move, take it.
  2. **Block** — if the opponent has an immediate winning move, block it.
  3. **Centre** — if the centre cell (5) is empty, take it.
  4. **Opposite corner** — if the opponent occupies a corner and the diagonally opposite corner is empty, take it.
  5. **Empty corner** — take any empty corner.
  6. **Random** — otherwise pick any remaining empty cell at random.
- The AI never selects an occupied cell.
- The chosen cell is announced.
- The AI move completes within 500 ms (NFR-001).

---

### FR-011 · AI Move — Hard Difficulty

**Description:**
On Hard difficulty, the AI shall play optimally using the Minimax algorithm and shall be unbeatable.

**Acceptance Criteria:**
- The AI always selects the move with the highest Minimax score.
- A perfect human can force at most a draw; the AI never loses.
- The AI never selects an occupied cell.
- Among multiple equally-scored optimal moves, the tie-break rule is: prefer the move that wins in the fewest plies (or loses in the most plies); secondary tie-break is the lowest-indexed cell.
- The chosen cell is announced.
- The AI move completes within 200 ms on the reference machine defined in NFR-001.
- See TR-004 for algorithmic details.

---

### FR-012 · Win Detection

**Description:**
After every move, the system shall check whether the current player has won by occupying three cells in a winning line.

**Acceptance Criteria:**
- All 8 winning lines are evaluated: 3 rows, 3 columns, 2 diagonals.
- A win is detected immediately after the move that completes the line.
- On detection, the round ends and the winning player's name and symbol are announced (e.g., `"Alice (X) wins!"`).
- The winning cells are visually distinguished in the final board display using a textual marker (e.g., enclosed in `[ ]` or marked with `*`); colour, if used, is purely additive (UI-008).
- The win is recorded in the score tracker (FR-014) and persisted (FR-016).

---

### FR-013 · Draw Detection

**Description:**
After every move, if no winning condition is met and no empty cells remain (or no winning line remains achievable), the system shall declare a draw.

**Acceptance Criteria:**
- A draw is declared when all 9 cells are filled with no winner. (For the Hard AI's Minimax, an early-termination "forced draw" is permitted internally for performance, but the user-facing announcement still appears at the natural end of play.)
- The message `"It's a draw! Well played by both sides."` is displayed.
- The draw is recorded in the score tracker (FR-014) and persisted (FR-016).

---

### FR-014 · Score Tracking

**Description:**
The system shall maintain a running record for each named player across all rounds in the current session and across sessions (via persistence — FR-016).

**Acceptance Criteria:**
- Each player record tracks: **wins**, **losses**, and **draws**. Games-played is computed as the sum of these three on display.
- Scores are updated immediately after each round outcome (win or draw); forfeits (FR-008) are not recorded in v1.
- Score data is keyed by lowercased player name; the original-casing display name is stored alongside.
- Scores accumulated in previous sessions (loaded from `scores.json` on startup) continue to accumulate across sessions.
- AI records are split by difficulty: separate entries for `AI (Easy)`, `AI (Medium)`, and `AI (Hard)` so statistics remain meaningful.
- HvH rounds are tracked per individual player name (not per "Player 1 / Player 2" slot).

---

### FR-015 · Score Reset

**Description:**
The user shall have an explicit, confirmed mechanism to clear all persisted score data.

**Acceptance Criteria:**
- The `Reset Scores` option in the main menu (FR-001) triggers this flow.
- A confirmation prompt is displayed: `"This will permanently delete all scores. Are you sure? [y/N]"`.
- On `y`/`yes`: the in-memory score store and the on-disk `scores.json` are cleared (replaced with an empty schema, preserving the schema version field).
- A backup of the previous file is written to `scores.json.bak` before deletion.
- On any other input, the action is cancelled and the menu re-displayed.
- In-memory and on-disk state are kept in sync at all times.

---

### FR-016 · Score Persistence

**Description:**
Player scores shall be saved to a local file after every round so they are not lost when the application closes.

**Acceptance Criteria:**
- Scores are written to `scores.json` in the user-appropriate location defined in TR-006.
- The file is updated after every completed round (win or draw) and on graceful exit.
- On startup, if the file exists and is valid, scores are loaded automatically.
- If the file is missing, a new empty file is created silently on first write.
- If the file is corrupted (invalid JSON or schema-invalid), a warning is printed and logged, the corrupt file is renamed to `scores.json.bak`, and the session starts with empty in-memory scores.
- Schema validation on load checks: required fields present, numeric counters non-negative, schema version recognised.
- See TR-005 for the schema and atomic-write strategy.

---

### FR-017 · Replay Option

**Description:**
After each completed round, the system shall offer the players options for what to do next.

**Acceptance Criteria:**
- The prompt displays: `"Play again? [1] Yes (same settings) [2] Return to Main Menu [3] Quit"`.
- Selecting **1** starts a new round with the same players and settings, resetting only the board; the starting player rotates per FR-006.
- Selecting **2** returns to the main menu (FR-001), allowing mode, difficulty, or players to be changed.
- Selecting **3** saves scores and exits the application gracefully.
- Any invalid input re-displays the prompt.

---

### FR-018 · Round Summary

**Description:**
After a win or draw, the system shall display a round summary before the replay prompt.

**Acceptance Criteria:**
- The final board state is shown with the winning line highlighted (FR-012) when applicable.
- The outcome is clearly announced (winner name + symbol, or draw message).
- The current cumulative scoreboard is displayed (FR-014).
- A small stats block is shown for the round (display only; not persisted in v1):
  - Total moves played.
  - Wall-clock duration (mm:ss).
  - For HvAI rounds, average AI move computation time in milliseconds.
- The replay prompt (FR-017) follows immediately.

---

### FR-019 · Graceful Exit

**Description:**
The user shall be able to quit the game cleanly from any major prompt, with scores preserved.

**Acceptance Criteria:**
- A quit option is available from: the main menu, the replay prompt, the difficulty-selection prompt, and (via the `q` shortcut) the move-input prompt.
- On exit, in-memory scores are flushed to `scores.json` (FR-016) using the atomic-write pattern (TR-005).
- The terminal is left in a clean state (cursor visible, no stray ANSI sequences, no partial output).
- The exit message is displayed: `"Scores saved. Thanks for playing! Goodbye."` — but only if the score file write actually succeeded; if it failed, the message reports the failure honestly.
- Hard kills (e.g., `SIGKILL`, terminal close) are best-effort only; an `atexit` handler attempts a final flush.
- See NFR-003 for `Ctrl+C` (SIGINT) handling.

---

## 3. Non-Functional Requirements

### NFR-001 · Performance

**Description:**
The game shall remain responsive on standard consumer hardware.

**Acceptance Criteria:**
- **Reference machine:** dual-core 2 GHz CPU, 2 GB RAM, Python 3.10, Linux/macOS/Windows 10+.
- Human input processing and UI rendering complete within 100 ms perceived latency.
- Easy and Medium AI moves complete within 500 ms.
- Hard AI (Minimax) moves complete within 200 ms.
- Score-file I/O completes within 500 ms.
- Application startup completes within 2 seconds.

---

### NFR-002 · Usability

**Description:**
The game shall be intuitive for a first-time user without external documentation.

**Acceptance Criteria:**
- Cell-numbering instructions are shown at the start of each round.
- All prompts state the expected input format and valid range, with examples.
- Error messages are specific, human-readable, and actionable.
- A cell-position legend is always visible (the board renders position numbers in empty cells — UI-002).
- A first-time user can start and complete a game without consulting the README.
- No prompt requires the user to recall information shown more than one screen ago.
- Informal usability gate: 5 of 5 first-time test users complete a round without assistance.

---

### NFR-003 · Reliability and Signal Handling

**Description:**
The game shall handle invalid input, OS interrupts, and unexpected conditions without crashing or losing data.

**Acceptance Criteria:**
- No unhandled Python exception ever reaches the terminal during normal operation.
- All user-input paths validate input before use; invalid inputs trigger an error message and re-prompt.
- File I/O failures (disk full, permission denied) are caught, logged, and reported without terminating the session.
- `KeyboardInterrupt` (Ctrl+C / SIGINT) is caught at the top-level entry point:
  - In-memory scores are flushed to disk via the atomic-write pattern (TR-005).
  - A brief message is printed: `"Game interrupted. Scores saved. Goodbye."`
  - The terminal is left in a clean state.
  - The process exits with code `130` (standard SIGINT exit code).
- A second `Ctrl+C` during the shutdown sequence forces immediate exit; the system never loops on confirmation prompts.
- `EOFError` on closed stdin is treated equivalently to a graceful quit.

---

### NFR-004 · Maintainability

**Description:**
The codebase shall be modular, type-annotated, and easy to extend.

**Acceptance Criteria:**
- Code is organised into the modules defined in TR-003.
- All public functions, methods, and classes carry docstrings and PEP 484 type hints.
- The codebase passes `mypy --strict` (or equivalent) with no errors.
- The codebase passes `flake8` (or `ruff`) with no errors and a `pylint` score ≥ 8/10.
- No single function exceeds 50 lines.
- Adding a new AI difficulty requires changes only inside the `ai` module (Open/Closed compliant).
- A `README.md` documents installation, run instructions, CLI flags (TR-009), and project layout.

---

### NFR-005 · Portability

**Description:**
The game shall run on Windows, macOS, and Linux without modification.

**Acceptance Criteria:**
- The game uses only the Python 3.10+ standard library for core gameplay; `colorama` (or equivalent) is the sole permitted optional dependency for cross-platform colour on Windows and is pinned in `requirements.txt`.
- File paths use `pathlib` exclusively; no hard-coded path separators.
- No OS-specific terminal escape codes are used unless ANSI support is detected at runtime.
- When ANSI support is unavailable (detected via `sys.stdout.isatty()` returning `False`, `os.environ.get('TERM') == 'dumb'`, or `NO_COLOR` env var being set), the game enters **pipe-safe mode** (UI-007): no ANSI escapes, no screen-clear, plain-text dividers between board redraws.
- Unicode/emoji elements have ASCII fallbacks that activate automatically when `sys.stdout.encoding` does not support UTF-8.

---

### NFR-006 · Data Integrity and Concurrent-Access Safety

**Description:**
The score file shall not be corrupted by unexpected shutdowns, concurrent access, or partial writes.

**Acceptance Criteria:**
- All score writes use the atomic-write pattern: write to a temporary file, then rename to the target (TR-005).
- An advisory file lock is acquired during the read-modify-write cycle (`fcntl.flock` on POSIX, `msvcrt.locking` on Windows).
- If the lock cannot be acquired within 2 seconds, a warning is logged and the disk write is skipped; the in-memory scores for the current session remain correct.
- The score file contains no executable code — only player names and integer counters.

---

### NFR-007 · Testability

**Description:**
Core game logic shall be unit-testable in isolation, with quantified coverage and verified correctness guarantees.

**Acceptance Criteria:**
- Win detection, draw detection, move validation, AI move selection, and score persistence are pure functions or testable methods reachable without terminal I/O.
- The test suite uses `pytest` and runs from the project root with no additional configuration.
- Tests run without user interaction.
- Branch coverage on the `board`, `ai`, and `score_manager` modules is **≥ 90%**, verified by `pytest-cov`.
- Mandatory test cases include:
  - All 8 winning lines detected correctly.
  - Draw detection on a full board with no winner.
  - Easy AI never selects an occupied cell (property-based test).
  - Hard AI never loses — verified against (a) a random opponent over many seeds, and (b) an exhaustive brute-force opponent enumerating every legal opening sequence.
  - Score persistence round-trip: save then reload yields identical data.
  - Corrupt-`scores.json` recovery path produces a `.bak` and starts with empty in-memory scores.
- Randomised AI behaviour is seedable (TR-005) for reproducible tests.

---

### NFR-008 · Accessibility — Colour Independence

**Description:**
The UI shall never rely on colour alone to convey information critical to gameplay.

**Acceptance Criteria:**
- Player symbols (`X` and `O`) are distinguishable by character, not only colour.
- Win/draw announcements and error messages convey their meaning via text.
- Where ANSI colour is used (e.g., to highlight winning cells), a textual marker (e.g., `[ ]` or `*`) carries the same information.
- The game is fully playable on a monochrome terminal and by colour-vision-deficient users with no loss of information.
- Colour output is suppressed automatically when `NO_COLOR` is set or stdout is not a TTY.

---

### NFR-009 · Localisation Readiness (Future-Proofing)

**Description:**
While v1 ships in English only, the codebase shall be structured to allow translation later without refactoring.

**Acceptance Criteria:**
- All user-facing strings are defined in a single module or constant dictionary (e.g., `strings.py`); no English-language strings appear inline in logic code.
- Formatted strings use named placeholders (`f"{player.name} wins"` style or `str.format`) — never positional concatenation that assumes English word order.
- This is a soft requirement; no actual translations are delivered for v1.

---

## 4. User Interface Requirements

### UI-001 · Main Menu Display

**Description:**
The application shall display a clear, formatted main menu on startup and whenever the user returns to it.

**Acceptance Criteria:**
- A separator (banner line, blank lines, or — only in TTY mode — a screen clear) precedes the menu.
- The game title `TIC TAC TOE` is shown as an ASCII banner at the top.
- Menu options are numbered and listed vertically per FR-001.
- A summary of the current scoreboard top line is shown above or below the menu for context.
- The menu is re-displayed after every invalid selection.
- Screen clearing uses ANSI `\033[2J\033[H` only when ANSI support is detected; otherwise printed blank lines provide separation. `os.system("cls"/"clear")` is **not** used.

---

### UI-002 · Board Rendering

**Description:**
The game board shall be rendered as a clearly readable 3×3 grid after every move and at the start of each turn.

**Acceptance Criteria:**
- The board uses ASCII separators (`|` and `---+---+---`).
- Each cell displays either the player symbol (`X`/`O`) or the cell's position number (`1`–`9`) when empty, providing a permanent legend.
- The board is reprinted in full after every move; in TTY mode the screen may be cleared for cleanliness, in pipe-safe mode (UI-007) a `---` divider separates redraws.
- Example rendering:
  ```
   1 | X | 3
  ---+---+---
   4 | O | 6
  ---+---+---
   7 | 8 | 9
  ```
- Board rendering returns a string from a pure method on the `Board` class; actual `print()` calls live in the `ui` module (TR-003).

---

### UI-003 · Turn Indicator

**Description:**
Before each move, the system shall clearly indicate whose turn it is.

**Acceptance Criteria:**
- The active player's name and symbol are displayed (e.g., `"Alice's turn (X)"`), printed immediately above the input prompt.
- In HvAI mode, when it is the AI's turn, `"AI is thinking..."` is briefly displayed.
- The "thinking" pause is artificial and bounded: at most ~300 ms, only added when the actual computation is faster than that. Easy/Medium never pause longer than 300 ms total.

---

### UI-004 · Input Prompt

**Description:**
Human players shall be guided by a consistent, clearly worded input prompt on every turn.

**Acceptance Criteria:**
- The move prompt reads: `"Enter position (1-9, or 'q' to quit round): "`.
- The cursor appears immediately after the prompt on the same line.
- After an invalid entry, the error message appears on the line immediately preceding the re-issued prompt; the board remains visible above.

---

### UI-005 · Invalid Input Feedback

**Description:**
All invalid inputs shall produce immediate, descriptive inline error messages without clearing useful screen context.

**Acceptance Criteria:**
- Non-numeric input: `"Invalid input. Please enter a number between 1 and 9."`
- Out-of-range number: `"Invalid input. Please enter a number between 1 and 9."`
- Already-occupied cell: `"Cell [n] is already taken. Please choose an empty cell."`
- Invalid menu choice: `"Invalid choice. Please select one of the listed options."`
- Errors do not duplicate or accumulate visually across successive invalid inputs.
- No board re-render is required for input errors; only the error line and a new prompt are printed.

---

### UI-006 · Game Result Announcement

**Description:**
The outcome of each round shall be announced with a prominent, visually distinct message.

**Acceptance Criteria:**
- Win message: `"🎉 [Player Name] ([Symbol]) wins! Congratulations!"` with an automatic ASCII fallback (`"*** [Player Name] ([Symbol]) wins! Congratulations! ***"`) when Unicode is unsupported.
- Draw message: `"It's a draw! Well played by both sides."`
- The final board with the winning line marked (FR-012) is displayed immediately before the result message.
- Both the winning-line marker and the announcement are rendered on the same screen.

---

### UI-007 · Scoreboard Display

**Description:**
The score table shall be formatted for easy reading in a fixed-width terminal.

**Acceptance Criteria:**
- Columns: `Player`, `Wins`, `Losses`, `Draws`, `Played` — each right-padded to a consistent fixed width.
- A header row and a horizontal divider line are included.
- Players are sorted descending by wins; secondary sort by fewer losses; tertiary by alphabetical name.
- ASCII-only rendering is used by default for portability; an optional Unicode box-drawing variant may be used when `sys.stdout.encoding` supports UTF-8.
- Example (ASCII):
  ```
  +----------+------+--------+-------+--------+
  | Player   | Wins | Losses | Draws | Played |
  +----------+------+--------+-------+--------+
  | Alice    |    3 |      1 |     1 |      5 |
  | Bob      |    1 |      3 |     1 |      5 |
  +----------+------+--------+-------+--------+
  ```
- If no scores exist, the message `"No scores recorded yet."` is shown instead.

---

### UI-008 · Help / Instructions Screen

**Description:**
A help screen shall be accessible from the main menu and shall describe gameplay in plain language.

**Acceptance Criteria:**
- Reachable in ≤ 2 keystrokes from the main menu (FR-001 option 5).
- Contents include: rules of Tic Tac Toe, the 1–9 cell input format, descriptions of the three AI difficulty levels, the mid-round forfeit shortcut (FR-008), the `Ctrl+C` behaviour (NFR-003), and how to quit.
- After display, pressing any key returns the user to the main menu.

---

### UI-009 · Pipe-Safe / Non-Interactive Output Mode

**Description:**
When the game's stdout is not a TTY (or `NO_COLOR` is set), the UI shall adapt to produce clean, scriptable plain-text output.

**Acceptance Criteria:**
- At startup, `sys.stdout.isatty()` is checked; if `False`, the game enters pipe-safe mode.
- In pipe-safe mode: ANSI escape codes are suppressed, screen-clear is skipped, and board redraws are separated by a text divider (`---`).
- `NO_COLOR` env var being set forces pipe-safe colour suppression independently of TTY detection.
- Pipe-safe mode affects rendering only; all functional behaviour remains unchanged.
- This mode is also triggered by the `--no-color` CLI flag (TR-009).

---

### UI-010 · Exit Message

**Description:**
When the application exits, it shall display a farewell message that honestly reflects whether scores were saved.

**Acceptance Criteria:**
- On successful save: `"Scores saved. Thanks for playing! Goodbye."`
- On save failure: `"Warning: scores could not be saved ([reason]). Thanks for playing! Goodbye."`
- The message appears for menu quit, replay-prompt quit, and `Ctrl+C` shutdown paths (NFR-003), implemented via an `atexit` handler. Hard kills are best-effort only.

---

## 5. Technical Requirements

### TR-001 · Language and Runtime

**Description:**
The game shall be implemented in Python 3.10 or newer.

**Acceptance Criteria:**
- The codebase uses only features available in Python 3.10+.
- The entry point is invoked via `python -m tictactoe` (or an installed console script).
- `pyproject.toml` declares `requires-python = ">=3.10"`.
- No third-party packages are required for core gameplay; `colorama` is the sole optional runtime dependency (Windows colour support).
- Optional development dependencies (`pytest`, `pytest-cov`, `mypy`, `flake8`/`ruff`) are listed in `requirements-dev.txt`.

---

### TR-002 · Dependencies

**Description:**
The game shall minimise external dependencies and pin all that are used.

**Acceptance Criteria:**
- Core gameplay relies on standard-library modules only (`json`, `random`, `pathlib`, `logging`, `argparse`, `signal`, `atexit`, `sys`, `os`).
- Optional runtime dependencies in `requirements.txt` are version-pinned with hashes (e.g., `pip-compile --generate-hashes`).
- Development tools in `requirements-dev.txt` are similarly pinned.

---

### TR-003 · Code Architecture

**Description:**
The codebase shall follow a modular, object-oriented architecture with strict separation of concerns.

**Acceptance Criteria:**
- Module structure:

  | Module             | Responsibility                                                           |
  |--------------------|--------------------------------------------------------------------------|
  | `main.py` / `__main__.py` | Entry point; CLI argument parsing; top-level signal handling      |
  | `game.py`          | Game orchestration; turn management; win/draw evaluation; controller     |
  | `board.py`         | Pure board state; move application; `render() -> str` (no I/O)           |
  | `player.py`        | `Player` base class with `HumanPlayer` and `AIPlayer` subclasses         |
  | `ai.py`            | AI strategies (Easy/Medium/Hard); accepts injectable `random.Random`     |
  | `score_manager.py` | Score loading, updating, atomic saving, schema validation/migration      |
  | `ui.py`            | All terminal I/O; menus; prompts; rendering; ANSI/TTY detection          |
  | `strings.py`       | All user-facing strings (NFR-009)                                        |

- Dependency direction: `main → game → {board, player, ai, score_manager}`; `ui` is invoked by `main` and `game` only; no module imports `ui` for output other than via injection.
- `score_manager` is accessed only by the `game` controller; the UI reads scores via the controller.
- No `print()` calls appear outside `ui.py`.
- No circular imports.
- The `Board` class accepts dimensions as constructor parameters (default 3×3) to ease future extension, even though variable sizes are out of scope (§7).

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
- The algorithm is contained within `ai.py` and exposed via a single function: `get_best_move(board: Board, ai_symbol: str, rng: random.Random | None = None) -> int`.
- The function is side-effect free (does not mutate the input board).
- Tie-break among equally-scored optimal moves: lowest-indexed cell (after the depth-aware score has resolved most ties).
- Hard AI never loses, verified by NFR-007's mandatory tests.

---

### TR-005 · Score File Format and Atomic Persistence

**Description:**
Scores shall be persisted in a structured, human-readable, versioned JSON file written atomically.

**Acceptance Criteria:**
- File name: `scores.json`, located per TR-006.
- File is written via the atomic pattern: write to `scores.json.tmp`, `fsync`, then `os.replace` to the target path.
- An advisory file lock is held during read-modify-write (NFR-006).
- JSON schema (v1):
  ```json
  {
    "schema_version": 1,
    "players": {
      "alice": { "display_name": "Alice", "wins": 3, "losses": 1, "draws": 1 },
      "bob":   { "display_name": "Bob",   "wins": 1, "losses": 3, "draws": 1 },
      "ai (hard)": { "display_name": "AI (Hard)", "wins": 5, "losses": 0, "draws": 2 }
    }
  }
  ```
- Player keys are lowercase for case-insensitive lookup; original casing is preserved in `display_name`.
- On load, if `schema_version` is absent or unrecognised, the loader attempts a documented migration; if migration is impossible, the user is warned and offered the choice to reset scores (rather than silently discarding old data).
- Randomness used by the AI (FR-009 etc.) is seedable via an injected `random.Random` instance; production code does not set a fixed seed, tests do.

---

### TR-006 · File Locations

**Description:**
Persistent files shall be stored in a predictable, OS-appropriate location.

**Acceptance Criteria:**
- Default base directory: `~/.tictactoe/` on POSIX; `%APPDATA%\tictactoe\` on Windows. (`platformdirs` may be used; otherwise OS detection is explicit.)
- Score file: `<base>/scores.json`. Backup: `<base>/scores.json.bak`. Log file: `<base>/app.log`.
- The directory is created automatically on first run if missing.
- The path is overridable via the `TICTACTOE_SCORES_PATH` environment variable, and further overridable via the `--scores-path` CLI flag (TR-009; CLI flag takes precedence).
- Write failures (permission denied, disk full) are caught and reported gracefully (NFR-003), never crashing the session.

---

### TR-007 · Input Handling and Validation

**Description:**
All user input shall be validated before processing.

**Acceptance Criteria:**
- All `input()` calls are wrapped in validation loops within `ui.py`.
- Reusable helpers exist:
  - `get_int_input(prompt: str, valid_range: range) -> int`
  - `get_str_input(prompt: str, min_len: int, max_len: int, allowed_pattern: re.Pattern) -> str`
  - `get_yes_no(prompt: str, default: bool) -> bool`
- Validators raise no unhandled exceptions regardless of input content.
- `EOFError` is caught at the top level (treated as graceful quit per NFR-003).

---

### TR-008 · Error Handling and Logging

**Description:**
The application shall handle runtime errors gracefully and log diagnostic information.

**Acceptance Criteria:**
- All file I/O is wrapped in `try/except` blocks catching specific exception types (no bare `except`).
- Python's `logging` module writes `WARNING` and `ERROR` events to `<base>/app.log` (TR-006) at default level.
- A `RotatingFileHandler` caps the log at 1 MB with one backup (`app.log.1`) to prevent unbounded growth.
- Log messages do not appear in the terminal under normal operation.
- `DEBUG`-level logging is enabled via the `--debug` CLI flag (TR-009) or `TTT_DEBUG=1` environment variable; in `--debug` mode, log records also stream to stderr.

---

### TR-009 · Command-Line Interface Arguments

**Description:**
The application shall support a documented set of command-line arguments parsed via `argparse`.

**Acceptance Criteria:**
- `--debug` — Sets logging to DEBUG; mirrors log output to stderr.
- `--scores-path <path>` — Overrides the score file location (takes precedence over `TICTACTOE_SCORES_PATH`).
- `--no-color` — Disables all ANSI colour output regardless of terminal capability (equivalent to `NO_COLOR` env var).
- `--version` — Prints the application version (TR-010) and exits with code 0.
- `python -m tictactoe --help` produces a clear usage summary covering all arguments.
- Unknown arguments produce a usage error and exit with code `2` (argparse standard).
- All flags are documented in `README.md`.

---

### TR-010 · Version Metadata

**Description:**
The application shall expose a version number from a single authoritative source.

**Acceptance Criteria:**
- A `__version__` string is defined in `tictactoe/__init__.py`.
- The version follows Semantic Versioning (`MAJOR.MINOR.PATCH`).
- `python -m tictactoe --version` prints `__version__`.
- The same value populates the `[project].version` field in `pyproject.toml`; a CI check enforces synchronisation.
- The version is referenced by the score-file `schema_version` migration logic (TR-005) for compatibility decisions.

---

### TR-011 · Testing Infrastructure

**Description:**
A `tests/` directory shall contain automated tests runnable from the project root.

**Acceptance Criteria:**
- Tests use `pytest` and `pytest-cov`.
- `pytest` from the project root runs the entire suite with no additional configuration.
- Coverage and mandatory test cases are as specified in NFR-007.
- Tests inject seeded `random.Random` instances into the AI to obtain deterministic outcomes.
- A CI-friendly invocation (`pytest --cov=tictactoe --cov-fail-under=90`) gates the build.

---

## 6. Assumptions & Constraints

| #   | Assumption / Constraint                                                                                                                                          |
|-----|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| A1  | The terminal supports at least 80 columns of width for proper board and table formatting.                                                                       |
| A2  | The user-config directory (TR-006) is writable; if not, score persistence fails gracefully with a warning.                                                      |
| A3  | Player names are unique within a session (case-insensitive); FR-003 enforces this.                                                                              |
| A4  | The board size is fixed at 3×3 for v1; the `Board` class is parameterised internally to ease future extension (TR-003).                                         |
| A5  | Concurrent multi-instance access to `scores.json` is out of scope; advisory locking (NFR-006) protects against accidental concurrent runs.                      |
| A6  | Unicode/emoji support is optional; ASCII fallbacks activate automatically based on `sys.stdout.encoding`.                                                       |
| A7  | Python 3.10 is the minimum supported version; structural pattern matching is permitted.                                                                         |
| A8  | The names `AI`, `Computer`, and the `AI (Easy/Medium/Hard)` variants (case-insensitive) are reserved for the system and rejected as human names (FR-003).       |
| A9  | The system clock is reliable enough for round-duration measurements (FR-018); no NTP guarantees required.                                                       |
| A10 | Stdin and stdout may or may not be TTYs; pipe-safe mode (UI-009) handles non-interactive use as a supported but non-primary case.                               |

---

## 7. Out of Scope

The following are explicitly **not** delivered in v1:

- **AI vs AI mode** — only HvH and HvAI are supported.
- **Online or networked multiplayer.**
- **Graphical user interface (GUI) or web frontend.**
- **Custom board sizes** (e.g., 4×4, 5×5) — fixed at 3×3. The `Board` class is parameterised to make future extension cheap.
- **User accounts or authentication.**
- **Sound effects or animations.**
- **Localisation / internationalisation** — English only for v1; codebase is structured for translation (NFR-009).
- **Row/column input format** — only the 1–9 numeric format is supported in v1.
- **Automated game replay or spectator mode** — move history is not recorded or replayable.
- **Persistence of round-level statistics** (FR-018's stats block is display-only).
- **Forfeit-as-loss semantics** — forfeits (FR-008) are not recorded in v1.

---

## 8. Glossary

- **HvH** — Human vs Human local play.
- **HvAI** — Human vs AI play.
- **Round** — A single game played from empty board to win or draw.
- **Session** — The period from launching the application to quitting it.
- **Minimax** — A recursive decision algorithm for two-player zero-sum games selecting the move that minimises the opponent's maximum payoff.
- **Alpha-beta pruning** — An optimisation of Minimax that skips branches proven irrelevant to the final decision.
- **Forfeit** — A player's voluntary mid-round abandonment (FR-008); not recorded as a win/loss in v1.
- **Pipe-safe mode** — Rendering mode active when stdout is not a TTY: ANSI codes suppressed, screen-clear skipped, plain dividers between board redraws (UI-009).
- **Atomic write** — File-write strategy where data is written to a temporary file then renamed to the target path, guaranteeing the target is never partially written (TR-005).
- **Schema version** — Integer field in `scores.json` identifying the data-format version, enabling forward-compatible migration (TR-005).
- **Reference machine** — Performance baseline defined in NFR-001: dual-core 2 GHz CPU, 2 GB RAM, Python 3.10.

---

*End of Software Requirements Specification — Tic Tac Toe v1.0 (Final)*
