# Tic Tac Toe — Requirements Specification

## 1. Project Overview

A command-line Tic Tac Toe game implemented in Python supporting two play modes (Human vs Human and Human vs AI) with three AI difficulty levels (Easy, Medium, Hard). The game tracks scores across rounds, persists them to a local file, and offers a replay option after each match.

**Target Platform:** Command-line terminal (Python 3.x)
**Players:** 1–2 (local)
**Persistence:** File-based score storage

---

## 2. Functional Requirements

### FR-001 · Game Board Initialization
**Description:** The game shall initialize a 3x3 grid as the playing board at the start of every match. All cells must begin empty.
**Acceptance Criteria:**
- A new game starts with all 9 cells empty.
- The board is represented internally as a data structure that can be queried and updated by cell coordinates (e.g., 1–9 or row/column).
- The board state resets cleanly between rounds with no residual marks.

### FR-002 · Player Setup and Symbol Assignment
**Description:** The game shall assign symbols `X` and `Y` (configurable; default `X` and `O`) to two players. `X` always moves first.
**Acceptance Criteria:**
- Player 1 is assigned `X`; Player 2 (human or AI) is assigned `O`.
- Players may optionally enter custom display names; AI uses the name "Computer".
- The player using `X` makes the first move of each round.

### FR-003 · Game Mode Selection
**Description:** Before each match, the user shall choose between Human vs Human (HvH) and Human vs AI (HvAI) modes.
**Acceptance Criteria:**
- A menu prompt offers the two modes plus an exit option.
- Selecting HvAI triggers FR-004 (difficulty selection).
- Invalid menu input is rejected with a clear error message and re-prompt.

### FR-004 · AI Difficulty Selection
**Description:** When HvAI mode is chosen, the user shall select one of three difficulty levels: Easy, Medium, or Hard.
**Acceptance Criteria:**
- Easy, Medium, and Hard are each selectable.
- Easy: AI chooses a random legal move.
- Medium: AI plays optimally ~50% of the time and randomly otherwise (or uses a heuristic that blocks immediate threats and takes immediate wins, but does not lookahead deeply).
- Hard: AI uses the Minimax algorithm (optionally with alpha-beta pruning) and never loses; the best a human can achieve is a draw.

### FR-005 · Turn Management
**Description:** The game shall alternate turns between the two players, starting with `X`.
**Acceptance Criteria:**
- After a valid move is registered, the active player switches.
- The current player's name and symbol are displayed at the start of each turn.
- A player cannot make two moves in succession.

### FR-006 · Move Input and Validation
**Description:** The game shall accept a move from the active human player and validate it before applying.
**Acceptance Criteria:**
- Input is accepted as a number 1–9 (mapped to cells left-to-right, top-to-bottom) or as row/column — choice documented to user.
- Non-numeric, out-of-range, or already-occupied cell inputs are rejected with a descriptive error.
- The user is re-prompted until a valid move is entered.
- A valid move updates the board with the active player's symbol.

### FR-007 · AI Move Generation
**Description:** When the AI's turn occurs, the game shall compute and play a move automatically based on the selected difficulty.
**Acceptance Criteria:**
- AI move computation completes within 1 second on Hard (see NFR-001).
- The AI's chosen cell is always legal (empty).
- The AI's move is announced before the board is redrawn (e.g., "Computer plays cell 5").

### FR-008 · Win Detection
**Description:** After each move, the game shall check for a winning condition (three identical symbols in a row, column, or diagonal).
**Acceptance Criteria:**
- All 8 win lines (3 rows, 3 columns, 2 diagonals) are evaluated.
- When a win is detected, the round ends immediately and the winner is announced.
- The winning line may optionally be highlighted in the final board display.

### FR-009 · Draw Detection
**Description:** The game shall detect a draw when all 9 cells are filled without a winner.
**Acceptance Criteria:**
- A draw is declared only after the 9th move if no win condition was triggered.
- A "Draw" message is shown to the user.
- The round ends and triggers the replay prompt (FR-011).

### FR-010 · Score Tracking
**Description:** The game shall maintain a running tally of wins for Player 1, wins for Player 2 (or AI), and draws across all rounds in the current session and prior sessions.
**Acceptance Criteria:**
- Scores increment by 1 for the appropriate category at the end of each round.
- The current scoreboard is shown after each round and at startup.
- Separate score buckets exist for HvH and HvAI (split by difficulty) to allow meaningful comparison.

### FR-011 · Replay Option
**Description:** After each round (win or draw), the game shall prompt the user to play again.
**Acceptance Criteria:**
- Prompt accepts Yes/No (case-insensitive `y`/`n`).
- Choosing Yes starts a new round, optionally allowing the user to change mode/difficulty.
- Choosing No exits to the main menu or terminates the program (user choice).
- Invalid input re-prompts the user.

### FR-012 · Persistent Score Storage
**Description:** Scores shall be saved to a local file so that totals persist between application launches.
**Acceptance Criteria:**
- Scores are written to a file (e.g., `scores.json`) after each round and on graceful exit.
- On startup, the game loads existing scores from the file if it exists.
- If the file is missing or corrupted, the game starts with zeroed scores and logs a warning rather than crashing.
- The score file is human-readable (JSON or similar).

### FR-013 · Reset Scores
**Description:** The user shall be able to reset the persistent scoreboard from the main menu.
**Acceptance Criteria:**
- A "Reset Scores" menu option exists.
- The user must confirm the action before scores are zeroed.
- After reset, the score file reflects all zeros.

### FR-014 · Graceful Exit
**Description:** The user shall be able to quit the game cleanly at any prompt.
**Acceptance Criteria:**
- A quit option (e.g., menu choice or `q` input) is available at all major prompts.
- On exit, scores are flushed to disk (per FR-012).
- The terminal is left in a clean state (no leftover prompts or partial output).

---

## 3. Non-Functional Requirements

### NFR-001 · Performance
**Description:** The game shall remain responsive on standard consumer hardware.
**Acceptance Criteria:**
- AI move on Hard difficulty completes in ≤ 1 second.
- Board rendering and input validation feel instantaneous (< 100 ms perceived latency).
- Application startup completes in ≤ 2 seconds.

### NFR-002 · Usability
**Description:** The game shall be intuitive for a first-time user without external documentation.
**Acceptance Criteria:**
- Instructions for input format (cell numbering) are shown at the start of each round.
- All prompts include examples of valid input.
- Error messages are specific and actionable (e.g., "Cell 5 is already taken — choose another").

### NFR-003 · Reliability
**Description:** The game shall handle invalid input and unexpected conditions without crashing.
**Acceptance Criteria:**
- All user input paths validate input before use.
- File I/O failures (missing/corrupt score file, permission errors) are caught and reported.
- No unhandled exceptions are exposed to the user.

### NFR-004 · Maintainability
**Description:** The codebase shall be modular and easy to extend.
**Acceptance Criteria:**
- Game logic, AI, UI rendering, and persistence are separated into distinct modules/classes.
- Functions/methods have docstrings and clear names.
- Adding a new AI difficulty requires changes only to the AI module.
- Code passes a lint check (e.g., `flake8` or `ruff`) with no errors.

### NFR-005 · Portability
**Description:** The game shall run on Windows, macOS, and Linux terminals without modification.
**Acceptance Criteria:**
- No OS-specific dependencies are required for core functionality.
- File paths use `pathlib` or `os.path` for cross-platform compatibility.
- ANSI/color output degrades gracefully on terminals lacking ANSI support.

### NFR-006 · Testability
**Description:** Core game logic shall be unit-testable in isolation.
**Acceptance Criteria:**
- Win/draw detection, move validation, and AI move selection are pure functions or testable methods.
- A test suite (e.g., `pytest`) covers happy paths and edge cases for these components.
- Tests can run without user interaction.

---

## 4. User Interface Requirements

### UI-001 · Board Rendering
**Description:** The game shall display the 3x3 board clearly in the terminal after every move.
**Acceptance Criteria:**
- Cells are separated by visible delimiters (e.g., `|` and `---`).
- Empty cells display their cell number (1–9) to assist input, or a blank space — choice documented.
- The board is redrawn (not appended) so the screen stays uncluttered (use screen-clear or extra spacing).

### UI-002 · Main Menu
**Description:** A main menu shall be presented at startup and after each replay decision.
**Acceptance Criteria:**
- Menu options: Human vs Human, Human vs AI, View Scores, Reset Scores, Quit.
- Options are numbered for selection.
- Current scoreboard summary is visible from or near the menu.

### UI-003 · Turn Prompt
**Description:** Each turn shall display whose move it is and request input.
**Acceptance Criteria:**
- The prompt includes the player's name and symbol (e.g., "Alice (X), enter cell 1–9: ").
- The prompt is shown after the board is rendered.

### UI-004 · End-of-Round Feedback
**Description:** The game shall clearly announce the result of each round.
**Acceptance Criteria:**
- A win announces the winner's name and symbol.
- A draw is announced as such with no implied winner.
- Updated scores are shown immediately after the result.

### UI-005 · Error Messaging
**Description:** All invalid actions shall trigger clear, non-technical error messages.
**Acceptance Criteria:**
- Errors are printed on a single line near the prompt.
- Errors do not duplicate or accumulate visually.
- The user is re-prompted without losing game state.

### UI-006 · Help/Instructions
**Description:** A brief help screen shall be accessible from the main menu.
**Acceptance Criteria:**
- Help describes rules, input format, AI levels, and how to quit.
- Help is reachable in ≤ 2 keystrokes from the main menu.

---

## 5. Technical Requirements

### TR-001 · Language and Runtime
**Description:** The game shall be implemented in Python 3.8 or newer.
**Acceptance Criteria:**
- Code uses only features available in Python 3.8+.
- A `requirements.txt` or `pyproject.toml` declares the Python version.

### TR-002 · Dependencies
**Description:** The game shall minimize external dependencies, using the standard library where practical.
**Acceptance Criteria:**
- Core gameplay relies on the standard library only (`json`, `random`, `pathlib`, etc.).
- Any optional third-party packages (e.g., `colorama` for cross-platform colors) are listed in `requirements.txt` with pinned versions.

### TR-003 · Architecture
**Description:** The application shall follow a modular architecture separating concerns.
**Acceptance Criteria:**
- Modules/classes exist for: `Board`, `Game` (controller), `Player` (with `HumanPlayer` and `AIPlayer` subclasses), `AI` strategies (Easy/Medium/Hard), `ScoreManager` (persistence), and `UI`/CLI rendering.
- Cross-module dependencies flow in one direction (UI → Game → Board/Player); no circular imports.

### TR-004 · AI Implementation
**Description:** The Hard AI shall use the Minimax algorithm to guarantee optimal play.
**Acceptance Criteria:**
- Minimax explores the full game tree (3x3 is small enough; alpha-beta pruning optional).
- Hard AI never loses against any opponent — verified by automated tests.
- Easy and Medium use distinct, documented strategies (random; heuristic/mixed).

### TR-005 · Score Persistence Format
**Description:** Scores shall be persisted in a structured, human-readable format.
**Acceptance Criteria:**
- The score file is JSON.
- Schema includes: HvH wins per player slot, HvAI wins per difficulty (human wins, AI wins, draws), and a schema version field.
- File is written atomically (write to temp + rename) to prevent corruption.

### TR-006 · File Locations
**Description:** Persistent files shall be stored in a predictable, user-appropriate location.
**Acceptance Criteria:**
- Default location is the user's home directory or an OS-appropriate config path (e.g., `~/.tictactoe/scores.json`).
- The path is configurable via environment variable or constant.
- The directory is created automatically if missing.

### TR-007 · Entry Point and Packaging
**Description:** The game shall be runnable from the command line via a single command.
**Acceptance Criteria:**
- Running `python -m tictactoe` (or equivalent script) launches the game.
- A `__main__.py` or console-script entry point is provided.
- A `README.md` documents installation and run instructions.

### TR-008 · Logging
**Description:** The application shall log unexpected conditions for debugging without polluting normal output.
**Acceptance Criteria:**
- Python's `logging` module is used at WARNING level by default.
- Logs go to a file (e.g., `~/.tictactoe/app.log`), not the user's terminal, unless a `--debug` flag is set.

---

## 6. Out of Scope

- Online/networked multiplayer.
- Graphical user interface (GUI) or web frontend.
- Custom board sizes (e.g., 4x4, 5x5) — fixed at 3x3.
- User accounts or authentication.
- Sound effects or animations.
- Localization/internationalization (English only for v1).

---

## 7. Glossary

- **HvH:** Human vs Human local play.
- **HvAI:** Human vs AI play.
- **Minimax:** A recursive decision algorithm for two-player zero-sum games that selects the move minimizing the opponent's maximum payoff.
- **Round:** A single game played from empty board to win or draw.
- **Session:** The period from launching the application to quitting it.
