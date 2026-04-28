# Tic Tac Toe — Requirements Specification

> **Review note:** Inline commentary by the senior requirements analyst is marked **[Sonnet: ...]** throughout. Additional requirements contributed by the reviewer appear at the end of each section and are prefixed with the section tag and a number that continues the original sequence (e.g., FR-015, NFR-007, etc.).

---

## 1. Project Overview

A command-line Tic Tac Toe game implemented in Python supporting two play modes (Human vs Human and Human vs AI) with three AI difficulty levels (Easy, Medium, Hard). The game tracks scores across rounds, persists them to a local file, and offers a replay option after each match.

**Target Platform:** Command-line terminal (Python 3.x) **[Sonnet: "Python 3.x" is too broad here. TR-001 correctly pins the minimum to 3.8 — this Overview field should match: "Python 3.8+". Minor inconsistency but can mislead tool-chain setup.]**
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

**[Sonnet: FR-001 is clear and well-scoped. The only minor gap is that there is no explicit statement about what triggers board initialization — the Game controller (FR-003/FR-011) implies it, but an explicit trigger ("a new round begins") would make traceability cleaner.]**

---

### FR-002 · Player Setup and Symbol Assignment
**Description:** The game shall assign symbols `X` and `Y` **[Sonnet: CRITICAL TYPO — the description says "`X` and `Y`" but the acceptance criteria (correctly) say `X` and `O`. This inconsistency must be corrected before implementation to avoid developer confusion. The symbol should read "`X` and `O`".]** (configurable; default `X` and `O`) to two players. `X` always moves first.
**Acceptance Criteria:**
- Player 1 is assigned `X`; Player 2 (human or AI) is assigned `O`.
- Players may optionally enter custom display names; AI uses the name "Computer".
- The player using `X` makes the first move of each round. **[Sonnet: This locks Player 1 as the perpetual first-mover across every round. There is no requirement for alternating first-move privileges between rounds (e.g., loser/winner goes first next). This is a deliberate design choice but it should be explicitly stated as such, or FR-015 (added below) should be adopted. Many casual implementations alternate starters, and the omission here will likely be queried by developers.]**

**[Sonnet: "Players may optionally enter custom display names" — no constraints are given on name format. Maximum length, allowed characters, and uniqueness (what if both players enter the same name?) are all unspecified. This should be tightened, or a separate FR covering player-name validation should be added.]**

---

### FR-003 · Game Mode Selection
**Description:** Before each match, the user shall choose between Human vs Human (HvH) and Human vs AI (HvAI) modes.
**Acceptance Criteria:**
- A menu prompt offers the two modes plus an exit option.
- Selecting HvAI triggers FR-004 (difficulty selection).
- Invalid menu input is rejected with a clear error message and re-prompt.

**[Sonnet: "Before each match" is slightly ambiguous — does mode selection occur before every round, or once per session, or only when the user explicitly returns to the main menu? FR-011 says "optionally allowing the user to change mode/difficulty" at replay time, but this should be resolved here definitively. Suggest: mode selection occurs at the main menu and can be changed between rounds only if the user selects "Return to Menu" at the replay prompt.]**

---

### FR-004 · AI Difficulty Selection
**Description:** When HvAI mode is chosen, the user shall select one of three difficulty levels: Easy, Medium, or Hard.
**Acceptance Criteria:**
- Easy, Medium, and Hard are each selectable.
- Easy: AI chooses a random legal move.
- Medium: AI plays optimally ~50% of the time and randomly otherwise (or uses a heuristic that blocks immediate threats and takes immediate wins, but does not lookahead deeply). **[Sonnet: The use of "or" between two genuinely different algorithms creates an implementation fork that will produce inconsistent behavior across builds. The two options described — probabilistic Minimax vs. deterministic heuristic — are not equivalent in strength or determinism. The document must choose one. Recommendation: the heuristic approach (take wins → block losses → random otherwise) is more predictable and testable, and is the better choice for "Medium". The ~50% probabilistic framing is also untestable without statistical sampling, making FR-004's acceptance criteria unverifiable for Medium. This is a significant requirements defect.]**
- Hard: AI uses the Minimax algorithm (optionally with alpha-beta pruning) and never loses; the best a human can achieve is a draw.

---

### FR-005 · Turn Management
**Description:** The game shall alternate turns between the two players, starting with `X`.
**Acceptance Criteria:**
- After a valid move is registered, the active player switches.
- The current player's name and symbol are displayed at the start of each turn.
- A player cannot make two moves in succession.

**[Sonnet: Solid and unambiguous. Consider adding: "If the active player is the AI, turn management shall hand off automatically without awaiting user input." This prevents any ambiguity about whether the game pauses for a key-press before AI moves.]**

---

### FR-006 · Move Input and Validation
**Description:** The game shall accept a move from the active human player and validate it before applying.
**Acceptance Criteria:**
- Input is accepted as a number 1–9 (mapped to cells left-to-right, top-to-bottom) or as row/column — choice documented to user. **[Sonnet: The "or as row/column" alternative is problematic. Supporting two distinct input formats in a CLI game adds parsing complexity and user confusion. If both formats are genuinely intended to be supported simultaneously, the parsing rules and conflict resolution must be specified explicitly (e.g., "2,3" vs "5"). If only one format is intended, the "or" should be removed. Recommendation: commit to a single format (1–9 numeric) for v1 and call out row/column as a potential v2 enhancement in Section 6.]**
- Non-numeric, out-of-range, or already-occupied cell inputs are rejected with a descriptive error.
- The user is re-prompted until a valid move is entered.
- A valid move updates the board with the active player's symbol.

---

### FR-007 · AI Move Generation
**Description:** When the AI's turn occurs, the game shall compute and play a move automatically based on the selected difficulty.
**Acceptance Criteria:**
- AI move computation completes within 1 second on Hard (see NFR-001).
- The AI's chosen cell is always legal (empty).
- The AI's move is announced before the board is redrawn (e.g., "Computer plays cell 5").

**[Sonnet: Good. One gap: there is no requirement specifying behaviour if the AI — through a defect — attempts to choose an already-occupied cell. While FR-007 states "always legal", the defensive fallback behaviour (exception? log and pick again? abort round?) should be specified for robustness, particularly given NFR-003.]**

---

### FR-008 · Win Detection
**Description:** After each move, the game shall check for a winning condition (three identical symbols in a row, column, or diagonal).
**Acceptance Criteria:**
- All 8 win lines (3 rows, 3 columns, 2 diagonals) are evaluated.
- When a win is detected, the round ends immediately and the winner is announced.
- The winning line may optionally be highlighted in the final board display. **[Sonnet: "May optionally" is requirements anti-language — it neither mandates nor prohibits. If highlighting is desired, it should be "shall" (with a caveat about ANSI support per NFR-005); if it is truly optional for developers, move it to a separate UI-level note. Leaving it as "optionally" makes it untestable and untraceable.]**

---

### FR-009 · Draw Detection
**Description:** The game shall detect a draw when all 9 cells are filled without a winner.
**Acceptance Criteria:**
- A draw is declared only after the 9th move if no win condition was triggered.
- A "Draw" message is shown to the user.
- The round ends and triggers the replay prompt (FR-011).

**[Sonnet: Technically correct, but the criterion "only after the 9th move" could be strengthened. It is possible (and more efficient) to detect a draw earlier: if no win has occurred and no empty cell remains after any move ≥ 5. The 9th-move wording implies the check happens only at move 9, which is fine functionally but slightly imprecise. No blocking issue — noting for clarity.]**

---

### FR-010 · Score Tracking
**Description:** The game shall maintain a running tally of wins for Player 1, wins for Player 2 (or AI), and draws across all rounds in the current session and prior sessions.
**Acceptance Criteria:**
- Scores increment by 1 for the appropriate category at the end of each round.
- The current scoreboard is shown after each round and at startup.
- Separate score buckets exist for HvH and HvAI (split by difficulty) to allow meaningful comparison.

**[Sonnet: "across all rounds in the current session and prior sessions" partially duplicates FR-012 (persistence). These two requirements should cross-reference each other explicitly to make it clear that FR-010 defines what is tracked and FR-012 defines how it is stored. As written, a developer could implement FR-010 in isolation without persistence and consider the requirement met.]**

**[Sonnet: The HvH score bucket does not specify whether Player 1 and Player 2 wins are tracked separately or just as a cumulative "human wins" total. In HvH, Player 1 and Player 2 are likely different people in different sessions, so separate "Player 1 slot wins" and "Player 2 slot wins" may not be meaningful across sessions. Clarification needed — or define this in the glossary.]**

---

### FR-011 · Replay Option
**Description:** After each round (win or draw), the game shall prompt the user to play again.
**Acceptance Criteria:**
- Prompt accepts Yes/No (case-insensitive `y`/`n`).
- Choosing Yes starts a new round, optionally allowing the user to change mode/difficulty. **[Sonnet: "Optionally allowing" is vague. Does the user always get the chance to change mode/difficulty, or only when they explicitly request it? Specify the UX flow: e.g., "Choosing Yes presents a sub-prompt: 'Keep same mode/difficulty? (y/n)'. A 'no' response returns to the main menu." Without this, implementations will diverge.]**
- Choosing No exits to the main menu or terminates the program (user choice). **[Sonnet: "Exits to main menu or terminates (user choice)" requires a further prompt ("Return to menu or quit?"), adding an interaction step. If this is intentional, that nested prompt should be documented here. Consider simplifying to "Choosing No returns to the main menu" and letting FR-014 handle outright termination.]**
- Invalid input re-prompts the user.

---

### FR-012 · Persistent Score Storage
**Description:** Scores shall be saved to a local file so that totals persist between application launches.
**Acceptance Criteria:**
- Scores are written to a file (e.g., `scores.json`) after each round and on graceful exit.
- On startup, the game loads existing scores from the file if it exists.
- If the file is missing or corrupted, the game starts with zeroed scores and logs a warning rather than crashing.
- The score file is human-readable (JSON or similar).

**[Sonnet: Good. The atomic write strategy is addressed in TR-005 rather than here — a cross-reference would help. Also, "corrupted" should be defined: does it mean invalid JSON, or also semantically invalid data (e.g., negative scores, unexpected keys)? Schema validation on load should be explicitly required.]**

---

### FR-013 · Reset Scores
**Description:** The user shall be able to reset the persistent scoreboard from the main menu.
**Acceptance Criteria:**
- A "Reset Scores" menu option exists.
- The user must confirm the action before scores are zeroed.
- After reset, the score file reflects all zeros.

**[Sonnet: Good. One gap: what happens to the in-memory score state after reset mid-session? The requirement says "the score file reflects all zeros" but does not explicitly state that the live in-memory scores are also reset simultaneously. These should be in sync.]**

---

### FR-014 · Graceful Exit
**Description:** The user shall be able to quit the game cleanly at any prompt.
**Acceptance Criteria:**
- A quit option (e.g., menu choice or `q` input) is available at all major prompts.
- On exit, scores are flushed to disk (per FR-012).
- The terminal is left in a clean state (no leftover prompts or partial output).

**[Sonnet: "All major prompts" is imprecise — enumerate which prompts qualify (main menu, replay prompt, mid-game input prompt) to prevent implementation ambiguity. Also, there is no requirement here or in NFR-003 for handling SIGINT (Ctrl+C). A user pressing Ctrl+C mid-game is a realistic scenario; if scores are not flushed, data is lost. See NFR-007 added below.]**

---

### FR-015 · First-Move Alternation Between Rounds *(Added by reviewer)*
**Description:** To ensure fairness across rounds, the player who goes second in one round shall go first in the next round.
**Acceptance Criteria:**
- After round 1 (where Player 1 / `X` moves first), Player 2 / `O` moves first in round 2, and so on, alternating each round.
- The symbol assignment (`X` moves first within a given round) follows the player who has the first-move privilege for that round, i.e., symbol roles may swap.
- The scoreboard display reflects the player's identity (name), not their symbol, to avoid confusion when symbols rotate.
- If this alternation behaviour is not desired, the document must explicitly state "Player 1 (`X`) always moves first in every round" as a deliberate design decision.

**[Sonnet: This requirement is added because FR-002's "X always moves first" creates a permanent first-mover advantage that is atypical in casual play. If the original intent is to lock X as always-first, that must be stated explicitly and the rationale documented (e.g., simplicity). Either way, a decision must be recorded.]**

---

### FR-016 · Mid-Game Forfeit / Abandon *(Added by reviewer)*
**Description:** A human player shall be able to abandon the current round in progress without terminating the entire application.
**Acceptance Criteria:**
- At any move-input prompt, entering `q` or `quit` (case-insensitive) triggers a forfeit confirmation ("Forfeit this round? y/n").
- Confirming a forfeit ends the round immediately; the non-forfeiting player is credited with a win.
- If the forfeiting player is Player 1 in HvAI mode, the AI is credited with a win.
- In HvH mode, the forfeiting player's opponent receives the win credit.
- Following a forfeit, the replay prompt (FR-011) is shown normally.
- Declining the forfeit confirmation returns the user to the move-input prompt without changing the board state.

**[Sonnet: Without this requirement, a user who wants to abandon a losing game has no clean path other than Ctrl+C (which has no score-safe handling) or quitting the whole application. This is a common usability omission in game requirements.]**

---

### FR-017 · Player Name Validation *(Added by reviewer)*
**Description:** Custom player names entered during setup shall be validated before being accepted.
**Acceptance Criteria:**
- Names must be between 1 and 20 characters in length.
- Names may contain alphanumeric characters, spaces, hyphens, and underscores only.
- Leading and trailing whitespace is stripped automatically.
- Two players in the same session may not share identical names (case-insensitive comparison); the user is re-prompted if a duplicate is detected.
- If a player skips name entry (empty input after stripping), a default name is applied ("Player 1" / "Player 2").
- The name "Computer" is reserved for the AI and rejected if entered by a human player, with a descriptive error message.

**[Sonnet: FR-002 gestures at custom names but provides no validation rules. Without this, edge cases — empty names, identical names, excessively long names, injection-style strings — are unhandled. This is particularly important for score file readability and display formatting.]**

---

## 3. Non-Functional Requirements

### NFR-001 · Performance
**Description:** The game shall remain responsive on standard consumer hardware.
**Acceptance Criteria:**
- AI move on Hard difficulty completes in ≤ 1 second. **[Sonnet: "Standard consumer hardware" should be defined, even loosely (e.g., "a dual-core machine with 2 GB RAM running Python 3.8"). Without a hardware baseline, this criterion is unmeasurable in CI. For a 3x3 Minimax, this is trivially achievable on any modern hardware, so the threshold is conservative — but the baseline should still be documented.]**
- Board rendering and input validation feel instantaneous (< 100 ms perceived latency).
- Application startup completes in ≤ 2 seconds.

---

### NFR-002 · Usability
**Description:** The game shall be intuitive for a first-time user without external documentation.
**Acceptance Criteria:**
- Instructions for input format (cell numbering) are shown at the start of each round.
- All prompts include examples of valid input.
- Error messages are specific and actionable (e.g., "Cell 5 is already taken — choose another").

**[Sonnet: Good. Consider adding: "No prompt shall require the user to recall information shown more than one screen ago" to enforce contextual self-sufficiency — important in a terminal that may scroll.]**

---

### NFR-003 · Reliability
**Description:** The game shall handle invalid input and unexpected conditions without crashing.
**Acceptance Criteria:**
- All user input paths validate input before use.
- File I/O failures (missing/corrupt score file, permission errors) are caught and reported.
- No unhandled exceptions are exposed to the user.

**[Sonnet: This NFR is appropriate but is missing explicit mention of SIGINT/KeyboardInterrupt (Ctrl+C). A raw `KeyboardInterrupt` bubbling to the terminal is an unhandled exception from the user's perspective. See NFR-007 below.]**

---

### NFR-004 · Maintainability
**Description:** The codebase shall be modular and easy to extend.
**Acceptance Criteria:**
- Game logic, AI, UI rendering, and persistence are separated into distinct modules/classes.
- Functions/methods have docstrings and clear names.
- Adding a new AI difficulty requires changes only to the AI module.
- Code passes a lint check (e.g., `flake8` or `ruff`) with no errors.

**[Sonnet: Good modular criterion. Recommend adding a type-annotation requirement: "All public functions and methods shall include type annotations compatible with `mypy --strict` or equivalent". This makes the "easy to extend" criterion verifiable and is standard practice in modern Python projects.]**

---

### NFR-005 · Portability
**Description:** The game shall run on Windows, macOS, and Linux terminals without modification.
**Acceptance Criteria:**
- No OS-specific dependencies are required for core functionality.
- File paths use `pathlib` or `os.path` for cross-platform compatibility.
- ANSI/color output degrades gracefully on terminals lacking ANSI support. **[Sonnet: "Degrades gracefully" is vague. Specify how: "When ANSI support is not detected (e.g., `os.environ.get('TERM') == 'dumb'` or running under a non-TTY pipe), the game shall suppress all ANSI escape codes and fall back to plain-text output." Without this, developers will implement detection inconsistently.]**

---

### NFR-006 · Testability
**Description:** Core game logic shall be unit-testable in isolation.
**Acceptance Criteria:**
- Win/draw detection, move validation, and AI move selection are pure functions or testable methods.
- A test suite (e.g., `pytest`) covers happy paths and edge cases for these components.
- Tests can run without user interaction.

**[Sonnet: No code-coverage target is specified. Recommend adding: "Test coverage for the Board, AI, and ScoreManager modules shall be ≥ 90% line coverage, verified by `pytest-cov`." Without a numeric target, "covers happy paths and edge cases" is subjective and untestable in CI.]**

**[Sonnet: Also missing: a requirement that the Hard AI is verified to never lose by an automated adversarial test — though TR-004 touches on this, it belongs here too (or at minimum should cross-reference NFR-006). Testability of the "never loses" guarantee is a key quality gate.]**

---

### NFR-007 · Signal and Interrupt Handling *(Added by reviewer)*
**Description:** The game shall handle OS-level interrupts (SIGINT / Ctrl+C) gracefully without data loss.
**Acceptance Criteria:**
- A `KeyboardInterrupt` at any point in the game loop shall be caught at the top-level entry point.
- Upon catching `KeyboardInterrupt`, the game shall flush the current in-memory scores to disk (per FR-012) before exiting.
- A brief message (e.g., "Game interrupted. Scores saved. Goodbye.") shall be printed.
- The terminal shall be left in a clean state (cursor visible, no stray output).
- The process shall exit with return code `130` (standard SIGINT exit code) to allow shell scripts to detect interrupted execution.

**[Sonnet: This is a near-universal omission in game requirement documents. Without it, a Ctrl+C during a session silently discards the current round's score update and potentially corrupts any partially written score file if the interrupt lands mid-write (mitigated by TR-005's atomic write, but the score data loss still applies).]**

---

### NFR-008 · Accessibility — Color Independence *(Added by reviewer)*
**Description:** The game shall never rely on color alone to convey information critical to gameplay.
**Acceptance Criteria:**
- Player symbols (`X` and `O`) are distinguishable by character, not only by color.
- Win/draw announcements and error messages are communicated via text, not exclusively via color highlighting.
- A colorblind user playing on a monochrome terminal shall be able to play the full game without missing any information.

**[Sonnet: ANSI coloring is mentioned in NFR-005 and TR-002 (colorama), but there is no requirement ensuring that color is additive (enhancement only) rather than essential. This is a basic accessibility concern.]**

---

## 4. User Interface Requirements

### UI-001 · Board Rendering
**Description:** The game shall display the 3x3 board clearly in the terminal after every move.
**Acceptance Criteria:**
- Cells are separated by visible delimiters (e.g., `|` and `---`).
- Empty cells display their cell number (1–9) to assist input, or a blank space — choice documented. **[Sonnet: Displaying cell numbers in empty cells is strictly superior for usability (the user always has a visual reference) and should be the mandated default. "Or a blank space" weakens the requirement unnecessarily. Recommend: "Empty cells shall display their cell number (1–9) by default. A blank-space rendering may be offered as a toggle for experienced players."]**
- The board is redrawn (not appended) so the screen stays uncluttered (use screen-clear or extra spacing). **[Sonnet: Screen-clear using `os.system('cls'/'clear')` or ANSI escape `\033[2J` will cause problems in non-interactive environments (e.g., output piped to a file, CI logs, Windows terminals without ANSI). Recommend adding: "If the terminal is not a TTY (detected via `sys.stdout.isatty()`), screen-clear shall be suppressed and board redraws shall be separated by a blank-line divider instead." See also UI-007 below.]**

---

### UI-002 · Main Menu
**Description:** A main menu shall be presented at startup and after each replay decision.
**Acceptance Criteria:**
- Menu options: Human vs Human, Human vs AI, View Scores, Reset Scores, Quit.
- Options are numbered for selection.
- Current scoreboard summary is visible from or near the menu.

**[Sonnet: "View Scores" and "Reset Scores" are listed here but their corresponding functional requirements (FR-010 and FR-013) do not explicitly reference this menu. Cross-references should be added. Also: UI-006 (Help/Instructions) is accessible from the main menu but "Help" is not listed among the menu options here — omission.]**

---

### UI-003 · Turn Prompt
**Description:** Each turn shall display whose move it is and request input.
**Acceptance Criteria:**
- The prompt includes the player's name and symbol (e.g., "Alice (X), enter cell 1–9: ").
- The prompt is shown after the board is rendered.

**[Sonnet: Good. Suggest adding: "For HvAI mode when it is the AI's turn, a 'Thinking…' indicator shall be shown briefly before the AI move is displayed, to prevent the interface from appearing to freeze." This is especially relevant if the Hard Minimax ever takes close to the 1-second limit.]**

---

### UI-004 · End-of-Round Feedback
**Description:** The game shall clearly announce the result of each round.
**Acceptance Criteria:**
- A win announces the winner's name and symbol.
- A draw is announced as such with no implied winner.
- Updated scores are shown immediately after the result.

**[Sonnet: Clear and complete. No issues.]**

---

### UI-005 · Error Messaging
**Description:** All invalid actions shall trigger clear, non-technical error messages.
**Acceptance Criteria:**
- Errors are printed on a single line near the prompt.
- Errors do not duplicate or accumulate visually.
- The user is re-prompted without losing game state.

**[Sonnet: Good. "Near the prompt" is slightly ambiguous in a terminal context. Suggest: "Errors are printed on the line immediately preceding the re-issued prompt, with the board remaining visible above."]**

---

### UI-006 · Help/Instructions
**Description:** A brief help screen shall be accessible from the main menu.
**Acceptance Criteria:**
- Help describes rules, input format, AI levels, and how to quit.
- Help is reachable in ≤ 2 keystrokes from the main menu.

**[Sonnet: "Help" is not listed as an option in UI-002's menu option list — this is a direct contradiction. UI-002 must be updated to include a "Help / Instructions" option. Also, the help screen should describe the mid-game forfeit option (FR-016) once that is implemented.]**

---

### UI-007 · Non-Interactive / Pipe-Safe Output Mode *(Added by reviewer)*
**Description:** When the game's standard output is not connected to an interactive TTY, the UI shall adapt to produce clean, readable plain-text output.
**Acceptance Criteria:**
- At startup, `sys.stdout.isatty()` is checked; if `False`, the game enters "pipe-safe" mode.
- In pipe-safe mode: ANSI escape codes are suppressed, screen-clear calls are skipped, and board redraws are separated by a text divider (e.g., `---`).
- Pipe-safe mode does not disable any functional behavior — it affects only rendering.
- This mode is also automatically activated when the `NO_COLOR` environment variable is set (per the `no-color.org` convention).

**[Sonnet: This addresses the screen-clear fragility noted in UI-001 and the ANSI degradation vagueness in NFR-005. It is also essential for any CI-based integration test that captures stdout for assertion.]**

---

## 5. Technical Requirements

### TR-001 · Language and Runtime
**Description:** The game shall be implemented in Python 3.8 or newer.
**Acceptance Criteria:**
- Code uses only features available in Python 3.8+.
- A `requirements.txt` or `pyproject.toml` declares the Python version.

**[Sonnet: Correct and consistent (once the Overview is updated to match). Recommend adding: "The project shall declare a Python version constraint using the `requires-python` field in `pyproject.toml` (e.g., `requires-python = ">=3.8"`) to prevent installation on incompatible runtimes."]**

---

### TR-002 · Dependencies
**Description:** The game shall minimize external dependencies, using the standard library where practical.
**Acceptance Criteria:**
- Core gameplay relies on the standard library only (`json`, `random`, `pathlib`, etc.).
- Any optional third-party packages (e.g., `colorama` for cross-platform colors) are listed in `requirements.txt` with pinned versions.

**[Sonnet: Good. Pinned versions are the right call for reproducibility. Recommend also specifying a hash-pinning mechanism (e.g., `pip-compile` with `--generate-hashes`) for supply-chain security, even for a small project like this.]**

---

### TR-003 · Architecture
**Description:** The application shall follow a modular architecture separating concerns.
**Acceptance Criteria:**
- Modules/classes exist for: `Board`, `Game` (controller), `Player` (with `HumanPlayer` and `AIPlayer` subclasses), `AI` strategies (Easy/Medium/Hard), `ScoreManager` (persistence), and `UI`/CLI rendering.
- Cross-module dependencies flow in one direction (UI → Game → Board/Player); no circular imports.

**[Sonnet: The dependency direction "UI → Game → Board/Player" is a good constraint. However, placing `ScoreManager` is ambiguous — does it sit at the `Game` layer or `UI` layer? Clarify: "ScoreManager is accessed only by the Game controller; the UI reads scores via the Game controller interface."]**

**[Sonnet: No mention of an event or callback mechanism for communicating game state changes (e.g., move made, round ended) from Game to UI. For a simple CLI game this may be handled by direct method calls, but documenting the intended coupling style (direct call vs. observer vs. return-value passing) avoids conflicting implementations across contributors.]**

---

### TR-004 · AI Implementation
**Description:** The Hard AI shall use the Minimax algorithm to guarantee optimal play.
**Acceptance Criteria:**
- Minimax explores the full game tree (3x3 is small enough; alpha-beta pruning optional).
- Hard AI never loses against any opponent — verified by automated tests.
- Easy and Medium use distinct, documented strategies (random; heuristic/mixed). **[Sonnet: "Heuristic/mixed" still echoes the ambiguity from FR-004. Once FR-004's Medium definition is resolved, this criterion should mirror it exactly for consistency.]**

---

### TR-005 · Score Persistence Format
**Description:** Scores shall be persisted in a structured, human-readable format.
**Acceptance Criteria:**
- The score file is JSON.
- Schema includes: HvH wins per player slot, HvAI wins per difficulty (human wins, AI wins, draws), and a schema version field.
- File is written atomically (write to temp + rename) to prevent corruption.

**[Sonnet: Excellent inclusion of atomic write and schema versioning. Recommend adding a migration requirement: "If the loaded score file's schema version does not match the current application version, the game shall attempt a schema migration or, if migration is not possible, warn the user and offer to reset scores rather than silently discarding old data." Without this, a version upgrade will silently zero or corrupt accumulated scores.]**

---

### TR-006 · File Locations
**Description:** Persistent files shall be stored in a predictable, user-appropriate location.
**Acceptance Criteria:**
- Default location is the user's home directory or an OS-appropriate config path (e.g., `~/.tictactoe/scores.json`).
- The path is configurable via environment variable or constant.
- The directory is created automatically if missing.

**[Sonnet: On Windows, `~/.tictactoe/` is valid but the idiomatic location would be `%APPDATA%\tictactoe\`. Using `platformdirs` (a lightweight stdlib-adjacent library) to resolve OS-appropriate paths is worth specifying here, or explicitly note "for v1, `~/.tictactoe/` is acceptable on all platforms with a v2 note to adopt platform conventions".]**

---

### TR-007 · Entry Point and Packaging
**Description:** The game shall be runnable from the command line via a single command.
**Acceptance Criteria:**
- Running `python -m tictactoe` (or equivalent script) launches the game.
- A `__main__.py` or console-script entry point is provided.
- A `README.md` documents installation and run instructions.

**[Sonnet: Good. Recommend adding: "`README.md` shall document the `--debug` flag (TR-008) and the `TICTACTOE_SCORES_PATH` environment variable (TR-006) as part of the configuration reference."]**

---

### TR-008 · Logging
**Description:** The application shall log unexpected conditions for debugging without polluting normal output.
**Acceptance Criteria:**
- Python's `logging` module is used at WARNING level by default.
- Logs go to a file (e.g., `~/.tictactoe/app.log`), not the user's terminal, unless a `--debug` flag is set.

**[Sonnet: The `--debug` flag is introduced here but is not formally specified as a CLI argument. TR-009 (added below) addresses this gap. Also: a log rotation policy should be defined — an infinitely growing `app.log` in the user's home directory is poor practice. Specify: "The log file shall be capped at 1 MB with a single backup rotation (e.g., using `RotatingFileHandler`)."]**

---

### TR-009 · Command-Line Interface Arguments *(Added by reviewer)*
**Description:** The application shall support a documented set of command-line arguments for runtime configuration.
**Acceptance Criteria:**
- CLI argument parsing uses Python's `argparse` module.
- The following arguments are supported:
  - `--debug` : Sets logging level to DEBUG and directs log output to the terminal (stderr) in addition to the log file.
  - `--scores-path <path>` : Overrides the default score file location (supersedes the environment variable from TR-006 when both are provided; `--scores-path` takes precedence).
  - `--no-color` : Disables all ANSI color output regardless of terminal capability (equivalent to setting `NO_COLOR` env var).
  - `--version` : Prints the application version string and exits.
- Running `python -m tictactoe --help` outputs a usage summary covering all arguments.
- Unknown arguments cause the application to print a usage error and exit with code `2` (argparse standard).

**[Sonnet: TR-008 and TR-006 both reference runtime configuration flags without a unifying CLI argument specification. This requirement formalises those references into a single, testable contract.]**

---

### TR-010 · Version Metadata *(Added by reviewer)*
**Description:** The application shall expose its version number in a single authoritative location.
**Acceptance Criteria:**
- A `__version__` string is defined in `tictactoe/__init__.py` (or equivalent).
- The version string follows Semantic Versioning (semver.org): `MAJOR.MINOR.PATCH`.
- `python -m tictactoe --version` prints the version string (sourced from `__version__`).
- The version is also included in the `pyproject.toml` `[project]` table and kept in sync with `__version__` (automated by the build tool or enforced by CI check).

**[Sonnet: Without a version identifier, the schema versioning in TR-005 has no anchor, the README has no version reference, and bug reports from users cannot be correlated to a specific build. This is a foundational omission for any packaged application.]**

---

## 6. Out of Scope

- Online/networked multiplayer.
- Graphical user interface (GUI) or web frontend.
- Custom board sizes (e.g., 4x4, 5x5) — fixed at 3x3. **[Sonnet: Wise to lock this for v1. The architecture in TR-003 should ensure `Board` is parameterised internally even if custom sizes are out of scope, so that a v2 extension doesn't require a rewrite. Recommend adding an architecture note: "Although custom board sizes are out of scope, the `Board` class should accept dimensions as constructor parameters to facilitate future extension."]**
- User accounts or authentication.
- Sound effects or animations.
- Localization/internationalization (English only for v1).
- *(Added by reviewer)* **Automated game replay / spectator mode** — replaying a recorded sequence of moves is not required for v1. **[Sonnet: This is worth explicitly calling out as out of scope because the score-persistence schema (TR-005) and modular architecture (TR-003) could easily tempt a developer into implementing move history. Calling it out prevents gold-plating.]**
- *(Added by reviewer)* **Row/column coordinate input format** — per the note on FR-006, the alternative row/column input format is deferred to v2. Only the 1–9 numeric cell format is in scope for v1.

---

## 7. Glossary

- **HvH:** Human vs Human local play.
- **HvAI:** Human vs AI play.
- **Minimax:** A recursive decision algorithm for two-player zero-sum games that selects the move minimizing the opponent's maximum payoff.
- **Round:** A single game played from empty board to win or draw.
- **Session:** The period from launching the application to quitting it.
- *(Added by reviewer)* **Forfeit:** A player's voluntary abandonment of the current round mid-game, awarding a win to the opponent (see FR-016).
- *(Added by reviewer)* **Pipe-safe mode:** A rendering mode active when stdout is not a TTY, suppressing ANSI codes and screen-clear calls (see UI-007).
- *(Added by reviewer)* **Atomic write:** A file-write strategy where data is written to a temporary file and then renamed to the target path, ensuring the target is never left in a partially written state (see TR-005).
- *(Added by reviewer)* **Schema version:** A numeric or string field embedded in the score file that identifies the data format version, enabling forward-compatible migration (see TR-005, TR-010).

---

## 8. Summary of Reviewer Findings

**[Sonnet: The following table consolidates all significant issues raised in this review for triage.]**

| # | Location | Severity | Finding |
|---|----------|----------|---------|
| 1 | FR-002 | **Critical** | Typo: "X and Y" should be "X and O" in the description. |
| 2 | FR-004 | **High** | Medium AI defined with two mutually exclusive algorithms joined by "or" — unimplementable as written. |
| 3 | FR-006 | **High** | Dual input formats (1–9 vs row/column) left ambiguous; one must be selected for v1. |
| 4 | FR-002 / FR-015 | **High** | No policy defined for first-move alternation between rounds; creates permanent first-mover advantage. |
| 5 | NFR-003 / NFR-007 | **High** | No SIGINT/Ctrl+C handling specified; score data loss and terminal corruption risk. |
| 6 | FR-008 | **Medium** | "May optionally be highlighted" is non-testable requirements language. |
| 7 | FR-011 | **Medium** | "Optionally allowing mode change" and "exits to menu or terminates (user choice)" are underspecified UX flows. |
| 8 | UI-001 | **Medium** | Screen-clear strategy will break in non-TTY environments (CI, piped output). |
| 9 | TR-005 | **Medium** | No schema migration strategy; version upgrades will silently destroy accumulated scores. |
| 10 | NFR-006 | **Medium** | No code-coverage target specified; testability criterion is subjective. |
| 11 | UI-002 / UI-006 | **Low** | "Help" option present in UI-006 but absent from the menu option list in UI-002. |
| 12 | TR-008 / TR-009 | **Low** | `--debug` flag referenced but CLI argument specification is absent; TR-009 added. |
| 13 | Overview / TR-001 | **Low** | "Python 3.x" in Overview conflicts with "Python 3.8+" in TR-001. |
| 14 | FR-010 | **Low** | "Prior sessions" language duplicates FR-012 without a cross-reference. |
| 15 | NFR-004 | **Low** | No type-annotation requirement; recommend `mypy` compliance for maintainability. |

**New requirements added by reviewer:** FR-015, FR-016, FR-017, NFR-007, NFR-008, UI-007, TR-009, TR-010, plus Glossary entries and Out-of-Scope clarifications.
