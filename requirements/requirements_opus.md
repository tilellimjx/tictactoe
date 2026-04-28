# Tic Tac Toe — Requirements Specification

## 1. Overview

A command-line Tic Tac Toe game implemented in Python. The game supports two modes of play: **Human vs Human** (local hot-seat) and **Human vs AI** (single player against the computer). It tracks scores across multiple rounds within a session and offers a replay option after each completed game.

### 1.1 Scope
- Standard 3×3 Tic Tac Toe board.
- Two players represented by the symbols `X` and `O`.
- Turn-based input through the terminal.
- Automatic detection of win, draw, and ongoing-game states.
- Persistent score tracking for the duration of a session.
- Replay loop allowing successive rounds without restarting the program.

### 1.2 Out of Scope
- Online/networked multiplayer.
- Persistent score storage between sessions (unless trivially extended).
- Graphical user interface, sound, or animations.
- Variable board sizes.

---

## 2. Functional Requirements

### FR-001 · Game Initialization
**Description:** On launch, the application shall display a welcome message and present a main menu allowing the user to choose game mode (Human vs Human or Human vs AI) or exit.
**Acceptance Criteria:**
- A welcome banner is printed on startup.
- The menu lists: (1) Human vs Human, (2) Human vs AI, (3) Quit.
- The application accepts the user's numeric or labeled choice and transitions accordingly.
- Invalid menu choices prompt the user to re-enter without crashing.

### FR-002 · Board Representation
**Description:** The game shall maintain a 3×3 grid representing the playing field. Each cell can be empty, contain `X`, or contain `O`.
**Acceptance Criteria:**
- Internal state is a 3×3 structure (e.g., list of lists or flat array of length 9).
- All cells are empty at the start of each round.
- Cell state is updated only by valid moves.

### FR-003 · Player Symbol Assignment
**Description:** Player 1 shall be assigned `X` and Player 2 (or the AI) shall be assigned `O`. `X` always moves first.
**Acceptance Criteria:**
- Player 1 always plays as `X`.
- Player 2 / AI always plays as `O`.
- The first turn of every round belongs to `X`.

### FR-004 · Turn Management
**Description:** The game shall alternate turns between the two players until the round ends in a win or draw.
**Acceptance Criteria:**
- After a successful move, control passes to the other player.
- The current player's identity and symbol are clearly indicated before each move.
- A player cannot take two consecutive turns.

### FR-005 · Move Input (Human Player)
**Description:** A human player shall enter a move by specifying a cell on the board (e.g., a number 1–9 corresponding to grid positions, or row/column coordinates).
**Acceptance Criteria:**
- The chosen input scheme is documented on screen (e.g., a reference grid showing 1–9).
- The system accepts valid input and places the player's symbol in that cell.
- Empty input or non-numeric input is rejected with a clear error message; the same player is re-prompted.

### FR-006 · Move Validation
**Description:** The game shall reject any move targeting a cell that is already occupied or outside the board range.
**Acceptance Criteria:**
- A move into an occupied cell prints an error and re-prompts the same player.
- A move outside the 1–9 range (or outside row/column bounds) prints an error and re-prompts.
- The board state is unchanged when a move is rejected.

### FR-007 · Win Detection
**Description:** After every move, the game shall check for a winning line (three identical symbols in any row, column, or diagonal) and declare the corresponding player the winner.
**Acceptance Criteria:**
- All 8 possible winning lines (3 rows, 3 columns, 2 diagonals) are evaluated.
- When a win is detected, the winning player is announced and the round ends immediately.
- No further moves are accepted in that round after a win.

### FR-008 · Draw Detection
**Description:** If all 9 cells are filled and no winning line exists, the game shall declare a draw.
**Acceptance Criteria:**
- A draw is announced only when the board is full and no winner has been detected.
- Draw detection occurs after each move (not only at game end heuristics).
- The round ends immediately upon a draw.

### FR-009 · AI Opponent
**Description:** In Human vs AI mode, the computer shall automatically choose a legal move when it is its turn.
**Acceptance Criteria:**
- The AI never selects an occupied or out-of-range cell.
- The AI plays automatically without human input.
- The AI's chosen move is displayed before the board is re-rendered.
- The AI strategy is at minimum non-trivial (e.g., wins if a winning move is available, blocks an opponent's immediate win, otherwise picks center/corner/random per a documented heuristic — or implements a Minimax-based optimal strategy).

### FR-010 · Score Tracking
**Description:** The game shall maintain a score tally for Player 1, Player 2/AI, and Draws across all rounds played within a single session.
**Acceptance Criteria:**
- Scores start at 0 when the application launches.
- After each round, the appropriate counter (Player 1 wins, Player 2/AI wins, or Draws) increments by 1.
- The current scores are displayed at the start of each new round and at session end.
- Scores persist across rounds within a session but reset when the application exits.

### FR-011 · Replay / Continue Option
**Description:** After each round concludes, the game shall ask the user whether to play another round.
**Acceptance Criteria:**
- A yes/no prompt is shown after a win or draw is announced.
- A "yes" response begins a new round with a cleared board, retaining the current scores and game mode.
- A "no" response returns to the main menu (or exits, depending on FR-012).
- Invalid responses re-prompt without crashing.

### FR-012 · Session Termination
**Description:** The user shall be able to exit the game cleanly from the main menu or after declining a replay.
**Acceptance Criteria:**
- A "Quit" option is available from the main menu.
- On exit, the final session scores are displayed.
- The program terminates with exit code 0 under normal shutdown.

### FR-013 · Mode Switching
**Description:** The user shall be able to return to the main menu after a round to switch between Human vs Human and Human vs AI modes.
**Acceptance Criteria:**
- Declining a replay returns the user to the main menu without exiting.
- The user can then start a new game in a different mode.
- Scores accumulated so far in the session remain visible/intact.

---

## 3. Non-Functional Requirements

### NFR-001 · Performance
**Description:** All gameplay actions shall feel instantaneous on commodity hardware.
**Acceptance Criteria:**
- Move validation, board rendering, and win/draw detection complete in under 50 ms.
- AI move computation completes in under 500 ms even when using Minimax on a 3×3 board.

### NFR-002 · Reliability
**Description:** The application shall not crash on invalid user input.
**Acceptance Criteria:**
- All user-input paths are wrapped in input validation logic.
- Unhandled exceptions are caught at the top level and produce a friendly error message rather than a stack trace.
- The game can run an arbitrary number of consecutive rounds without memory leaks or state corruption.

### NFR-003 · Usability
**Description:** The CLI shall be approachable for first-time users.
**Acceptance Criteria:**
- Onscreen instructions explain how to enter moves before the first prompt.
- Error messages clearly state what went wrong and what is expected.
- The current player and current score are visible during gameplay.

### NFR-004 · Maintainability
**Description:** The codebase shall be organized so that game logic, AI logic, and I/O are decoupled.
**Acceptance Criteria:**
- Board state and rule logic live in a module independent of input/output.
- The AI strategy is encapsulated in a function or class that takes board state and returns a move.
- Adding a new AI difficulty or alternative input scheme should not require modifying core rules.

### NFR-005 · Testability
**Description:** Core game logic shall be unit-testable without requiring terminal interaction.
**Acceptance Criteria:**
- Pure functions exist for: move application, win detection, draw detection, and AI move selection.
- Unit tests can construct arbitrary board states and assert outcomes.
- Test coverage for core logic is ≥ 80%.

### NFR-006 · Portability
**Description:** The game shall run on any platform supporting Python 3.8+.
**Acceptance Criteria:**
- No use of OS-specific APIs in core logic.
- Runs on Windows, macOS, and Linux terminals without modification.
- Uses only the Python standard library (no third-party runtime dependencies).

### NFR-007 · Accessibility
**Description:** Output shall be readable in a standard monochrome terminal.
**Acceptance Criteria:**
- The game functions correctly without ANSI color support.
- If color is used, it is purely decorative; all game-critical information is conveyed by text.
- Board characters use plain ASCII so screen readers can interpret them.

---

## 4. User Interface Requirements

### UI-001 · Board Rendering
**Description:** The board shall be rendered to the terminal as ASCII art after every state change.
**Acceptance Criteria:**
- Cells are arranged in a clearly delineated 3×3 grid using characters such as `|` and `-`.
- Empty cells are rendered as a space or position number reference.
- Occupied cells display the corresponding `X` or `O`.
- The board is re-rendered after each move and at the start of each round.

### UI-002 · Move Reference Grid
**Description:** A reference showing the numbering scheme for cell input shall be available to the player.
**Acceptance Criteria:**
- A 1–9 reference grid (or coordinate scheme) is shown at the start of each round.
- The reference can be requested again via a help command or is shown alongside the live board.

### UI-003 · Turn Prompt
**Description:** Before each human move, the UI shall clearly indicate whose turn it is.
**Acceptance Criteria:**
- Message contains the player label (e.g., "Player 1 (X)") and a prompt to enter a move.
- For AI turns, a message such as "AI is thinking..." is displayed before the AI's move is revealed.

### UI-004 · Outcome Announcement
**Description:** Upon round completion, the UI shall display the result clearly.
**Acceptance Criteria:**
- A win prints a message like "Player 1 (X) wins!" with the final board shown.
- A draw prints "It's a draw!" with the final board shown.
- The updated session scores are shown immediately after the outcome.

### UI-005 · Error Feedback
**Description:** Invalid actions shall produce concise, actionable error messages.
**Acceptance Criteria:**
- Invalid menu choice: "Please enter 1, 2, or 3."
- Invalid move format: "Please enter a number from 1 to 9."
- Occupied cell: "That cell is already taken. Choose another."
- The player who caused the error is re-prompted on the same turn.

### UI-006 · Replay Prompt
**Description:** After each round, the UI shall ask the user whether to play again.
**Acceptance Criteria:**
- Prompt accepts `y`/`yes` and `n`/`no` (case-insensitive).
- Invalid responses re-prompt with a clarifying message.
- The chosen path (replay, main menu, or quit) is honored immediately.

### UI-007 · Session Summary
**Description:** When the user quits, a summary of session scores shall be displayed.
**Acceptance Criteria:**
- Summary lists Player 1 wins, Player 2/AI wins, Draws, and total rounds.
- Summary appears once, immediately before program termination.

---

## 5. Technical Requirements

### TR-001 · Language and Runtime
**Description:** The game shall be implemented in Python 3.8 or higher.
**Acceptance Criteria:**
- Source code uses syntax compatible with Python 3.8+.
- The application starts via `python main.py` (or equivalent entry point).
- No use of features deprecated/removed in the target Python version.

### TR-002 · Dependency Constraints
**Description:** The game shall use only the Python standard library at runtime.
**Acceptance Criteria:**
- No `requirements.txt` runtime dependencies are required to play.
- Development-only dependencies (e.g., `pytest`) may be listed separately.

### TR-003 · Project Structure
**Description:** The codebase shall be organized into clearly named modules.
**Acceptance Criteria:**
- Suggested layout:
  - `main.py` — entry point and menu loop
  - `game.py` — board, rules, win/draw detection
  - `ai.py` — AI move selection
  - `ui.py` — terminal rendering and input
  - `tests/` — unit tests
- Each module has a single, well-defined responsibility.

### TR-004 · AI Algorithm
**Description:** The AI shall implement a deterministic algorithm capable of at least non-losing play on a 3×3 board.
**Acceptance Criteria:**
- The AI uses either a heuristic (win → block → center → corner → side) or Minimax (with optional alpha-beta pruning).
- If Minimax is used, the AI never loses on a 3×3 board.
- The chosen algorithm is documented with comments or a brief design note.

### TR-005 · Input Handling
**Description:** All user input shall be read from standard input via `input()` and validated before use.
**Acceptance Criteria:**
- Inputs are stripped of whitespace and normalized (e.g., lowercased) before comparison.
- Numeric inputs are converted with try/except guarding against `ValueError`.
- EOF (Ctrl+D) and KeyboardInterrupt (Ctrl+C) are caught and trigger graceful shutdown with the session summary.

### TR-006 · State Management
**Description:** Game state (board, current player, scores, mode) shall be encapsulated rather than held in scattered globals.
**Acceptance Criteria:**
- A `Game` (or similar) class or dataclass holds round state.
- A `Session` (or similar) construct holds cross-round state (scores, mode).
- State is reset cleanly at the start of each new round.

### TR-007 · Logging and Debugging (Optional)
**Description:** Optional debug output may be enabled via an environment variable or CLI flag.
**Acceptance Criteria:**
- Default runs produce only user-facing output.
- A `--debug` flag (or `DEBUG=1`) enables verbose logging of internal state transitions.
- Debug logging does not interfere with normal gameplay output when disabled.

### TR-008 · Testing Framework
**Description:** Unit tests shall be runnable with a standard Python test runner.
**Acceptance Criteria:**
- Tests live under `tests/` and follow `test_*.py` naming.
- Tests are runnable via `python -m unittest` or `pytest`.
- Tests cover win detection, draw detection, move validation, and AI legality.

---

## 6. Glossary

- **Round:** A single play-through from an empty board to a win or draw.
- **Session:** The duration the application is running; may include multiple rounds.
- **Cell:** One of the 9 positions on the 3×3 board.
- **Line:** Any row, column, or diagonal that can produce a win.
- **Hot-seat:** Two human players sharing one keyboard, taking turns.

---

## 7. Traceability Summary

| Category | Count | IDs |
|---|---|---|
| Functional | 13 | FR-001 … FR-013 |
| Non-Functional | 7 | NFR-001 … NFR-007 |
| User Interface | 7 | UI-001 … UI-007 |
| Technical | 8 | TR-001 … TR-008 |
| **Total** | **35** | |
