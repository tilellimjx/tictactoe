# Tic Tac Toe – Software Requirements Specification

**Version:** 1.0 (Reviewed by Opus)
**Platform:** Command-Line Terminal (Python)
**Date:** 2025

> **[Opus: Overall review summary]** This is a strong, well-structured SRS — the use of separate FR/NFR/UI/TR sections with consistent acceptance criteria is exemplary. However, it has notable gaps around (1) starting-player fairness across rounds, (2) undo/quit-mid-game behaviour, (3) accessibility/colour, (4) localisation, (5) explicit handling of name collisions with the reserved label "AI", and (6) concurrency on the score file. I've added inline commentary throughout and appended new requirements (FR-017 through FR-022, NFR-007, UI-009, TR-008) at the end.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Functional Requirements](#2-functional-requirements)
3. [Non-Functional Requirements](#3-non-functional-requirements)
4. [User Interface Requirements](#4-user-interface-requirements)
5. [Technical Requirements](#5-technical-requirements)
6. [Assumptions & Constraints](#6-assumptions--constraints)
7. [Addendum – Additional Requirements (Opus)](#7-addendum--additional-requirements-opus)

---

## 1. Project Overview

This document specifies the requirements for a command-line Tic Tac Toe game implemented in Python. The game supports two modes — Human vs Human and Human vs AI — with three AI difficulty levels (Easy, Medium, Hard). Scores are tracked across rounds and persisted to a local file so they survive application restarts. After each game, players may choose to play again without restarting the application.

> **[Opus: Agree on scope, but the overview omits two things worth stating up front:]**
> 1. There is no AI vs AI mode — worth calling out explicitly so it isn't assumed.
> 2. The document doesn't state the target audience (casual players? CS students learning Minimax?). This affects polish vs. didactic clarity trade-offs.

---

## 2. Functional Requirements

---

### FR-001 · Game Mode Selection

**Description:**
At application startup, the system shall present the player with a main menu allowing them to choose between game modes: Human vs Human (HvH) or Human vs AI (HvAI).

**Acceptance Criteria:**
- A numbered menu listing `[1] Human vs Human`, `[2] Human vs AI`, and `[3] Quit` is displayed on launch.
- Selecting `1` initialises a HvH game session.
- Selecting `2` proceeds to AI difficulty selection (see FR-003).
- Selecting `3` gracefully exits the application.
- Any input outside the valid options triggers an error message and re-displays the menu.

> **[Opus: Inconsistency.]** FR-016 later mandates a `[4] View Scores` option in the main menu, but FR-001 only lists three options. These need to be reconciled — please update FR-001's acceptance criteria to include `[4] View Scores` (and renumber Quit to `[5]`), or relocate the View Scores option.

---

### FR-002 · Player Name Entry

**Description:**
Before a game begins, the system shall prompt each human player to enter a display name that is used throughout the session and in score tracking.

**Acceptance Criteria:**
- In HvH mode, two separate name prompts are shown (e.g., "Enter name for Player 1 (X): ").
- In HvAI mode, one name prompt is shown for the human player; the AI is labelled "AI" by default.
- Names must be between 1 and 20 characters.
- Blank or whitespace-only names are rejected with an inline error message, and the prompt is re-displayed.
- Names are trimmed of leading/trailing whitespace before use.

> **[Opus: Gaps.]**
> - What about a human player choosing the literal name "AI"? This would collide with the AI label and corrupt the score table. Reject it (case-insensitive) as a reserved name.
> - What characters are permitted? Allowing arbitrary unicode (including control characters, terminal escape sequences, or commas) could break table rendering and JSON safety. Constrain to printable characters; recommend a character whitelist or at minimum a blacklist of control chars.
> - In HvH, what if both players enter the same name? Per Assumption A3 this is disallowed, but the FR doesn't state how the system reacts. Make this explicit in acceptance criteria.
> - Should the player be offered an option to *reuse* an existing name from `scores.json` (so their record continues)? Currently the lookup is implicit — worth stating.

---

### FR-003 · AI Difficulty Selection

**Description:**
When Human vs AI mode is selected, the system shall allow the player to choose one of three AI difficulty levels.

**Acceptance Criteria:**
- A sub-menu displays `[1] Easy`, `[2] Medium`, `[3] Hard`.
- The selected difficulty is confirmed with a printed message (e.g., "Difficulty set to: Hard").
- Any input outside `1–3` triggers an error message and re-displays the sub-menu.
- The chosen difficulty level governs all AI moves for the entire game session (see FR-007, FR-008, FR-009).

> **[Opus: Agree.]** Clear and self-contained. Minor suggestion: include a brief one-line description of each difficulty alongside its menu entry (e.g., `[3] Hard – unbeatable`) so users can choose meaningfully without trial and error.

---

### FR-004 · Board Initialisation

**Description:**
At the start of every new game, the system shall initialise a clean 3×3 game board with all cells empty.

**Acceptance Criteria:**
- All 9 cells are empty/unoccupied at game start.
- Cells are addressed by a consistent coordinate scheme (positions 1–9, row-column notation, or similar) that is documented in the UI.
- The board state from any previous game does not persist into the new game.

> **[Opus: Agree.]** Solid. The "consistent coordinate scheme" should be pinned down (the doc later commits to 1–9 in UI-002 and FR-006); make that explicit here too rather than offering "or similar".

---

### FR-005 · Turn Management

**Description:**
The system shall alternate turns between the two players (or player and AI) starting with Player 1 / the human player, who is always assigned the "X" symbol.

**Acceptance Criteria:**
- Player 1 (or the human in HvAI) is always "X" and always moves first.
- Player 2 (or the AI) is always "O".
- After each valid move, the active player switches.
- The current player's name and symbol are clearly indicated before each turn prompt.
- In HvAI mode, the AI turn is triggered automatically without requiring human input to advance.

> **[Opus: Disagree — fairness issue.]** Always letting "X"/Player 1 go first is unfair across multiple rounds, because the first player has a measurable advantage (especially against a non-perfect opponent). For a session of repeated rounds tracked on a scoreboard, this materially skews recorded win rates. Recommendations:
> - Alternate the starting player each round, **or**
> - Let the loser of the previous round start the next, **or**
> - At minimum, randomise the starter on round 2+.
> See new requirement **FR-017** in the addendum.

---

### FR-006 · Human Player Move Input

**Description:**
On a human player's turn, the system shall accept a cell selection via keyboard input, validate it, and apply it to the board.

**Acceptance Criteria:**
- The player is prompted to enter a cell position using a clearly described notation (e.g., 1–9).
- A visual legend or labelled board is available so the player knows which number maps to which cell.
- Non-integer input produces the message: `"Invalid input. Please enter a number between 1 and 9."` and re-prompts.
- A number outside 1–9 produces the same error message and re-prompts.
- Selecting an already-occupied cell produces: `"Cell already taken. Choose another."` and re-prompts.
- Valid input places the current player's symbol on the selected cell and advances the game.

> **[Opus: Gap.]** No way to abandon a game in progress. A player who must leave is forced to either play out the round or `Ctrl+C` (which per NFR-003 saves and exits the whole app). Add a special command at the input prompt — e.g., entering `q` or `quit` returns to the main menu without recording a result, after a confirmation prompt. Captured in new requirement **FR-018**.

---

### FR-007 · AI Move – Easy Difficulty

**Description:**
On Easy difficulty, the AI shall select its move uniformly at random from all currently available (unoccupied) cells.

**Acceptance Criteria:**
- The AI never selects an occupied cell.
- Move selection has no strategic bias; any empty cell is equally probable.
- The chosen cell is printed to the terminal (e.g., `"AI plays at position 5"`).
- The AI move completes within 0.5 seconds.

> **[Opus: Agree, with one note.]** For testability and reproducibility, the random seed source should be pluggable (default to a fresh seed in production, allow injection in tests). This is implied by TR-006's expectation of testing AI Easy, but should be stated. See **TR-008** in the addendum.

---

### FR-008 · AI Move – Medium Difficulty

**Description:**
On Medium difficulty, the AI shall apply a rule-based heuristic: win if possible, block the opponent's immediate win if possible, otherwise choose randomly.

**Acceptance Criteria:**
- If the AI can win in one move, it always takes that move.
- If the opponent can win in one move and the AI cannot win, it always blocks that move.
- In all other situations, the AI selects randomly from remaining empty cells.
- The AI never selects an occupied cell.
- The chosen cell is printed to the terminal.
- The AI move completes within 0.5 seconds.

> **[Opus: Disagree — Medium is too weak.]** Pure win/block/random produces an AI that is barely distinguishable from Easy when neither side has an immediate threat. The opening move in particular will be random, often gifting the human a forked win. Consider strengthening Medium with one or two additional priorities, e.g.:
> 1. Win, 2. Block, 3. Take centre if free, 4. Take a corner opposite the opponent, 5. Random.
> This widens the gap between Easy and Medium meaningfully. If retained as-is, document the expected behaviour clearly so testers don't flag it as a bug.

---

### FR-009 · AI Move – Hard Difficulty

**Description:**
On Hard difficulty, the AI shall play optimally using the Minimax algorithm, making it unbeatable (the best achievable result against it is a draw).

**Acceptance Criteria:**
- The AI always selects the move with the highest Minimax score.
- A perfect human player can force at most a draw; the AI never loses.
- The AI never selects an occupied cell.
- The chosen cell is printed to the terminal.
- The AI move completes within 2 seconds on a standard modern machine (alpha-beta pruning is recommended).

> **[Opus: Agree.]** Two minor refinements:
> - Among multiple equally-scored optimal moves, specify a tie-break rule (e.g., prefer the move with the fewest plies to victory, or the lowest-indexed cell). Without this the AI's behaviour is non-deterministic, complicating tests.
> - 2 seconds is extremely generous for 3×3 Minimax (uncached search visits ~5,500 nodes; pruned, far fewer). Tighten to 200 ms — if it ever takes 2 s, something is wrong.

---

### FR-010 · Win Detection

**Description:**
After every move, the system shall check whether the current player has won the game by occupying three cells in a winning line.

**Acceptance Criteria:**
- All 8 winning lines are evaluated: 3 rows, 3 columns, 2 diagonals.
- A win is detected immediately after the move that completes a winning line.
- On detection, the winning player's name and symbol are announced (e.g., `"Alice (X) wins!"`).
- The winning cells are visually distinguished in the final board display (e.g., enclosed in `[ ]` or marked with `*`).
- The win is recorded in the score tracker (see FR-013).

> **[Opus: Agree.]** Good. Note that highlighting the winning line is a nice UX touch and should be tested explicitly.

---

### FR-011 · Draw Detection

**Description:**
After every move, if no winning condition is met and no empty cells remain, the system shall declare a draw.

**Acceptance Criteria:**
- A draw is detected only when all 9 cells are filled and neither player has a winning line.
- The message `"It's a draw!"` is displayed.
- The draw is recorded in the score tracker as a draw (see FR-013).

> **[Opus: Minor optimisation suggestion.]** A "forced draw" can sometimes be detected before all 9 cells are filled (when no winning line remains achievable for either side). For UX it's fine to wait until the board fills, but for the Hard AI's Minimax this short-circuit may matter for performance. Not a bug — just a note.

---

### FR-012 · Game End & Round Summary

**Description:**
After a win or draw is detected, the system shall display a round summary and then prompt the players for their next action.

**Acceptance Criteria:**
- The final board state is displayed.
- The outcome (winner name or draw) is clearly announced.
- The current cumulative scores for all players are displayed (see FR-016).
- The replay/exit prompt is shown (see FR-015).

> **[Opus: Agree.]** Consider adding round duration / move count to the summary — it costs little and adds engagement.

---

### FR-013 · Score Tracking

**Description:**
The system shall maintain a running score for each named player across all rounds in the current session and across sessions (via file persistence).

**Acceptance Criteria:**
- Each player's record tracks: wins, losses, draws, and games played.
- Scores are updated immediately after each game outcome.
- Score data is keyed by player name (case-insensitive).
- Scores accumulated in previous sessions (loaded from file) are added to the current session totals.

> **[Opus: Gaps.]**
> - Should AI wins/losses be tracked separately by difficulty level? Otherwise an "AI" record conflates wins against beginners and losses against Hard, which is misleading. Recommend keying AI records as `AI (Easy)`, `AI (Medium)`, `AI (Hard)`.
> - "Games played" is redundant — it's always wins + losses + draws. Drop it or compute it on display.
> - No requirement for clearing/resetting scores. Useful for testing and for users who want a fresh start. See **FR-019**.

---

### FR-014 · Score Persistence

**Description:**
Player scores shall be saved to a local file after every game so they are not lost when the application closes.

**Acceptance Criteria:**
- Scores are written to a file named `scores.json` (or `scores.csv`) in the application's working directory.
- The file is updated after every completed game round.
- On application start, if the score file exists and is valid, scores are loaded automatically.
- If the score file is missing, a new empty score file is created silently.
- If the score file is corrupted or unparseable, a warning is printed and the session starts with empty scores; the corrupt file is backed up as `scores.json.bak`.
- The file format is human-readable (JSON preferred).

> **[Opus: Inconsistency.]** This FR says "JSON or CSV", TR-002 commits firmly to JSON. Drop the CSV alternative here. Also, "application's working directory" is ambiguous when launched from elsewhere — TR-002 says "same directory as `main.py`". Pick one and use the user's home dir or an OS-appropriate config dir for cross-platform friendliness (e.g., `~/.tictactoe/scores.json`).

---

### FR-015 · Replay Option

**Description:**
After each completed game, the system shall offer the players the option to play again or return to the main menu.

**Acceptance Criteria:**
- The prompt displays: `"Play again? [1] Yes  [2] Return to Main Menu  [3] Quit"`.
- Selecting `1` starts a new game with the same players and settings (names, mode, difficulty), resetting only the board.
- Selecting `2` returns to the main menu (FR-001), allowing mode or difficulty to be changed.
- Selecting `3` saves scores and exits the application gracefully.
- Any invalid input re-displays the prompt.

> **[Opus: Agree.]** Clean. Tie this to FR-017 (alternating starter) so the new round respects fairness rules.

---

### FR-016 · Score Display

**Description:**
The system shall display the current cumulative scores for all participating players on demand and automatically after each round.

**Acceptance Criteria:**
- Scores are shown in a formatted table with columns: Player, Wins, Losses, Draws, Games Played.
- Scores are displayed automatically as part of the round summary (FR-012).
- A `[4] View Scores` option is available in the main menu to view scores without starting a game.
- If no scores exist yet, the message `"No scores recorded yet."` is shown.

> **[Opus: See FR-001 commentary]** — the menu listing in FR-001 must be amended to include this `[4]`. Also: should the on-demand view show *all* players ever recorded, or only those in the current session? Recommend all, with an option to filter.

---

## 3. Non-Functional Requirements

---

### NFR-001 · Performance

**Description:**
The game shall respond to all player inputs and compute all AI moves within acceptable time limits to ensure a smooth experience.

**Acceptance Criteria:**
- All human input processing and UI rendering completes within 100 ms.
- Easy and Medium AI moves complete within 500 ms.
- Hard AI (Minimax) moves complete within 2 seconds on a machine with a 1 GHz+ CPU.
- File I/O for score persistence completes within 500 ms.

> **[Opus: Disagree on Hard AI budget.]** As noted under FR-009, 2 s is excessive. 200 ms is plenty even on a Raspberry Pi. The "1 GHz+ CPU" baseline is also vague — name a concrete reference machine or remove it.

---

### NFR-002 · Usability

**Description:**
The game shall be intuitive and easy to use for players with no prior experience with the application.

**Acceptance Criteria:**
- All prompts clearly state the expected input format and valid range.
- A cell-position legend is displayed alongside the board at all times during play.
- Error messages are specific, human-readable, and actionable.
- A first-time user can start and complete a game without reading any external documentation.

> **[Opus: Agree.]** Could add a measurable acceptance criterion: e.g., "5 of 5 first-time users in informal usability testing complete a game without help."

---

### NFR-003 · Reliability

**Description:**
The game shall handle all erroneous or unexpected inputs gracefully without crashing.

**Acceptance Criteria:**
- No unhandled Python exceptions reach the terminal during normal operation.
- Invalid inputs at any prompt result in an error message and a re-prompt, never a crash.
- Interruption via `Ctrl+C` is caught; a confirmation prompt is shown and scores are saved before exit.
- File I/O failures (disk full, permission denied) are caught and reported without terminating the game session.

> **[Opus: Concern — `Ctrl+C` confirmation prompt is hostile.]** Many users hit `Ctrl+C` *because* they want immediate exit. Adding a confirmation that itself can be `Ctrl+C`'d again is fine, but make sure a second `Ctrl+C` exits immediately (saving scores via an `atexit` handler). Don't loop forever asking.

---

### NFR-004 · Maintainability

**Description:**
The codebase shall be structured and documented to facilitate future enhancements and debugging.

**Acceptance Criteria:**
- The code is organised into logical modules or classes (e.g., `Board`, `Player`, `AI`, `ScoreManager`, `UI`).
- All public functions and classes include docstrings.
- No single function exceeds 50 lines of code.
- The codebase passes `pylint` or `flake8` linting with a score ≥ 8/10.
- A `README.md` file documents how to run the game and a description of the project layout.

> **[Opus: Agree.]** Solid. Add type hints (PEP 484) as a criterion — they're free documentation and `mypy --strict` is a useful gate.

---

### NFR-005 · Portability

**Description:**
The game shall run on any operating system that supports Python 3.8 or above without modification.

**Acceptance Criteria:**
- The game runs correctly on Windows, macOS, and Linux.
- No OS-specific libraries or terminal escape codes are used that are not cross-platform.
- The game uses only Python standard library modules (no third-party `pip` dependencies required to run the core game).

> **[Opus: Watch out for Windows.]** UI-007's box-drawing characters (`╔ ╦ ╗`) and UI-006's emoji (`🎉`) won't render in older Windows `cmd.exe` without UTF-8 codepage tweaks. The doc handles this via Assumption A6 ("ASCII fallbacks"), but make the fallback path concrete: detect via `sys.stdout.encoding` and switch automatically.

---

### NFR-006 · Security & Data Integrity

**Description:**
The score file shall be written atomically to prevent data corruption in the event of an unexpected shutdown during a write.

**Acceptance Criteria:**
- Scores are written to a temporary file first, then renamed to the target file (atomic replace pattern).
- The score file does not contain any executable code or sensitive user data beyond names and scores.

> **[Opus: Agree, but add file-locking.]** If two instances of the app run concurrently (which Assumption A5 says is out of scope, but users will do it anyway), the atomic rename can still cause one instance's writes to clobber the other's. A simple advisory lock (`fcntl.flock` on POSIX, `msvcrt.locking` on Windows) over the score file mitigates this. See **NFR-007** in the addendum.

---

## 4. User Interface Requirements

---

### UI-001 · Main Menu Display

**Description:**
The application shall display a clear, formatted main menu on startup and whenever the player returns to it.

**Acceptance Criteria:**
- The terminal is cleared (or a clear separator is printed) before the menu is displayed.
- The game title (`TIC TAC TOE`) is shown as an ASCII banner at the top.
- Menu options are numbered and vertically listed.
- The menu is re-displayed after every invalid selection.

> **[Opus: Concern.]** Clearing the terminal (`os.system("cls"|"clear")`) destroys scrollback, which annoys users who want to review previous rounds. Prefer printing a separator/banner. Also `os.system` is a portability footgun — use `print("\033[2J\033[H")` only if you've detected ANSI support, otherwise just print blank lines.

---

### UI-002 · Board Rendering

**Description:**
The game board shall be rendered in the terminal as a clearly readable 3×3 grid after every move and at the start of each turn.

**Acceptance Criteria:**
- The board is drawn using ASCII characters with cell separators (e.g., `|` and `---`).
- Each cell displays either the player symbol (`X` or `O`) or the cell's position number if empty, so the position legend is always visible.
- The board is reprinted in full after every move; previous board states scroll up naturally.
- Example board appearance:
  ```
   1 | X | 3
  ---+---+---
   4 | O | 6
  ---+---+---
   7 | 8 | 9
  ```

> **[Opus: Agree, this is excellent.]** Showing position numbers in empty cells doubles as a permanent legend — best-practice for a CLI tic-tac-toe.

---

### UI-003 · Turn Indicator

**Description:**
Before each move, the system shall clearly indicate whose turn it is.

**Acceptance Criteria:**
- The active player's name and symbol are displayed (e.g., `"Alice's turn (X)"`).
- In HvAI mode, when it is the AI's turn, the message `"AI is thinking..."` is briefly displayed before the AI move is revealed.
- The indicator is printed immediately above the input prompt.

> **[Opus: Minor.]** The "AI is thinking..." pause should be artificial and bounded — do not synthesise a delay > 1 s for Easy/Medium just to feel "real". Recommend ~300 ms only when the actual computation is faster than that.

---

### UI-004 · Input Prompt

**Description:**
Human players shall be guided by a consistent, clearly worded input prompt on every turn.

**Acceptance Criteria:**
- The prompt reads: `"Enter position (1-9): "` or equivalent.
- The cursor appears immediately after the prompt on the same line.
- After an invalid entry, the error message appears on a new line and the prompt is repeated.

> **[Opus: Agree.]** Add: prompt should also document the quit shortcut once FR-018 is incorporated, e.g., `"Enter position (1-9, or 'q' to quit round): "`.

---

### UI-005 · Invalid Input Feedback

**Description:**
All invalid inputs shall produce an immediate, descriptive inline error message without clearing useful screen context.

**Acceptance Criteria:**
- Non-numeric input: `"Invalid input. Please enter a number between 1 and 9."`
- Out-of-range number: `"Invalid input. Please enter a number between 1 and 9."`
- Already-occupied cell: `"Cell [n] is already taken. Please choose an empty cell."`
- Invalid menu choice: `"Invalid choice. Please select one of the listed options."`
- No board re-render is required for input errors; only the error line and a new prompt are printed.

> **[Opus: Agree.]** Hard-coding error strings here is fine for a v1, but if NFR-008 (localisation, see addendum) is later adopted, these strings must be moved to a resource catalogue.

---

### UI-006 · Game Result Announcement

**Description:**
The outcome of each game shall be announced with a prominent, visually distinct message.

**Acceptance Criteria:**
- Win message: `"🎉 [Player Name] ([Symbol]) wins! Congratulations!"` (or ASCII equivalent without emoji if the terminal does not support Unicode).
- Draw message: `"It's a draw! Well played by both sides."`
- The final board state is displayed immediately before the result message.

> **[Opus: Agree.]** Tie this to FR-010's "winning cells visually distinguished" — make sure both that highlight AND this announcement are present in the same screen.

---

### UI-007 · Score Scoreboard Display

**Description:**
The score table shall be formatted for easy reading in a fixed-width terminal.

**Acceptance Criteria:**
- Columns: `Player`, `Wins`, `Losses`, `Draws`, `Played` — each right-padded to a fixed width.
- A header row and a horizontal divider line are included.
- Players are listed in descending order of wins.
- Example:
  ```
  ╔══════════════════════════════════════╗
  ║            SCOREBOARD                ║
  ╠═════════╦═══════╦════════╦═══════╦══╣
  ║ Player  ║  Wins ║ Losses ║ Draws ║ P║
  ╠═════════╬═══════╬════════╬═══════╬══╣
  ║ Alice   ║     3 ║      1 ║     1 ║ 5║
  ║ Bob     ║     1 ║      3 ║     1 ║ 5║
  ╚═════════╩═══════╩════════╩═══════╩══╝
  ```

> **[Opus: Disagree on the example.]** The box-drawing example is misaligned (the right-edge ║ characters don't line up — the header divider truncates `Played` to `P`). Either redesign the example with consistent column widths or use a simpler ASCII-only table. Also, secondary sort key for ties (e.g., fewer losses, then alphabetical) should be specified.

---

### UI-008 · Exit Message

**Description:**
When the application exits, it shall display a farewell message and confirm that scores have been saved.

**Acceptance Criteria:**
- Message displayed: `"Scores saved. Thanks for playing! Goodbye."`
- The message appears regardless of exit path (menu quit, replay prompt quit, or `Ctrl+C`).

> **[Opus: Concern.]** "Regardless of exit path" is hard to guarantee for a hard kill (`SIGKILL`, terminal close). State this as best-effort, and use `atexit`/signal handlers as the implementation. If the score file write fails, the message should *not* claim "Scores saved." — it should report the failure honestly.

---

## 5. Technical Requirements

---

### TR-001 · Language & Runtime

**Description:**
The game shall be implemented in Python and must be runnable with a standard Python interpreter.

**Acceptance Criteria:**
- The codebase is written in Python 3.8+.
- The entry point is a single executable script (e.g., `python main.py` or `python -m tictactoe`).
- No third-party packages are required to run the game (standard library only).
- Optional development dependencies (e.g., `pytest`, `flake8`) may be listed in a `requirements-dev.txt`.

> **[Opus: Agree.]** Python 3.8 is reasonable but reaches EOL October 2024 — consider 3.10+ as the floor (gains structural pattern matching, useful for menu dispatch).

---

### TR-002 · Score File Format & Location

**Description:**
Scores shall be persisted in a structured, human-readable file using the JSON format.

**Acceptance Criteria:**
- File name: `scores.json`, located in the same directory as `main.py` by default.
- The file path shall be configurable via a constant at the top of the `ScoreManager` module.
- JSON schema:
  ```json
  {
    "players": {
      "alice": { "wins": 3, "losses": 1, "draws": 1, "played": 5 },
      "bob":   { "wins": 1, "losses": 3, "draws": 1, "played": 5 }
    }
  }
  ```
- Player name keys are stored in lowercase for case-insensitive lookup.

> **[Opus: Gap — schema versioning.]** No `"version"` field. The first time you change the schema (e.g., to add per-difficulty AI tracking from my FR-013 comment), every existing scores.json becomes ambiguous. Add `"schema_version": 1` to the top level and a migration path.
> Also: the JSON loses the *display* casing of names (since keys are lowercased). Store both: key=lowercase, with a `"display_name"` field inside.

---

### TR-003 · Code Architecture

**Description:**
The codebase shall follow a modular, object-oriented architecture with clear separation of concerns.

**Acceptance Criteria:**
- Recommended module structure:
  | Module            | Responsibility                                      |
  |-------------------|-----------------------------------------------------|
  | `main.py`         | Entry point; application loop                       |
  | `game.py`         | Game orchestration; turn management; win/draw logic |
  | `board.py`        | Board state; rendering; move application            |
  | `player.py`       | Human and AI player classes                         |
  | `ai.py`           | AI strategy implementations (Easy/Medium/Hard)      |
  | `score_manager.py`| Score loading, updating, saving                     |
  | `ui.py`           | All terminal I/O, prompts, menus, display helpers   |
- All game logic is unit-testable independently of terminal I/O.
- UI output is isolated in `ui.py`; no `print()` statements appear in non-UI modules.

> **[Opus: Disagree slightly.]** Putting board *rendering* in `board.py` while saying "no print() outside ui.py" is contradictory. Move render to `ui.py` and have `board.py` expose a pure `__str__`/`render()` returning a string. Otherwise, structure is clean.

---

### TR-004 · AI Algorithm – Hard Mode

**Description:**
The Hard AI shall use the Minimax algorithm, optionally enhanced with alpha-beta pruning for performance.

**Acceptance Criteria:**
- Minimax recursively evaluates all game tree nodes from the current board state.
- Scores: AI win = +10, human win = −10, draw = 0.
- Alpha-beta pruning is implemented to reduce the search tree (recommended, not strictly required).
- The algorithm is contained within `ai.py` and exposed via a single function: `get_best_move(board, ai_symbol) -> int`.
- The function is side-effect free (does not modify the board passed to it).

> **[Opus: Subtle bug risk.]** With scores `{+10, −10, 0}` and no depth penalty, the AI is indifferent between a win in 1 ply and a win in 5 plies. It may "toy with" the human by choosing a slow win. Use `score = 10 - depth` for AI wins and `score = depth - 10` for human wins so the AI wins as fast as possible and loses as slowly as possible (relevant when paired against another sub-optimal opponent in tests).

---

### TR-005 · Input Handling & Validation

**Description:**
All user input shall be validated before processing, with no raw unvalidated data reaching game logic.

**Acceptance Criteria:**
- All `input()` calls are wrapped in validation loops within `ui.py`.
- A reusable `get_int_input(prompt, valid_range)` helper function handles numeric prompts.
- A reusable `get_str_input(prompt, min_len, max_len)` helper handles text prompts.
- Validators raise no unhandled exceptions regardless of input content.

> **[Opus: Agree.]** Don't forget EOF handling — `input()` raises `EOFError` if stdin closes (piped input, redirected file). Wrap once at top level.

---

### TR-006 · Testing

**Description:**
Core game logic shall be covered by automated unit tests to ensure correctness.

**Acceptance Criteria:**
- A `tests/` directory contains unit tests using Python's `unittest` or `pytest` framework.
- Test coverage includes at minimum:
  - Win detection for all 8 winning lines.
  - Draw detection on a full board with no winner.
  - AI Easy mode never selects an occupied cell.
  - AI Hard mode never loses (simulate full games against random player).
  - Score persistence: save then reload produces identical data.
- Tests are runnable with `pytest` from the project root with no additional configuration.

> **[Opus: Agree, with strengthened criteria.]**
> - Add a coverage threshold (e.g., ≥ 85 % branch coverage on game/board/ai modules).
> - "AI Hard never loses" should be tested against *both* a random player AND an exhaustive brute-force opponent (every legal opening sequence). Otherwise a flaky bug in a rare line could slip through.
> - Test the corrupt-scores-file recovery path explicitly (FR-014).

---

### TR-007 · Error Handling & Logging

**Description:**
The application shall handle runtime errors gracefully and optionally log diagnostic information.

**Acceptance Criteria:**
- All file I/O operations are wrapped in `try/except` blocks with specific exception types.
- A simple logging setup using Python's `logging` module writes `WARNING`/`ERROR` events to `tictactoe.log` in the working directory.
- Log messages are not displayed in the terminal under normal operation.
- `DEBUG`-level logging can be enabled via a command-line flag (`--debug`) or environment variable (`TTT_DEBUG=1`).

> **[Opus: Concern.]** Writing a log file unconditionally in the working directory has the same writeability concerns as scores.json (Assumption A2), and could surprise users who launch from `/usr/local/bin`. Either write to the same dir as scores.json (preferably a user-config dir), or only create the log file when `--debug` is set. Also implement log rotation to avoid unbounded growth.

---

## 6. Assumptions & Constraints

| # | Assumption / Constraint |
|---|-------------------------|
| A1 | The terminal supports at least 80 columns of width for proper board and table formatting. |
| A2 | The working directory is writable; if not, score persistence fails gracefully with a warning. |
| A3 | Player names are unique within a session; two players may not share the same name (case-insensitive). |
| A4 | The board size is fixed at 3×3; variable board size is out of scope for this version. |
| A5 | Only one game session runs at a time; concurrent multi-user access to `scores.json` is out of scope. |
| A6 | Unicode/emoji support in the terminal is treated as optional; all UI elements have ASCII fallbacks. |
| A7 | Python 3.8 is the minimum supported version; no compatibility with Python 2 is required. |

> **[Opus: Add to the table:]**
> - **A8** — The reserved name "AI" (case-insensitive) is not selectable by human players.
> - **A9** — The system clock is reliable enough for round-duration measurements; no NTP guarantees required.
> - **A10** — Terminal stdin and stdout are line-buffered TTYs; piped input is handled but not a primary use case.

---

## 7. Addendum — Additional Requirements (Opus)

The following requirements address gaps identified during review.

---

### FR-017 · Starting-Player Fairness Across Rounds

**Description:**
To prevent the first-move advantage from systematically biasing scoreboard results across a multi-round session, the system shall vary which player moves first across rounds.

**Acceptance Criteria:**
- In round 1 of a session, Player 1 / the human is X and moves first (preserves current FR-005 default).
- In every subsequent round started via FR-015's "Play again", the starting player alternates: round 2 starts with the other player, round 3 with the original, and so on.
- The X/O symbol allocation moves with the player — i.e., the player who moves first in a given round always plays X.
- The starting-player rotation resets when a session returns to the main menu and starts a new game configuration.
- The current round's starting player and symbols are clearly announced before the first move.

---

### FR-018 · Quit / Forfeit a Round in Progress

**Description:**
A player shall be able to abandon the current round mid-game and return to the main menu without crashing the application or producing an inconsistent score record.

**Acceptance Criteria:**
- Entering `q`, `Q`, `quit`, or `exit` at the move-input prompt triggers a forfeit confirmation.
- On confirmation, the round is abandoned and **not** recorded in the score tracker (it is treated as if the round never occurred).
- After confirmation, the system returns to the main menu (FR-001).
- Cancelling the confirmation returns the player to the same move prompt with the board unchanged.
- Forfeit is unavailable during the AI's turn (it has no input prompt) — the human must wait their next turn.

---

### FR-019 · Score Reset

**Description:**
The user shall have an explicit, confirmed mechanism to clear the persisted score data.

**Acceptance Criteria:**
- A `[5] Reset Scores` option (or similar) is available in the main menu.
- Selecting it shows a confirmation prompt: `"This will permanently delete all scores. Are you sure? [y/N]"`.
- On `y`/`yes`, the in-memory score store and the on-disk `scores.json` are cleared (or replaced with an empty schema).
- On any other input, the action is cancelled and the menu re-displayed.
- A backup of the previous file is written to `scores.json.bak` before deletion.

---

### FR-020 · Reserved Name Protection

**Description:**
The literal name `AI` (any casing) shall be reserved for the system AI player and rejected as a human player name.

**Acceptance Criteria:**
- Entering `AI`, `ai`, `Ai`, etc. as a human player name produces: `"That name is reserved. Please choose another."` and re-prompts.
- The check applies to both Player 1 and Player 2 in HvH mode.

---

### FR-021 · AI Opponent Score Disambiguation

**Description:**
The AI's score record shall be split by difficulty so that statistics are meaningful.

**Acceptance Criteria:**
- AI records appear as separate entries: `AI (Easy)`, `AI (Medium)`, `AI (Hard)`.
- Each AI record accumulates only games played at that difficulty.
- The scoreboard renders all three entries (with zero-rows where applicable, or hidden if never played — implementer's choice, but consistent).

---

### FR-022 · Round Statistics in Summary

**Description:**
The end-of-round summary (FR-012) shall include a small stats block to enrich the experience and aid debugging.

**Acceptance Criteria:**
- Total moves played in the round.
- Wall-clock duration of the round (mm:ss).
- For HvAI rounds, the average AI move computation time in milliseconds.
- These stats are *not* persisted to `scores.json` in v1 (display only).

---

### NFR-007 · Concurrent-Access Safety

**Description:**
While simultaneous multi-instance operation is out of scope (A5), the score file shall not be left in a corrupt state if it is nonetheless accessed concurrently.

**Acceptance Criteria:**
- The atomic write pattern from NFR-006 is preserved.
- An advisory lock is acquired on the score file during the read-modify-write cycle (`fcntl.flock` on POSIX, `msvcrt.locking` on Windows).
- If the lock cannot be acquired within 2 seconds, a warning is logged and the write is skipped (in-memory scores remain correct for the current session).

---

### NFR-008 · Localisation Readiness (Future-Proofing)

**Description:**
While v1 ships in English only, the codebase shall be structured to allow translation without refactoring.

**Acceptance Criteria:**
- All user-facing strings are defined in a single module (e.g., `strings.py`) or constant dictionary, **not** inline in logic code.
- No string concatenation that assumes English word order (use formatted templates with named placeholders).
- This is a soft requirement — no actual translations are required for v1.

---

### UI-009 · Accessibility & Colour Use

**Description:**
The UI shall remain readable for users with colour-vision deficiencies and on terminals without ANSI colour support.

**Acceptance Criteria:**
- Information shall never be conveyed by colour alone — symbol, position, or text always carries the meaning.
- If ANSI colours are used (e.g., to highlight winning cells), they degrade gracefully when `NO_COLOR` env var is set or stdout is not a TTY.
- The X and O symbols are visually distinct without colour (which they inherently are).
- Winning-line highlight (FR-010) uses both a textual marker (e.g., `*` or `[ ]`) and optionally colour, never colour alone.

---

### TR-008 · Determinism & Test-Seeding for Random Behaviour

**Description:**
Randomised AI behaviour shall be seedable to support reproducible tests.

**Acceptance Criteria:**
- The AI module accepts an optional `random.Random` instance via constructor or function parameter; defaults to a module-level `random.Random()` seeded from system entropy.
- Tests pass an instance with a fixed seed to obtain deterministic outcomes.
- Production code never sets a fixed seed.

---

*End of Reviewed Requirements Specification — Tic Tac Toe v1.0 (with Opus annotations and addendum)*
