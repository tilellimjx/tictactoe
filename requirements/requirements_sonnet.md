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
6. [Requirements Traceability Matrix](#6-requirements-traceability-matrix)

---

## 1. Project Overview

This document defines the requirements for a command-line Tic Tac Toe game written in Python. The game supports two modes — **Human vs Human** and **Human vs AI** — with persistent score tracking across rounds and a replay option after each game concludes. The AI opponent offers selectable difficulty levels (Easy and Hard). The entire experience runs within a terminal/console environment with no graphical interface.

### 1.1 Scope

| Item | Detail |
|---|---|
| Language | Python 3.x |
| Interface | Command-Line Terminal (stdin / stdout) |
| Game Modes | Human vs Human · Human vs AI |
| AI Difficulty | Easy (random) · Hard (Minimax) |
| Extra Features | Score tracking across rounds · Replay option |

### 1.2 Definitions

| Term | Definition |
|---|---|
| **Board** | The 3×3 grid on which the game is played |
| **Cell** | One of the nine positions on the board, addressed 1–9 |
| **Mark** | The symbol assigned to a player — `X` or `O` |
| **Round** | A single game from start to win/draw |
| **Session** | All rounds played without exiting the program |
| **AI** | The computer-controlled opponent |

---

## 2. Functional Requirements

---

### FR-001 · Main Menu

**Description:**
Upon launch the application must display a main menu that allows the player to select a game mode, view current scores, or quit the application.

**Acceptance Criteria:**
- [ ] The main menu is the first screen shown on every program launch.
- [ ] The menu presents at minimum three options: (1) Human vs Human, (2) Human vs AI, (3) Quit.
- [ ] An option to view the current session scores is accessible from the main menu.
- [ ] Entering an unrecognised option displays an error message and re-prompts without crashing.
- [ ] Selecting "Quit" terminates the program cleanly with a farewell message.

---

### FR-002 · Player Setup

**Description:**
Before a round begins, the game must collect the names of the participating players and assign each a mark (`X` or `O`).

**Acceptance Criteria:**
- [ ] In Human vs Human mode, both Player 1 and Player 2 are prompted for their names.
- [ ] In Human vs AI mode, the human player is prompted for their name; the AI opponent is labelled "Computer" by default.
- [ ] Player 1 is always assigned mark `X`; Player 2 / the AI is assigned mark `O`.
- [ ] Player names must be between 1 and 20 characters; blank names are rejected with a re-prompt.
- [ ] Player names persist across replayed rounds within the same session.

---

### FR-003 · AI Difficulty Selection

**Description:**
When Human vs AI mode is chosen, the player must be offered a choice of AI difficulty level before the round starts.

**Acceptance Criteria:**
- [ ] Two difficulty levels are offered: **Easy** and **Hard**.
- [ ] Selecting Easy causes the AI to choose moves uniformly at random from available cells.
- [ ] Selecting Hard causes the AI to use the **Minimax algorithm**, playing optimally (never losing).
- [ ] The selected difficulty is displayed at the start of each round and persists for replayed rounds unless the player returns to the main menu and changes it.
- [ ] An invalid difficulty selection re-prompts without crashing.

---

### FR-004 · Board Initialisation

**Description:**
At the start of every round, the game must initialise and display a clean, empty 3×3 board with cell numbering visible to guide player input.

**Acceptance Criteria:**
- [ ] All nine cells are empty at the start of each round.
- [ ] Cell positions are numbered 1–9 (row-major order: top-left = 1, top-right = 3, bottom-right = 9).
- [ ] A reference diagram or inline numbering is shown alongside the empty board so players always know the cell-to-number mapping.

---

### FR-005 · Turn Management

**Description:**
The game must enforce strict alternating turns between the two participants, beginning with the player holding mark `X`.

**Acceptance Criteria:**
- [ ] Player X always takes the first turn of every round.
- [ ] After each valid move, the active player switches to the other participant.
- [ ] The name and mark of the current player is clearly announced before each turn.
- [ ] In Human vs AI mode, the AI takes its turn automatically (no additional input required from the human) immediately after the human's valid move.
- [ ] The AI's chosen cell is announced to the user before the board is re-drawn.

---

### FR-006 · Player Input & Move Execution

**Description:**
The game must accept a human player's move as a single integer (1–9) representing the target cell, validate it, and apply it to the board.

**Acceptance Criteria:**
- [ ] The game prompts the active human player to enter a cell number (1–9).
- [ ] A valid move is any integer in the range [1, 9] that corresponds to an unoccupied cell.
- [ ] On a valid move, the player's mark is placed on the chosen cell and the updated board is displayed.
- [ ] Non-integer input triggers an error message ("Invalid input – please enter a number between 1 and 9.") and re-prompts.
- [ ] An out-of-range integer triggers an error message and re-prompts.
- [ ] A number referencing an already-occupied cell triggers an error message ("Cell already taken – choose another.") and re-prompts.
- [ ] No invalid input causes an unhandled exception or program crash.

---

### FR-007 · Win Detection

**Description:**
After every move, the game must evaluate the board for a winning condition and declare the winner if one is found.

**Acceptance Criteria:**
- [ ] The game checks all eight winning lines after each move: 3 rows, 3 columns, 2 diagonals.
- [ ] A win is detected when all three cells in any winning line contain the same mark.
- [ ] Upon win detection, the game immediately announces the winner by name (e.g., `"Alice wins! 🎉"`), displays the final board state, and ends the round.
- [ ] No further moves are accepted after a win is detected.
- [ ] The winning player's score is incremented by 1 (see FR-010).

---

### FR-008 · Draw Detection

**Description:**
The game must detect a draw when all nine cells are filled and no winning condition has been met.

**Acceptance Criteria:**
- [ ] A draw is declared if all nine cells are occupied and no winning line exists.
- [ ] The draw announcement is displayed (e.g., `"It's a draw! Well played by both sides."`), along with the final board.
- [ ] Each player's draw count is incremented by 1 (see FR-010).
- [ ] No further moves are accepted after a draw is declared.

---

### FR-009 · Score Tracking

**Description:**
The game must maintain and display a running score for each participant across all rounds within a session.

**Acceptance Criteria:**
- [ ] Scores are initialised to zero at the start of a session (program launch).
- [ ] Each player's score record includes: Wins, Losses, and Draws.
- [ ] Scores are updated immediately after each round concludes.
- [ ] The current scoreboard is displayed after every round ends and is also accessible from the main menu.
- [ ] Scores persist across replayed rounds but reset when the program is restarted.
- [ ] The scoreboard clearly labels each row with the player's name and mark.

---

### FR-010 · Replay Option

**Description:**
After each round concludes (win or draw), the game must offer the players the option to play another round or return to the main menu.

**Acceptance Criteria:**
- [ ] After the end-of-round summary, the player is prompted: `"Play again? (yes / no)"`.
- [ ] Selecting "yes" (or `y`) starts a new round immediately, retaining player names, marks, difficulty setting, and cumulative scores.
- [ ] Selecting "no" (or `n`) returns the player to the main menu.
- [ ] Unrecognised input re-prompts without crashing.
- [ ] A new round begins with a fully reset, empty board regardless of the previous round's outcome.

---

### FR-011 · Graceful Exit

**Description:**
The user must be able to exit the program cleanly at any point via the main menu or a keyboard interrupt.

**Acceptance Criteria:**
- [ ] Selecting "Quit" from the main menu exits the program with a confirmation message and exit code 0.
- [ ] A `KeyboardInterrupt` (Ctrl+C) at any point is caught and results in a clean exit message rather than a raw Python traceback.

---

## 3. Non-Functional Requirements

---

### NFR-001 · Performance

**Description:**
The game must respond to all user inputs and AI calculations within acceptable time limits for an interactive terminal application.

**Acceptance Criteria:**
- [ ] Human move validation and board rendering completes in under **100 ms** on any modern hardware.
- [ ] The Hard AI (Minimax) calculates its move and outputs the result in under **500 ms** on a standard 3×3 board.
- [ ] Easy AI move selection completes in under **50 ms**.
- [ ] No input-to-output lag is perceptible to the user during normal gameplay.

---

### NFR-002 · Usability

**Description:**
The game must be intuitive and accessible to first-time players using only a standard keyboard and terminal.

**Acceptance Criteria:**
- [ ] All prompts clearly state what input is expected and in what format.
- [ ] Error messages are human-readable, specific, and suggest the correct action.
- [ ] The board is redrawn after every move so the player always sees the current state.
- [ ] No prior programming knowledge or documentation is required to play the game.
- [ ] The cell numbering key is shown at least once per round and always on first display.

---

### NFR-003 · Reliability

**Description:**
The game must handle all foreseeable invalid inputs gracefully and never crash during normal use.

**Acceptance Criteria:**
- [ ] No unhandled exceptions are raised by any user input during gameplay.
- [ ] All edge-case inputs (empty string, special characters, very long strings, floats) are handled with an error message and re-prompt.
- [ ] The game does not enter an infinite loop under any user-input combination.
- [ ] Win and draw detection are provably correct for all possible board states (covered by unit tests).

---

### NFR-004 · Maintainability

**Description:**
The codebase must be structured to allow easy future modification, such as adding a 4×4 board variant or a new AI strategy.

**Acceptance Criteria:**
- [ ] The code is separated into logical modules (e.g., `board.py`, `game.py`, `ai.py`, `ui.py`, `score.py`).
- [ ] All functions and classes have docstrings explaining their purpose, parameters, and return values.
- [ ] No single function exceeds 50 lines of code.
- [ ] Magic numbers (e.g., board size `3`) are defined as named constants.
- [ ] The codebase passes `PEP 8` style checks with no errors.

---

### NFR-005 · Portability

**Description:**
The game must run without modification on any operating system that supports Python 3.8 or higher.

**Acceptance Criteria:**
- [ ] The game runs correctly on Windows 10+, macOS 12+, and Ubuntu 20.04+ using only the Python standard library.
- [ ] No third-party packages are required to install or run the game.
- [ ] The game does not use OS-specific terminal control codes that would break on another platform (e.g., ANSI escape codes are only used if the terminal supports them, with a plain-text fallback).

---

### NFR-006 · Testability

**Description:**
Core game logic must be implemented in a way that is independently unit-testable without requiring a running terminal session.

**Acceptance Criteria:**
- [ ] Board state, win detection, draw detection, score tracking, and AI move generation are all callable as pure functions or class methods that can be invoked in `pytest` unit tests.
- [ ] UI/input-gathering logic is isolated from game logic so tests do not require mocking `input()` for core behaviour tests.
- [ ] A minimum of 90% line coverage is achievable on the game logic modules.

---

## 4. User Interface Requirements

---

### UI-001 · Board Display

**Description:**
The board must be rendered in the terminal in a clear, readable grid format after every move and at the start of each round.

**Acceptance Criteria:**
- [ ] The board is displayed as a 3×3 grid with visible cell separators (e.g., `|` for columns and `---` for rows).
- [ ] Occupied cells display the player's mark (`X` or `O`); unoccupied cells display their number (1–9).
- [ ] The board is reprinted in full after every move; the terminal is not cleared between moves (to preserve history), unless the system supports and the user has not disabled ANSI clearing.
- [ ] Example valid rendering:
  ```
   1 | 2 | 3
  ---+---+---
   4 | X | 6
  ---+---+---
   7 | 8 | O
  ```

---

### UI-002 · Turn Prompt

**Description:**
Before each human player's turn, a clear prompt must name the active player and instruct them to enter a cell number.

**Acceptance Criteria:**
- [ ] Prompt format: `"[PlayerName] (X), enter your move (1-9): "`.
- [ ] The prompt appears on a new line immediately after the board is drawn.
- [ ] In Human vs AI mode, a status message (e.g., `"Computer is thinking..."`) is shown before the AI move is applied.

---

### UI-003 · Win / Draw Announcement

**Description:**
The result of each round must be communicated to the players with a prominent, formatted message.

**Acceptance Criteria:**
- [ ] Win message format: `"🎉 [PlayerName] wins the round!"` (with plain-text fallback `"*** [PlayerName] wins the round! ***"`).
- [ ] Draw message format: `"🤝 It's a draw!"` (plain-text fallback: `"--- It's a draw! ---"`).
- [ ] The final board state is displayed immediately before the result message.
- [ ] The round result message is visually distinct from regular prompts (e.g., surrounded by blank lines or separator lines).

---

### UI-004 · Scoreboard Display

**Description:**
The session scoreboard must be presented in a tabular, easy-to-read format.

**Acceptance Criteria:**
- [ ] The scoreboard is shown automatically after each round ends and on demand from the main menu.
- [ ] The table includes columns: **Player**, **Mark**, **Wins**, **Losses**, **Draws**.
- [ ] Column widths are dynamically adjusted to accommodate player name length.
- [ ] Example rendering:
  ```
  ============= SCOREBOARD =============
  Player         | Mark | Wins | Loss | Draw
  ---------------+------+------+------+-----
  Alice          |  X   |  2   |  1   |  0
  Computer       |  O   |  1   |  2   |  0
  ======================================
  ```

---

### UI-005 · Main Menu Display

**Description:**
The main menu must be clearly laid out and list all available options with their input keys.

**Acceptance Criteria:**
- [ ] The menu heading (e.g., `"=== TIC TAC TOE ==="`) is displayed at the top.
- [ ] Each menu option is listed on its own line with a clear numeric or alphabetic key (e.g., `[1] Human vs Human`).
- [ ] The menu is re-displayed after returning from a completed session.

---

### UI-006 · Error & Feedback Messages

**Description:**
All error messages and informational feedback must be consistent in style and clearly distinguishable from normal prompts.

**Acceptance Criteria:**
- [ ] Error messages are prefixed with `[ERROR]` or visually marked (e.g., `⚠`).
- [ ] Informational messages are prefixed with `[INFO]` or an equivalent visual indicator.
- [ ] Success messages (e.g., move accepted) are implicit via the redrawn board; no separate confirmation is needed.
- [ ] No raw Python exception tracebacks are ever shown to the user.

---

## 5. Technical Requirements

---

### TR-001 · Programming Language & Version

**Description:**
The game must be implemented in Python and be compatible with the specified version range.

**Acceptance Criteria:**
- [ ] The game is written entirely in Python.
- [ ] The game runs without error on **Python 3.8, 3.9, 3.10, 3.11, and 3.12**.
- [ ] The entry point is a single runnable script (e.g., `main.py`) invocable via `python main.py`.

---

### TR-002 · Standard Library Only

**Description:**
The game must not require any third-party packages, relying exclusively on the Python standard library.

**Acceptance Criteria:**
- [ ] No `pip install` step is required before running the game.
- [ ] Only standard-library modules are imported (e.g., `random`, `sys`, `os`, `math`, `typing`).
- [ ] A `requirements.txt` file is either absent or explicitly empty.

---

### TR-003 · Modular Architecture

**Description:**
The codebase must be split into clearly separated modules with well-defined responsibilities.

**Acceptance Criteria:**
- [ ] Recommended module structure:

  | Module | Responsibility |
  |---|---|
  | `main.py` | Entry point; launches the main menu loop |
  | `game.py` | Round orchestration; turn loop; win/draw detection |
  | `board.py` | Board data structure; cell validation; board state queries |
  | `ai.py` | AI move strategies: random (Easy) and Minimax (Hard) |
  | `ui.py` | All terminal I/O: rendering, prompts, menus, messages |
  | `score.py` | Score data structure; update and display logic |
  | `constants.py` | Named constants (board size, marks, difficulty labels) |

- [ ] Circular imports between modules are not present.
- [ ] Each module is independently importable without side effects.

---

### TR-004 · AI Algorithm – Minimax

**Description:**
The Hard AI must implement the Minimax algorithm to guarantee optimal play on a 3×3 board.

**Acceptance Criteria:**
- [ ] The Minimax function is recursive and correctly evaluates terminal states (win/loss/draw).
- [ ] The algorithm assigns scores: `+10` for AI win, `-10` for human win, `0` for draw (adjusted by depth to prefer faster wins).
- [ ] The AI will **never lose** against any human move sequence (provable by exhaustive test).
- [ ] The AI correctly identifies and plays the winning move when one is available.
- [ ] The AI correctly blocks the human's winning move when the human has two in a row.
- [ ] Alpha-beta pruning is optional but recommended for forward-compatibility with larger boards.

---

### TR-005 · Game State Representation

**Description:**
The board state must be represented in a simple, language-idiomatic data structure that is easy to copy, inspect, and test.

**Acceptance Criteria:**
- [ ] The board is represented as a **list of 9 elements** (indices 0–8, mapping to cells 1–9).
- [ ] Each element holds one of three values: `None` (empty), `"X"`, or `"O"`.
- [ ] Board state is never mutated by the AI's look-ahead; deep copies are used during Minimax search.
- [ ] A utility function `get_available_moves(board)` returns a list of empty cell indices.

---

### TR-006 · Configuration Constants

**Description:**
All magic numbers and hardcoded string labels must be centralised in a constants file.

**Acceptance Criteria:**
- [ ] `BOARD_SIZE = 3` is defined and used wherever the board dimension appears in logic.
- [ ] Player marks `MARK_X = "X"` and `MARK_O = "O"` are defined as constants.
- [ ] Difficulty labels `EASY = "Easy"` and `HARD = "Hard"` are defined as constants.
- [ ] Changing `BOARD_SIZE` to `4` would require logic changes only in `board.py`, `ai.py`, and `game.py` (not in `ui.py` or `score.py`).

---

### TR-007 · Error Handling Strategy

**Description:**
The application must implement a consistent error-handling strategy that prevents crashes and provides clear feedback.

**Acceptance Criteria:**
- [ ] All `input()` calls are wrapped in `try/except` blocks catching at minimum `ValueError` and `KeyboardInterrupt`.
- [ ] A top-level `try/except` in `main.py` catches any unexpected exceptions, logs them to `stderr`, and exits cleanly.
- [ ] No game-logic function raises an exception for invalid input; instead, a sentinel value (e.g., `None` or `False`) is returned, and the UI layer handles re-prompting.

---

## 6. Requirements Traceability Matrix

| ID | Category | Title | Priority |
|---|---|---|---|
| FR-001 | Functional | Main Menu | High |
| FR-002 | Functional | Player Setup | High |
| FR-003 | Functional | AI Difficulty Selection | High |
| FR-004 | Functional | Board Initialisation | High |
| FR-005 | Functional | Turn Management | High |
| FR-006 | Functional | Player Input & Move Execution | High |
| FR-007 | Functional | Win Detection | High |
| FR-008 | Functional | Draw Detection | High |
| FR-009 | Functional | Score Tracking | Medium |
| FR-010 | Functional | Replay Option | Medium |
| FR-011 | Functional | Graceful Exit | Medium |
| NFR-001 | Non-Functional | Performance | Medium |
| NFR-002 | Non-Functional | Usability | High |
| NFR-003 | Non-Functional | Reliability | High |
| NFR-004 | Non-Functional | Maintainability | Medium |
| NFR-005 | Non-Functional | Portability | Medium |
| NFR-006 | Non-Functional | Testability | Medium |
| UI-001 | UI | Board Display | High |
| UI-002 | UI | Turn Prompt | High |
| UI-003 | UI | Win/Draw Announcement | High |
| UI-004 | UI | Scoreboard Display | Medium |
| UI-005 | UI | Main Menu Display | High |
| UI-006 | UI | Error & Feedback Messages | Medium |
| TR-001 | Technical | Language & Version | High |
| TR-002 | Technical | Standard Library Only | High |
| TR-003 | Technical | Modular Architecture | Medium |
| TR-004 | Technical | AI Minimax Algorithm | High |
| TR-005 | Technical | Game State Representation | Medium |
| TR-006 | Technical | Configuration Constants | Low |
| TR-007 | Technical | Error Handling Strategy | High |

---

*End of Requirements Specification – Tic Tac Toe v1.0*
