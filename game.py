"""Command-line Tic Tac Toe game.

Provides Board, AI, ScoreTracker, and Game classes. Run as a script to play
interactively; import the module to test individual components.
"""

from __future__ import annotations

import json
import random
import re
import sys
from pathlib import Path
from typing import Iterable, Optional


# ---------------------------------------------------------------------------
# Board
# ---------------------------------------------------------------------------

EMPTY = " "

# All 8 winning lines (as 0-indexed cell triples).
WIN_LINES: tuple[tuple[int, int, int], ...] = (
    (0, 1, 2), (3, 4, 5), (6, 7, 8),   # rows
    (0, 3, 6), (1, 4, 7), (2, 5, 8),   # columns
    (0, 4, 8), (2, 4, 6),              # diagonals
)


class Board:
    """A 3x3 Tic Tac Toe board.

    Cells are indexed 0..8 internally; the public make_move/is_valid_move API
    accepts 1..9 to match the user-facing numeric scheme.
    """

    SIZE = 3
    CELLS = 9

    def __init__(self) -> None:
        self.cells: list[str] = [EMPTY] * self.CELLS

    # --- queries ----------------------------------------------------------

    def empty_cells(self) -> list[int]:
        """Return 0-indexed positions of all empty cells."""
        return [i for i, c in enumerate(self.cells) if c == EMPTY]

    def is_full(self) -> bool:
        """True iff every cell has been played."""
        return EMPTY not in self.cells

    def is_valid_move(self, position: int) -> bool:
        """Position is 1..9. True iff in-range and the cell is empty."""
        if not isinstance(position, int):
            return False
        if position < 1 or position > self.CELLS:
            return False
        return self.cells[position - 1] == EMPTY

    def winner(self) -> Optional[str]:
        """Return the winning symbol ('X' or 'O') or None."""
        for a, b, c in WIN_LINES:
            if self.cells[a] != EMPTY and self.cells[a] == self.cells[b] == self.cells[c]:
                return self.cells[a]
        return None

    def winning_line(self) -> Optional[tuple[int, int, int]]:
        """Return the 0-indexed winning triple, or None."""
        for line in WIN_LINES:
            a, b, c = line
            if self.cells[a] != EMPTY and self.cells[a] == self.cells[b] == self.cells[c]:
                return line
        return None

    def is_draw(self) -> bool:
        """True iff the board is full and there is no winner."""
        return self.is_full() and self.winner() is None

    def is_game_over(self) -> bool:
        return self.winner() is not None or self.is_full()

    # --- mutations --------------------------------------------------------

    def make_move(self, position: int, symbol: str) -> bool:
        """Place `symbol` at 1-indexed `position`. Returns True on success."""
        if symbol not in ("X", "O"):
            raise ValueError(f"Invalid symbol: {symbol!r}")
        if not self.is_valid_move(position):
            return False
        self.cells[position - 1] = symbol
        return True

    def undo_move(self, position: int) -> None:
        """Clear a cell (used by the minimax search)."""
        if 1 <= position <= self.CELLS:
            self.cells[position - 1] = EMPTY

    def reset(self) -> None:
        """Clear every cell."""
        self.cells = [EMPTY] * self.CELLS

    # --- rendering --------------------------------------------------------

    def render(self, highlight: Iterable[int] | None = None) -> str:
        """Return an ASCII rendering of the board.

        Empty cells show their 1-indexed position number (legend). If
        `highlight` is given, those 0-indexed cells are wrapped in [ ].
        """
        highlight_set = set(highlight) if highlight else set()
        rendered_cells: list[str] = []
        for i, c in enumerate(self.cells):
            content = c if c != EMPTY else str(i + 1)
            if i in highlight_set:
                rendered_cells.append(f"[{content}]")
            else:
                rendered_cells.append(f" {content} ")
        rows = []
        for r in range(self.SIZE):
            row = "|".join(rendered_cells[r * self.SIZE:(r + 1) * self.SIZE])
            rows.append(row)
        sep = "---+---+---"
        return f"\n{sep}\n".join(rows)


# ---------------------------------------------------------------------------
# AI
# ---------------------------------------------------------------------------

class AI:
    """Tic Tac Toe AI with three difficulty levels.

    Difficulty values: 'easy', 'medium', 'hard'.

    All public move-selection methods return a 1-indexed cell position and
    do *not* mutate the input board.
    """

    DIFFICULTIES = ("easy", "medium", "hard")

    def __init__(self, symbol: str, difficulty: str = "hard",
                 rng: random.Random | None = None) -> None:
        if symbol not in ("X", "O"):
            raise ValueError(f"AI symbol must be 'X' or 'O', got {symbol!r}")
        if difficulty not in self.DIFFICULTIES:
            raise ValueError(
                f"Difficulty must be one of {self.DIFFICULTIES}, got {difficulty!r}"
            )
        self.symbol = symbol
        self.opponent = "O" if symbol == "X" else "X"
        self.difficulty = difficulty
        self.rng = rng if rng is not None else random.Random()

    @property
    def label(self) -> str:
        """Reserved display name, e.g. 'AI (Hard)'."""
        return f"AI ({self.difficulty.capitalize()})"

    # --- dispatch ---------------------------------------------------------

    def get_move(self, board: Board) -> int:
        """Return a 1-indexed move chosen according to the difficulty."""
        if not board.empty_cells():
            raise ValueError("AI cannot move: board is full")
        if self.difficulty == "easy":
            return self._easy(board)
        if self.difficulty == "medium":
            return self._medium(board)
        return self._hard(board)

    # --- easy -------------------------------------------------------------

    def _easy(self, board: Board) -> int:
        """Uniformly random legal move (1-indexed)."""
        choice = self.rng.choice(board.empty_cells())
        return choice + 1

    # --- medium -----------------------------------------------------------

    def _find_immediate_win(self, board: Board, symbol: str) -> Optional[int]:
        """Return a 1-indexed move that immediately wins for `symbol`."""
        for idx in board.empty_cells():
            board.cells[idx] = symbol
            won = board.winner() == symbol
            board.cells[idx] = EMPTY
            if won:
                return idx + 1
        return None

    def _medium(self, board: Board) -> int:
        """Win if possible, else block opponent's win, else random."""
        win = self._find_immediate_win(board, self.symbol)
        if win is not None:
            return win
        block = self._find_immediate_win(board, self.opponent)
        if block is not None:
            return block
        return self._easy(board)

    # --- hard (minimax) ---------------------------------------------------

    def _hard(self, board: Board) -> int:
        """Pick the move with the best minimax score (alpha-beta pruned).

        Tie-breaks on the lowest-indexed cell. Depth-aware scoring prefers
        fast wins and slow losses, so among optimal moves the AI naturally
        picks the one that wins in the fewest plies.
        """
        best_score = -float("inf")
        best_move = board.empty_cells()[0] + 1  # safe default
        for idx in board.empty_cells():
            board.cells[idx] = self.symbol
            score = self._minimax(
                board, depth=1, is_maximising=False,
                alpha=-float("inf"), beta=float("inf"),
            )
            board.cells[idx] = EMPTY
            if score > best_score:
                best_score = score
                best_move = idx + 1
        return best_move

    def _minimax(self, board: Board, depth: int, is_maximising: bool,
                 alpha: float, beta: float) -> int:
        """Recursive minimax with alpha-beta pruning. Returns a depth-aware score."""
        winner = board.winner()
        if winner == self.symbol:
            return 10 - depth
        if winner == self.opponent:
            return depth - 10
        if board.is_full():
            return 0

        if is_maximising:
            value = -10**9
            for idx in board.empty_cells():
                board.cells[idx] = self.symbol
                value = max(value, self._minimax(board, depth + 1, False, alpha, beta))
                board.cells[idx] = EMPTY
                alpha = max(alpha, value)
                if alpha >= beta:
                    break
            return value
        else:
            value = 10**9
            for idx in board.empty_cells():
                board.cells[idx] = self.opponent
                value = min(value, self._minimax(board, depth + 1, True, alpha, beta))
                board.cells[idx] = EMPTY
                beta = min(beta, value)
                if alpha >= beta:
                    break
            return value


# ---------------------------------------------------------------------------
# ScoreTracker
# ---------------------------------------------------------------------------

class ScoreTracker:
    """Tracks per-player wins, losses, and draws and persists to JSON.

    The on-disk schema is:

        {
          "schema_version": 1,
          "players": {
            "<lower-cased name>": {
              "display_name": "<original casing>",
              "wins": <int>, "losses": <int>, "draws": <int>
            },
            ...
          }
        }

    Player names are looked up case-insensitively; the original casing is
    preserved in `display_name`.
    """

    SCHEMA_VERSION = 1
    DEFAULT_PATH = Path("scores.json")

    def __init__(self, path: Path | str | None = None) -> None:
        self.path = Path(path) if path is not None else self.DEFAULT_PATH
        self.players: dict[str, dict] = {}

    # --- record updates ---------------------------------------------------

    def _ensure(self, name: str) -> dict:
        """Get-or-create a record for `name`, keyed by lower-case lookup."""
        if not isinstance(name, str) or not name.strip():
            raise ValueError("Player name must be a non-empty string")
        key = name.strip().lower()
        if key not in self.players:
            self.players[key] = {
                "display_name": name.strip(),
                "wins": 0, "losses": 0, "draws": 0,
            }
        return self.players[key]

    def record_win(self, name: str) -> None:
        self._ensure(name)["wins"] += 1

    def record_loss(self, name: str) -> None:
        self._ensure(name)["losses"] += 1

    def record_draw(self, name: str) -> None:
        self._ensure(name)["draws"] += 1

    def record_result(self, winner: str | None, loser: str | None) -> None:
        """Update both players' records for one round.

        Pass winner=None for a draw (loser is then ignored — supply both
        names so each gets a draw).
        """
        if winner is None:
            # Draw: both names should be passed; treat both as draws.
            return  # use record_draw_pair below for clarity
        self.record_win(winner)
        if loser is not None:
            self.record_loss(loser)

    def record_draw_pair(self, name_a: str, name_b: str) -> None:
        """Record a draw for two distinct players."""
        self.record_draw(name_a)
        if name_a.strip().lower() != name_b.strip().lower():
            self.record_draw(name_b)

    # --- queries ----------------------------------------------------------

    def get(self, name: str) -> dict:
        """Return the record for `name`, creating an empty one if missing."""
        return dict(self._ensure(name))  # copy so callers can't mutate

    def all_records(self) -> list[dict]:
        """Return all records, sorted by wins desc, losses asc, name asc."""
        records = []
        for rec in self.players.values():
            played = rec["wins"] + rec["losses"] + rec["draws"]
            records.append({**rec, "played": played})
        records.sort(key=lambda r: (-r["wins"], r["losses"], r["display_name"].lower()))
        return records

    def reset(self) -> None:
        """Wipe in-memory records."""
        self.players = {}

    # --- persistence ------------------------------------------------------

    def to_dict(self) -> dict:
        return {
            "schema_version": self.SCHEMA_VERSION,
            "players": {k: dict(v) for k, v in self.players.items()},
        }

    def save(self) -> bool:
        """Write to `self.path`. Returns True on success, False on failure."""
        try:
            data = json.dumps(self.to_dict(), indent=2)
            with open(self.path, "w", encoding="utf-8") as fh:
                fh.write(data)
            return True
        except OSError:
            return False

    def load(self) -> bool:
        """Load from `self.path`. Returns True on success, False on missing/corrupt.

        On corrupt data, the in-memory store is left empty and a `.bak` is
        written next to the original file.
        """
        try:
            with open(self.path, "r", encoding="utf-8") as fh:
                raw = fh.read()
        except FileNotFoundError:
            return False
        except OSError:
            return False

        try:
            data = json.loads(raw)
            self._validate_and_load(data)
            return True
        except (json.JSONDecodeError, ValueError, TypeError):
            # Corrupt: rename to .bak (best effort) and start clean.
            try:
                bak = Path(str(self.path) + ".bak")
                with open(bak, "w", encoding="utf-8") as fh:
                    fh.write(raw)
            except OSError:
                pass
            self.players = {}
            return False

    def _validate_and_load(self, data: object) -> None:
        if not isinstance(data, dict):
            raise ValueError("score file root must be an object")
        if data.get("schema_version") != self.SCHEMA_VERSION:
            raise ValueError("unrecognised schema_version")
        players = data.get("players")
        if not isinstance(players, dict):
            raise ValueError("'players' must be an object")
        cleaned: dict[str, dict] = {}
        for key, rec in players.items():
            if not isinstance(key, str) or not isinstance(rec, dict):
                raise ValueError("malformed player entry")
            display = rec.get("display_name", key)
            wins = rec.get("wins", 0)
            losses = rec.get("losses", 0)
            draws = rec.get("draws", 0)
            if not all(isinstance(x, int) and x >= 0 for x in (wins, losses, draws)):
                raise ValueError("counters must be non-negative integers")
            if not isinstance(display, str):
                raise ValueError("display_name must be a string")
            cleaned[key.lower()] = {
                "display_name": display,
                "wins": wins, "losses": losses, "draws": draws,
            }
        self.players = cleaned


# ---------------------------------------------------------------------------
# Game
# ---------------------------------------------------------------------------

# Reserved names that humans cannot use (case-insensitive).
RESERVED_NAMES = frozenset({
    "ai", "computer",
    "ai (easy)", "ai (medium)", "ai (hard)",
})

NAME_PATTERN = re.compile(r"^[A-Za-z0-9 _\-]{1,20}$")


def validate_name(raw: str, taken: Iterable[str] = ()) -> tuple[bool, str]:
    """Validate a player name.

    Returns (True, cleaned_name) on success, or (False, error_message).
    `taken` is a collection of existing names (case-insensitive) that may
    not be reused (e.g., the other player in HvH mode).
    """
    if not isinstance(raw, str):
        return False, "Name must be text."
    cleaned = raw.strip()
    if not cleaned:
        return False, "Name cannot be empty."
    if len(cleaned) > 20:
        return False, "Name must be at most 20 characters."
    if cleaned.lower() in RESERVED_NAMES:
        return False, "That name is reserved. Please choose another."
    if not NAME_PATTERN.match(cleaned):
        return False, ("Name may only contain letters, digits, "
                       "spaces, hyphens, and underscores.")
    taken_lower = {t.strip().lower() for t in taken}
    if cleaned.lower() in taken_lower:
        return False, "That name is already taken by the other player."
    return True, cleaned


class Game:
    """Coordinates a Tic Tac Toe round between two players.

    A 'player' here is described by a dict-like spec:
        {"name": str, "is_ai": bool, "ai": AI | None}
    The first player in `players` gets 'X' and moves first by default;
    starting player rotates each round when `play_round` is called via
    the interactive loop (handled in `play_session`).

    The class is purposefully decoupled from terminal I/O: the input and
    output callables can be injected to make rounds fully testable.
    """

    def __init__(self,
                 players: list[dict],
                 score_tracker: ScoreTracker | None = None,
                 input_fn=input,
                 output_fn=print) -> None:
        if len(players) != 2:
            raise ValueError("Game requires exactly two players")
        self.players = players
        self.score_tracker = score_tracker if score_tracker is not None else ScoreTracker()
        self.input_fn = input_fn
        self.output_fn = output_fn
        self.board = Board()

    # --- helpers ----------------------------------------------------------

    def _say(self, msg: str = "") -> None:
        self.output_fn(msg)

    def _ask(self, prompt: str) -> str:
        return self.input_fn(prompt)

    def _get_human_move(self, player: dict) -> Optional[int]:
        """Prompt a human for a move. Returns 1..9 or None on forfeit."""
        while True:
            try:
                raw = self._ask(
                    f"{player['name']} ({player['symbol']}) — "
                    "enter position (1-9, or 'q' to quit round): "
                ).strip().lower()
            except EOFError:
                return None
            if raw in ("q", "quit", "exit"):
                # Confirm forfeit
                try:
                    confirm = self._ask("Forfeit this round? [y/N] ").strip().lower()
                except EOFError:
                    return None
                if confirm in ("y", "yes"):
                    return None
                continue
            try:
                pos = int(raw)
            except ValueError:
                self._say("Invalid input. Please enter a number between 1 and 9.")
                continue
            if pos < 1 or pos > 9:
                self._say("Invalid input. Please enter a number between 1 and 9.")
                continue
            if not self.board.is_valid_move(pos):
                self._say(f"Cell {pos} is already taken. Please choose an empty cell.")
                continue
            return pos

    def _get_ai_move(self, player: dict) -> int:
        ai: AI = player["ai"]
        # Ensure the AI has the same symbol the player slot is using this round.
        ai.symbol = player["symbol"]
        ai.opponent = "O" if ai.symbol == "X" else "X"
        move = ai.get_move(self.board)
        self._say(f"{player['name']} plays at position {move}.")
        return move

    # --- main round loop --------------------------------------------------

    def play_round(self, starting_index: int = 0) -> dict:
        """Play one round to completion.

        `starting_index` is 0 or 1 — the player who plays first plays 'X'.
        Returns a dict describing the outcome:
            {"winner": <name|None>, "loser": <name|None>,
             "draw": bool, "forfeit": bool, "moves": int}
        """
        if starting_index not in (0, 1):
            raise ValueError("starting_index must be 0 or 1")
        self.board.reset()
        # Assign symbols based on who starts.
        first = self.players[starting_index]
        second = self.players[1 - starting_index]
        first["symbol"] = "X"
        second["symbol"] = "O"

        order = [first, second]
        moves = 0
        current_idx = 0

        self._say(self.board.render())
        while not self.board.is_game_over():
            current = order[current_idx]
            if current.get("is_ai"):
                pos = self._get_ai_move(current)
            else:
                pos = self._get_human_move(current)
                if pos is None:
                    # Forfeit — round ends without recording a result.
                    self._say(f"{current['name']} forfeited the round.")
                    return {"winner": None, "loser": None,
                            "draw": False, "forfeit": True, "moves": moves}
            self.board.make_move(pos, current["symbol"])
            moves += 1
            self._say(self.board.render(highlight=self.board.winning_line() or ()))
            current_idx = 1 - current_idx

        winner_symbol = self.board.winner()
        if winner_symbol is None:
            self._say("It's a draw! Well played by both sides.")
            self.score_tracker.record_draw_pair(first["name"], second["name"])
            return {"winner": None, "loser": None,
                    "draw": True, "forfeit": False, "moves": moves}

        winner = first if first["symbol"] == winner_symbol else second
        loser = second if winner is first else first
        self._say(f"{winner['name']} ({winner_symbol}) wins!")
        self.score_tracker.record_result(winner["name"], loser["name"])
        return {"winner": winner["name"], "loser": loser["name"],
                "draw": False, "forfeit": False, "moves": moves}


# ---------------------------------------------------------------------------
# Interactive entry point
# ---------------------------------------------------------------------------

def _ttyo() -> bool:
    try:
        return sys.stdout.isatty()
    except Exception:
        return False


def _main_menu(score_tracker: ScoreTracker) -> None:
    """Top-level interactive loop."""
    while True:
        print()
        print("=" * 40)
        print("       T I C   T A C   T O E")
        print("=" * 40)
        print("  1) Human vs Human")
        print("  2) Human vs AI")
        print("  3) View Scores")
        print("  4) Reset Scores")
        print("  5) Help")
        print("  6) Quit")
        try:
            choice = input("Select an option [1-6]: ").strip()
        except EOFError:
            choice = "6"
        if choice == "1":
            _start_session(score_tracker, vs_ai=False)
        elif choice == "2":
            _start_session(score_tracker, vs_ai=True)
        elif choice == "3":
            _print_scoreboard(score_tracker)
        elif choice == "4":
            _reset_scores(score_tracker)
        elif choice == "5":
            _print_help()
        elif choice == "6":
            ok = score_tracker.save()
            if ok:
                print("Scores saved. Thanks for playing! Goodbye.")
            else:
                print("Warning: scores could not be saved. Goodbye.")
            return
        else:
            print("Invalid choice. Please select one of the listed options.")


def _print_scoreboard(score_tracker: ScoreTracker) -> None:
    records = score_tracker.all_records()
    if not records:
        print("No scores recorded yet.")
        return
    print(f"{'Player':<20} {'W':>4} {'L':>4} {'D':>4} {'P':>4}")
    print("-" * 40)
    for r in records:
        print(f"{r['display_name']:<20} {r['wins']:>4} {r['losses']:>4} "
              f"{r['draws']:>4} {r['played']:>4}")


def _reset_scores(score_tracker: ScoreTracker) -> None:
    try:
        ans = input(
            "This will permanently delete all scores. Are you sure? [y/N] "
        ).strip().lower()
    except EOFError:
        ans = ""
    if ans in ("y", "yes"):
        # backup
        try:
            if Path(score_tracker.path).exists():
                Path(str(score_tracker.path) + ".bak").write_text(
                    Path(score_tracker.path).read_text(encoding="utf-8"),
                    encoding="utf-8",
                )
        except OSError:
            pass
        score_tracker.reset()
        score_tracker.save()
        print("Scores cleared.")
    else:
        print("Reset cancelled.")


def _print_help() -> None:
    print(
        "\nTic Tac Toe — three in a row on a 3x3 grid wins.\n"
        "Cells are numbered 1..9, left-to-right, top-to-bottom:\n"
        "   1 | 2 | 3\n"
        "  ---+---+---\n"
        "   4 | 5 | 6\n"
        "  ---+---+---\n"
        "   7 | 8 | 9\n"
        "AI difficulty levels:\n"
        "  Easy   — random moves\n"
        "  Medium — blocks immediate wins, otherwise random\n"
        "  Hard   — minimax (unbeatable)\n"
        "Type 'q' at the move prompt to forfeit the round.\n"
    )
    try:
        input("Press Enter to return to the main menu...")
    except EOFError:
        pass


def _prompt_name(prompt: str, taken: Iterable[str] = ()) -> Optional[str]:
    while True:
        try:
            raw = input(prompt)
        except EOFError:
            return None
        ok, value = validate_name(raw, taken)
        if ok:
            return value
        print(value)


def _prompt_difficulty() -> Optional[str]:
    while True:
        print("Difficulty: [1] Easy   [2] Medium   [3] Hard")
        try:
            choice = input("Select difficulty [1-3]: ").strip()
        except EOFError:
            return None
        if choice == "1":
            return "easy"
        if choice == "2":
            return "medium"
        if choice == "3":
            return "hard"
        print("Invalid choice. Please select one of the listed options.")


def _start_session(score_tracker: ScoreTracker, vs_ai: bool) -> None:
    if vs_ai:
        difficulty = _prompt_difficulty()
        if difficulty is None:
            return
        print(f"Difficulty set to: {difficulty.capitalize()}")
        human_name = _prompt_name("Enter your name: ")
        if human_name is None:
            return
        ai = AI("O", difficulty)
        players = [
            {"name": human_name, "is_ai": False, "ai": None},
            {"name": ai.label,   "is_ai": True,  "ai": ai},
        ]
    else:
        p1 = _prompt_name("Enter name for Player 1: ")
        if p1 is None:
            return
        p2 = _prompt_name("Enter name for Player 2: ", taken=[p1])
        if p2 is None:
            return
        players = [
            {"name": p1, "is_ai": False, "ai": None},
            {"name": p2, "is_ai": False, "ai": None},
        ]

    starting_index = 0
    while True:
        game = Game(players, score_tracker=score_tracker)
        game.play_round(starting_index=starting_index)
        # Save after each completed round
        score_tracker.save()
        starting_index = 1 - starting_index
        try:
            ans = input("Play again? [1] Yes  [2] Main Menu  [3] Quit: ").strip()
        except EOFError:
            ans = "3"
        if ans == "1":
            continue
        if ans == "2":
            return
        if ans == "3":
            ok = score_tracker.save()
            if ok:
                print("Scores saved. Thanks for playing! Goodbye.")
            else:
                print("Warning: scores could not be saved. Goodbye.")
            sys.exit(0)
        print("Invalid choice. Returning to replay prompt.")


def main() -> None:
    score_tracker = ScoreTracker()
    score_tracker.load()  # silently ignores missing/corrupt
    try:
        _main_menu(score_tracker)
    except KeyboardInterrupt:
        score_tracker.save()
        print("\nGame interrupted. Scores saved. Goodbye.")
        sys.exit(130)


if __name__ == "__main__":
    main()
