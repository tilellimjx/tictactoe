# Tic Tac Toe – Software Requirements Specification

**Version:** 1.0
**Platform:** Command-Line Terminal (Python)
**Date:** 2025

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Functional Requirements](#2-functional-requirements)
3. [Non-Functional Requirements](#3-non-functional-requirements)
4. [User Interface Requirements](#4-user-interface-requirements)
5. [Technical Requirements](#5-technical-requirements)
6. [Assumptions & Constraints](#6-assumptions--constraints)

---

## 1. Project Overview

This document specifies the requirements for a command-line Tic Tac Toe game implemented in Python. The game supports two modes — Human vs Human and Human vs AI — with three AI difficulty levels (Easy, Medium, Hard). Scores are tracked across rounds and persisted to a local file so they survive application restarts. After each game, players may choose to play again without restarting the application.

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

---

### FR-003 · AI Difficulty Selection

**Description:**
When Human vs AI mode is selected, the system shall allow the player to choose one of three AI difficulty levels.

**Acceptance Criteria:**
- A sub-menu displays `[1] Easy`, `[2] Medium`, `[3] Hard`.
- The selected difficulty is confirmed with a printed message (e.g., "Difficulty set to: Hard").
- Any input outside `1–3` triggers an error message and re-displays the sub-menu.
- The chosen difficulty level governs all AI moves for the entire game session (see FR-007, FR-008, FR-009).

---

### FR-004 · Board Initialisation

**Description:**
At the start of every new game, the system shall initialise a clean 3×3 game board with all cells empty.

**Acceptance Criteria:**
- All 9 cells are empty/unoccupied at game start.
- Cells are addressed by a consistent coordinate scheme (positions 1–9, row-column notation, or similar) that is documented in the UI.
- The board state from any previous game does not persist into the new game.

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

---

### FR-007 · AI Move – Easy Difficulty

**Description:**
On Easy difficulty, the AI shall select its move uniformly at random from all currently available (unoccupied) cells.

**Acceptance Criteria:**
- The AI never selects an occupied cell.
- Move selection has no strategic bias; any empty cell is equally probable.
- The chosen cell is printed to the terminal (e.g., `"AI plays at position 5"`).
- The AI move completes within 0.5 seconds.

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

---

### FR-011 · Draw Detection

**Description:**
After every move, if no winning condition is met and no empty cells remain, the system shall declare a draw.

**Acceptance Criteria:**
- A draw is detected only when all 9 cells are filled and neither player has a winning line.
- The message `"It's a draw!"` is displayed.
- The draw is recorded in the score tracker as a draw (see FR-013).

---

### FR-012 · Game End & Round Summary

**Description:**
After a win or draw is detected, the system shall display a round summary and then prompt the players for their next action.

**Acceptance Criteria:**
- The final board state is displayed.
- The outcome (winner name or draw) is clearly announced.
- The current cumulative scores for all players are displayed (see FR-016).
- The replay/exit prompt is shown (see FR-015).

---

### FR-013 · Score Tracking

**Description:**
The system shall maintain a running score for each named player across all rounds in the current session and across sessions (via file persistence).

**Acceptance Criteria:**
- Each player's record tracks: wins, losses, draws, and games played.
- Scores are updated immediately after each game outcome.
- Score data is keyed by player name (case-insensitive).
- Scores accumulated in previous sessions (loaded from file) are added to the current session totals.

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

---

### FR-016 · Score Display

**Description:**
The system shall display the current cumulative scores for all participating players on demand and automatically after each round.

**Acceptance Criteria:**
- Scores are shown in a formatted table with columns: Player, Wins, Losses, Draws, Games Played.
- Scores are displayed automatically as part of the round summary (FR-012).
- A `[4] View Scores` option is available in the main menu to view scores without starting a game.
- If no scores exist yet, the message `"No scores recorded yet."` is shown.

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

---

### NFR-002 · Usability

**Description:**
The game shall be intuitive and easy to use for players with no prior experience with the application.

**Acceptance Criteria:**
- All prompts clearly state the expected input format and valid range.
- A cell-position legend is displayed alongside the board at all times during play.
- Error messages are specific, human-readable, and actionable.
- A first-time user can start and complete a game without reading any external documentation.

---

### NFR-003 · Reliability

**Description:**
The game shall handle all erroneous or unexpected inputs gracefully without crashing.

**Acceptance Criteria:**
- No unhandled Python exceptions reach the terminal during normal operation.
- Invalid inputs at any prompt result in an error message and a re-prompt, never a crash.
- Interruption via `Ctrl+C` is caught; a confirmation prompt is shown and scores are saved before exit.
- File I/O failures (disk full, permission denied) are caught and reported without terminating the game session.

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

---

### NFR-005 · Portability

**Description:**
The game shall run on any operating system that supports Python 3.8 or above without modification.

**Acceptance Criteria:**
- The game runs correctly on Windows, macOS, and Linux.
- No OS-specific libraries or terminal escape codes are used that are not cross-platform.
- The game uses only Python standard library modules (no third-party `pip` dependencies required to run the core game).

---

### NFR-006 · Security & Data Integrity

**Description:**
The score file shall be written atomically to prevent data corruption in the event of an unexpected shutdown during a write.

**Acceptance Criteria:**
- Scores are written to a temporary file first, then renamed to the target file (atomic replace pattern).
- The score file does not contain any executable code or sensitive user data beyond names and scores.

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

---

### UI-003 · Turn Indicator

**Description:**
Before each move, the system shall clearly indicate whose turn it is.

**Acceptance Criteria:**
- The active player's name and symbol are displayed (e.g., `"Alice's turn (X)"`).
- In HvAI mode, when it is the AI's turn, the message `"AI is thinking..."` is briefly displayed before the AI move is revealed.
- The indicator is printed immediately above the input prompt.

---

### UI-004 · Input Prompt

**Description:**
Human players shall be guided by a consistent, clearly worded input prompt on every turn.

**Acceptance Criteria:**
- The prompt reads: `"Enter position (1-9): "` or equivalent.
- The cursor appears immediately after the prompt on the same line.
- After an invalid entry, the error message appears on a new line and the prompt is repeated.

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

---

### UI-006 · Game Result Announcement

**Description:**
The outcome of each game shall be announced with a prominent, visually distinct message.

**Acceptance Criteria:**
- Win message: `"🎉 [Player Name] ([Symbol]) wins! Congratulations!"` (or ASCII equivalent without emoji if the terminal does not support Unicode).
- Draw message: `"It's a draw! Well played by both sides."`
- The final board state is displayed immediately before the result message.

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

---

### UI-008 · Exit Message

**Description:**
When the application exits, it shall display a farewell message and confirm that scores have been saved.

**Acceptance Criteria:**
- Message displayed: `"Scores saved. Thanks for playing! Goodbye."`
- The message appears regardless of exit path (menu quit, replay prompt quit, or `Ctrl+C`).

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

---

### TR-005 · Input Handling & Validation

**Description:**
All user input shall be validated before processing, with no raw unvalidated data reaching game logic.

**Acceptance Criteria:**
- All `input()` calls are wrapped in validation loops within `ui.py`.
- A reusable `get_int_input(prompt, valid_range)` helper function handles numeric prompts.
- A reusable `get_str_input(prompt, min_len, max_len)` helper handles text prompts.
- Validators raise no unhandled exceptions regardless of input content.

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

---

### TR-007 · Error Handling & Logging

**Description:**
The application shall handle runtime errors gracefully and optionally log diagnostic information.

**Acceptance Criteria:**
- All file I/O operations are wrapped in `try/except` blocks with specific exception types.
- A simple logging setup using Python's `logging` module writes `WARNING`/`ERROR` events to `tictactoe.log` in the working directory.
- Log messages are not displayed in the terminal under normal operation.
- `DEBUG`-level logging can be enabled via a command-line flag (`--debug`) or environment variable (`TTT_DEBUG=1`).

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

---

*End of Requirements Specification — Tic Tac Toe v1.0*
