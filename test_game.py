"""Integration tests for game.py.

Complements test_units.py by covering end-to-end flows:
  * full game flow with score updates and replay decisions,
  * edge wins (first move wins, last cell wins, alternating wins),
  * Hard-AI invariants under adversarial / exhaustive play,
  * score persistence on disk via tmp_path,
  * input validation edge cases,
  * mode-selection code paths (HvH and HvAI through _start_session/_main_menu).
"""

from __future__ import annotations

import builtins
import contextlib
import json
import random
from unittest.mock import patch

import pytest

import game as game_mod
from game import (
    AI,
    Board,
    EMPTY,
    Game,
    ScoreTracker,
    validate_name,
    WIN_LINES,
)


# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------

class ScriptedInput:
    """Callable that returns scripted answers in order."""

    def __init__(self, answers):
        self.answers = list(answers)
        self.prompts: list[str] = []

    def __call__(self, prompt=""):
        self.prompts.append(prompt)
        if not self.answers:
            raise AssertionError(
                f"ScriptedInput exhausted at prompt {prompt!r}; "
                f"prompts so far: {self.prompts}"
            )
        return self.answers.pop(0)


class CapturedOutput:
    def __init__(self):
        self.lines: list[str] = []

    def __call__(self, msg=""):
        self.lines.append(str(msg))

    @property
    def text(self) -> str:
        return "\n".join(self.lines)


def make_humans(n1="Alice", n2="Bob"):
    return [
        {"name": n1, "is_ai": False, "ai": None},
        {"name": n2, "is_ai": False, "ai": None},
    ]


def make_human_vs_ai(name="Alice", difficulty="hard", seed=None):
    rng = random.Random(seed) if seed is not None else None
    ai = AI("O", difficulty, rng=rng)
    return [
        {"name": name, "is_ai": False, "ai": None},
        {"name": ai.label, "is_ai": True, "ai": ai},
    ], ai


@contextlib.contextmanager
def patched_input(reader):
    """Patch *both* `builtins.input` AND the captured default in
    `Game.__init__`.

    `Game.__init__(input_fn=input)` resolves the default to the builtin once,
    at function-definition time. Patching `builtins.input` after the fact
    therefore does NOT affect the captured default. This helper patches the
    default tuple too so internally-constructed `Game` instances also use
    the test reader.
    """
    original_defaults = Game.__init__.__defaults__
    # Defaults: (score_tracker=None, input_fn=input, output_fn=print)
    new_defaults = (
        original_defaults[0],
        reader,
        original_defaults[2],
    )
    with patch.object(builtins, "input", reader):
        Game.__init__.__defaults__ = new_defaults
        try:
            yield
        finally:
            Game.__init__.__defaults__ = original_defaults


def _make_iter_reader(answers):
    """Make a reader callable from an iterable of scripted answers."""
    it = iter(answers)

    def reader(_prompt=""):
        try:
            return next(it)
        except StopIteration:
            raise AssertionError("Scripted input exhausted")
    return reader


# ---------------------------------------------------------------------------
# Win-condition edge cases on Board
# ---------------------------------------------------------------------------

class TestBoardWinEdges:
    """Win detection at all 8 lines exhaustively (parametrised)."""

    @pytest.mark.parametrize("line", WIN_LINES)
    @pytest.mark.parametrize("symbol", ["X", "O"])
    def test_each_winning_line_detected(self, line, symbol):
        b = Board()
        for idx in line:
            b.cells[idx] = symbol
        assert b.winner() == symbol
        assert b.winning_line() == line
        assert b.is_game_over() is True

    def test_almost_winning_not_a_winner(self):
        b = Board()
        b.cells[0] = "X"
        b.cells[1] = "X"
        # third cell empty
        assert b.winner() is None
        assert b.is_game_over() is False

    def test_mixed_line_no_winner(self):
        b = Board()
        b.cells[0] = "X"
        b.cells[1] = "O"
        b.cells[2] = "X"
        assert b.winner() is None

    def test_render_returns_three_rows_separated(self):
        out = Board().render()
        assert out.count("---+---+---") == 2  # two row separators

    def test_render_highlight_with_no_input_renders_normally(self):
        b = Board()
        b.cells[0] = "X"
        out = b.render(highlight=None)
        assert "[X]" not in out
        assert " X " in out


class TestBoardMoveEdges:
    def test_undo_move_out_of_range_silently_ignored_low(self):
        b = Board()
        b.make_move(1, "X")
        b.undo_move(0)  # out of range; should not crash, should not affect cell 1
        assert b.cells[0] == "X"

    def test_undo_move_out_of_range_silently_ignored_high(self):
        b = Board()
        b.make_move(1, "X")
        b.undo_move(10)
        assert b.cells[0] == "X"

    def test_make_move_lowercase_symbol_raises(self):
        with pytest.raises(ValueError):
            Board().make_move(1, "x")

    def test_is_valid_move_accepts_negative_returns_false(self):
        assert Board().is_valid_move(-1) is False

    def test_empty_cells_returns_zero_indexed(self):
        # Fill cells 0 (position 1) and 8 (position 9). Empty cells (0-indexed)
        # should be positions 1..7 inclusive.
        b = Board()
        b.cells[0] = "X"
        b.cells[8] = "O"
        assert b.empty_cells() == [1, 2, 3, 4, 5, 6, 7]


# ---------------------------------------------------------------------------
# Full-game flow integration
# ---------------------------------------------------------------------------

class TestFullGameFlow:
    def test_first_move_at_position_1_wins_with_top_row(self):
        inp = ScriptedInput(["1", "4", "2", "5", "3"])
        out = CapturedOutput()
        st = ScoreTracker()
        g = Game(make_humans(), score_tracker=st, input_fn=inp, output_fn=out)
        result = g.play_round()
        assert result["winner"] == "Alice"
        assert result["moves"] == 5
        # The final render call should highlight the winning row.
        assert "[X]" in out.text

    def test_last_cell_wins_round(self):
        # Sequence designed so the game runs through all 9 moves and the LAST
        # move (position 5) creates the diagonal win 1-5-9 for X.
        # Move order with X = Alice:
        #   X1  O2  X9  O4  X6  O3  X7  O8  X5 → wins diag 1-5-9.
        # Spot-check intermediate boards: no premature 3-in-a-row appears.
        inp = ScriptedInput(["1", "2", "9", "4", "6", "3", "7", "8", "5"])
        out = CapturedOutput()
        st = ScoreTracker()
        g = Game(make_humans(), score_tracker=st, input_fn=inp, output_fn=out)
        result = g.play_round()
        assert result["winner"] == "Alice"
        assert result["moves"] == 9
        assert result["draw"] is False
        assert st.get("Alice")["wins"] == 1
        assert st.get("Bob")["losses"] == 1

    def test_alternating_wins_across_replays(self):
        # Round 1: Alice (X) wins. Round 2: Bob (X) wins.
        # Round 3: Alice (X) wins. Symbols rotate via starting_index.
        inp = ScriptedInput(
            ["1", "4", "2", "5", "3"]   # round 1
            + ["1", "4", "2", "5", "3"] # round 2 (Bob is X)
            + ["1", "4", "2", "5", "3"] # round 3 (Alice X again)
        )
        out = CapturedOutput()
        st = ScoreTracker()
        g = Game(make_humans(), score_tracker=st,
                 input_fn=inp, output_fn=out)
        starting = 0
        winners = []
        for _ in range(3):
            result = g.play_round(starting_index=starting)
            winners.append(result["winner"])
            starting = 1 - starting
        assert winners == ["Alice", "Bob", "Alice"]
        assert st.get("Alice")["wins"] == 2
        assert st.get("Alice")["losses"] == 1
        assert st.get("Bob")["wins"] == 1
        assert st.get("Bob")["losses"] == 2

    def test_forfeit_then_replay_normal_round(self):
        # Alice forfeits round 1, then plays a winning round 2.
        inp = ScriptedInput(
            ["q", "y"]
            + ["1", "4", "2", "5", "3"]
        )
        st = ScoreTracker()
        g = Game(make_humans(), score_tracker=st,
                 input_fn=inp, output_fn=CapturedOutput())
        r1 = g.play_round(starting_index=0)
        r2 = g.play_round(starting_index=0)
        assert r1["forfeit"] is True
        assert r2["winner"] == "Alice"
        # Forfeits are not recorded.
        assert st.get("Alice")["wins"] == 1
        assert st.get("Bob")["losses"] == 1
        assert st.get("Alice")["draws"] == 0

    def test_round_count_played_field_after_mixed_outcomes(self):
        # 1 win + 1 draw for Alice → played=2
        inp = ScriptedInput(
            ["1", "4", "2", "5", "3"]                              # win
            + ["1", "5", "9", "4", "6", "3", "7", "8", "2"]        # draw
        )
        st = ScoreTracker()
        g = Game(make_humans(), score_tracker=st,
                 input_fn=inp, output_fn=CapturedOutput())
        g.play_round(starting_index=0)
        g.play_round(starting_index=0)
        rec_alice = next(r for r in st.all_records()
                         if r["display_name"] == "Alice")
        assert rec_alice["played"] == 2
        assert rec_alice["wins"] == 1
        assert rec_alice["draws"] == 1


# ---------------------------------------------------------------------------
# Input validation (live integration, not stubbed)
# ---------------------------------------------------------------------------

class TestInputValidationIntegration:
    def test_non_integer_input_then_negative_then_valid(self):
        inp = ScriptedInput(["abc", "-1", "1", "4", "2", "5", "3"])
        out = CapturedOutput()
        g = Game(make_humans(), input_fn=inp, output_fn=out)
        result = g.play_round()
        assert result["winner"] == "Alice"
        assert sum("Invalid input" in line for line in out.lines) >= 2

    def test_zero_position_rejected(self):
        inp = ScriptedInput(["0", "1", "4", "2", "5", "3"])
        out = CapturedOutput()
        g = Game(make_humans(), input_fn=inp, output_fn=out)
        result = g.play_round()
        assert result["winner"] == "Alice"
        assert any("Invalid input" in line for line in out.lines)

    def test_floating_point_string_rejected(self):
        inp = ScriptedInput(["1.5", "1", "4", "2", "5", "3"])
        out = CapturedOutput()
        g = Game(make_humans(), input_fn=inp, output_fn=out)
        g.play_round()
        assert any("Invalid input" in line for line in out.lines)

    def test_whitespace_only_input_rejected(self):
        inp = ScriptedInput(["   ", "1", "4", "2", "5", "3"])
        out = CapturedOutput()
        g = Game(make_humans(), input_fn=inp, output_fn=out)
        g.play_round()
        assert any("Invalid input" in line for line in out.lines)

    def test_quit_aliases_all_trigger_forfeit_prompt(self):
        for alias in ("q", "quit", "exit"):
            inp = ScriptedInput([alias, "y"])
            g = Game(make_humans(), input_fn=inp,
                     output_fn=CapturedOutput())
            res = g.play_round()
            assert res["forfeit"] is True, f"alias {alias!r} did not forfeit"

    def test_eof_during_forfeit_confirmation_forfeits(self):
        answers = ["q"]

        def reader(prompt=""):
            if answers:
                return answers.pop(0)
            raise EOFError()

        st = ScoreTracker()
        g = Game(make_humans(), score_tracker=st,
                 input_fn=reader, output_fn=CapturedOutput())
        result = g.play_round()
        assert result["forfeit"] is True
        assert st.players == {}


# ---------------------------------------------------------------------------
# Score persistence — round-trip through actual files
# ---------------------------------------------------------------------------

class TestScorePersistenceOnDisk:
    def test_save_then_load_roundtrip_on_disk(self, tmp_path):
        path = tmp_path / "scores.json"
        s1 = ScoreTracker(path=path)
        s1.record_win("Alice")
        s1.record_loss("Bob")
        s1.record_draw_pair("Alice", "Bob")
        assert s1.save() is True
        assert path.exists()

        s2 = ScoreTracker(path=path)
        assert s2.load() is True
        assert s2.get("Alice")["wins"] == 1
        assert s2.get("Alice")["draws"] == 1
        assert s2.get("Bob")["losses"] == 1
        assert s2.get("Bob")["draws"] == 1

    def test_load_after_full_game_persists_results(self, tmp_path):
        path = tmp_path / "scores.json"
        st = ScoreTracker(path=path)
        inp = ScriptedInput(["1", "4", "2", "5", "3"])
        g = Game(make_humans(), score_tracker=st,
                 input_fn=inp, output_fn=CapturedOutput())
        g.play_round()
        assert st.save() is True

        st2 = ScoreTracker(path=path)
        assert st2.load() is True
        assert st2.get("Alice")["wins"] == 1
        assert st2.get("Bob")["losses"] == 1

        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        assert data["schema_version"] == 1
        assert "alice" in data["players"]
        assert "bob" in data["players"]

    def test_load_corrupt_file_creates_bak_on_disk(self, tmp_path):
        path = tmp_path / "scores.json"
        path.write_text("not valid json at all {}{}{", encoding="utf-8")
        s = ScoreTracker(path=path)
        assert s.load() is False
        assert s.players == {}
        bak = tmp_path / "scores.json.bak"
        assert bak.exists()
        assert bak.read_text(encoding="utf-8").startswith("not valid json")

    def test_load_missing_file_starts_empty(self, tmp_path):
        path = tmp_path / "does_not_exist.json"
        s = ScoreTracker(path=path)
        assert s.load() is False
        assert s.players == {}

    def test_save_creates_human_readable_indented_json(self, tmp_path):
        path = tmp_path / "scores.json"
        s = ScoreTracker(path=path)
        s.record_win("Alice")
        s.save()
        contents = path.read_text(encoding="utf-8")
        assert "\n" in contents
        assert "  " in contents

    def test_existing_records_overwritten_on_subsequent_save(self, tmp_path):
        path = tmp_path / "scores.json"
        s1 = ScoreTracker(path=path)
        s1.record_win("Alice")
        s1.save()
        s2 = ScoreTracker(path=path)
        s2.record_loss("Alice")
        s2.save()
        s3 = ScoreTracker(path=path)
        s3.load()
        assert s3.get("Alice")["wins"] == 0
        assert s3.get("Alice")["losses"] == 1


# ---------------------------------------------------------------------------
# Hard AI never loses — adversarial property tests
# ---------------------------------------------------------------------------

def _play_to_end(human_strategy, ai, ai_first):
    """Helper: play a deterministic game between human_strategy and ai.

    Returns Board.winner() at the end (None for draw).
    """
    board = Board()
    if ai_first:
        ai.symbol = "X"
        ai.opponent = "O"
        human_sym = "O"
    else:
        ai.symbol = "O"
        ai.opponent = "X"
        human_sym = "X"
    turn_ai = ai_first
    while not board.is_game_over():
        if turn_ai:
            move = ai.get_move(board)
            board.make_move(move, ai.symbol)
        else:
            move = human_strategy(board, human_sym)
            assert board.make_move(move, human_sym), \
                f"human strategy returned illegal move {move}"
        turn_ai = not turn_ai
    return board.winner()


class TestHardAIInvariants:
    def test_hard_never_loses_against_random_many_games(self):
        for seed in range(50):
            rng = random.Random(seed)

            def random_strategy(board, _sym, _rng=rng):
                return _rng.choice(board.empty_cells()) + 1

            for ai_first in (True, False):
                ai = AI("X", "hard")
                w = _play_to_end(random_strategy, ai, ai_first)
                assert w != ("O" if ai_first else "X"), (
                    f"Hard AI lost! seed={seed}, ai_first={ai_first}"
                )

    def test_hard_never_loses_against_medium(self):
        for seed in range(20):
            rng = random.Random(seed)
            medium = AI("X", "medium", rng=rng)

            def medium_strategy(board, sym, _m=medium):
                _m.symbol = sym
                _m.opponent = "O" if sym == "X" else "X"
                return _m.get_move(board)

            for ai_first in (True, False):
                hard = AI("X", "hard")
                w = _play_to_end(medium_strategy, hard, ai_first)
                assert w != ("O" if ai_first else "X"), (
                    f"Hard AI lost to Medium! seed={seed}, ai_first={ai_first}"
                )

    def test_hard_never_loses_against_first_two_ply_exhaustive(self):
        # Exhaustive: human plays any opening + any second move (when possible);
        # then random for the rest. Hard must never lose.
        rng = random.Random(0)
        for opening in range(1, 10):
            for second in range(1, 10):
                if second == opening:
                    continue
                board = Board()
                ai = AI("O", "hard")
                board.make_move(opening, "X")
                ai_move_1 = ai.get_move(board)
                board.make_move(ai_move_1, "O")
                if not board.is_valid_move(second):
                    second_actual = board.empty_cells()[0] + 1
                else:
                    second_actual = second
                board.make_move(second_actual, "X")
                turn_ai = True
                while not board.is_game_over():
                    if turn_ai:
                        m = ai.get_move(board)
                        board.make_move(m, "O")
                    else:
                        m = rng.choice(board.empty_cells()) + 1
                        board.make_move(m, "X")
                    turn_ai = not turn_ai
                assert board.winner() != "X", (
                    f"Hard AI lost! opening={opening}, second={second}"
                )

    def test_hard_vs_hard_swap_symbols_still_draws(self):
        for first_x in (True, False):
            board = Board()
            x = AI("X", "hard")
            o = AI("O", "hard")
            current = x if first_x else o
            while not board.is_game_over():
                m = current.get_move(board)
                board.make_move(m, current.symbol)
                current = o if current is x else x
            assert board.winner() is None


# ---------------------------------------------------------------------------
# Game vs. Hard AI — full integration
# ---------------------------------------------------------------------------

class TestGameVsHardAIIntegration:
    def test_game_with_hard_ai_human_cannot_win_via_naive_play(self):
        # Naïve human: plays 5 first if free, else lowest empty cell.
        ai = AI("O", "hard")

        def naive_strategy(board, sym):
            empties = board.empty_cells()
            if 4 in empties:
                return 5
            return empties[0] + 1

        winner = _play_to_end(naive_strategy, ai, ai_first=False)
        assert winner != "X"

    def test_game_records_ai_win_to_score_tracker(self):
        # Use a stub AI with a deterministic move queue.
        class StubAI(AI):
            def __init__(self):
                super().__init__("O", "easy", rng=random.Random(0))
                self.move_queue = []

            def get_move(self, board):
                return self.move_queue.pop(0)

        st = ScoreTracker()
        ai = StubAI()
        players = [
            {"name": "Alice", "is_ai": False, "ai": None},
            {"name": ai.label, "is_ai": True, "ai": ai},
        ]
        # Alice X 4, AI O 1, Alice X 7, AI O 2, Alice X 9, AI O 3 → AI wins row 1.
        ai.move_queue = [1, 2, 3]
        inp = ScriptedInput(["4", "7", "9"])
        g = Game(players, score_tracker=st, input_fn=inp,
                 output_fn=CapturedOutput())
        result = g.play_round(starting_index=0)
        assert result["winner"] == ai.label
        assert result["loser"] == "Alice"
        assert st.get(ai.label)["wins"] == 1
        assert st.get("Alice")["losses"] == 1


# ---------------------------------------------------------------------------
# AI helper / internals
# ---------------------------------------------------------------------------

class TestAIInternal:
    def test_find_immediate_win_does_not_mutate(self):
        b = Board()
        b.cells[0] = "X"
        b.cells[1] = "X"
        snapshot = list(b.cells)
        ai = AI("X", "medium")
        win = ai._find_immediate_win(b, "X")
        assert win == 3
        assert b.cells == snapshot

    def test_find_immediate_win_returns_none_when_unavailable(self):
        ai = AI("X", "medium")
        b = Board()
        assert ai._find_immediate_win(b, "X") is None

    def test_ai_symbol_resync_when_round_starts_second(self):
        # AI built with "O" but slot is X (starting_index=1). _get_ai_move
        # must resync. We assert by playing one AI move then forfeiting.
        ai = AI("O", "easy", rng=random.Random(1))
        players = [
            {"name": "Alice", "is_ai": False, "ai": None},
            {"name": ai.label, "is_ai": True, "ai": ai},
        ]
        # Order with starting_index=1: second player (AI) plays X first.
        inp = ScriptedInput(["q", "y"])
        g = Game(players, input_fn=inp, output_fn=CapturedOutput())
        g.play_round(starting_index=1)
        assert ai.symbol == "X"
        assert ai.opponent == "O"


# ---------------------------------------------------------------------------
# validate_name additional coverage
# ---------------------------------------------------------------------------

class TestValidateNameExtras:
    def test_accepts_max_length_20(self):
        ok, val = validate_name("A" * 20)
        assert ok is True and val == "A" * 20

    def test_rejects_special_punctuation(self):
        for bad in ("Alice@", "Bob.", "Eve;", "Mallory#"):
            ok, _ = validate_name(bad)
            assert ok is False, f"Unexpected acceptance of {bad!r}"

    def test_accepts_digits_only(self):
        ok, val = validate_name("12345")
        assert ok is True and val == "12345"

    def test_taken_collection_strips_whitespace(self):
        ok, _ = validate_name("Alice", taken=["  alice  "])
        assert ok is False

    def test_unicode_letters_rejected(self):
        # NAME_PATTERN is ASCII-only.
        ok, _ = validate_name("Æli")
        assert ok is False

    def test_tabs_inside_name_rejected(self):
        ok, _ = validate_name("A\tB")
        assert ok is False


# ---------------------------------------------------------------------------
# Mode selection / interactive entry points
# ---------------------------------------------------------------------------

class TestInteractiveDispatch:
    def test_main_menu_view_scores_then_quit(self, tmp_path, capsys):
        st = ScoreTracker(path=tmp_path / "scores.json")
        reader = _make_iter_reader(["3", "6"])
        with patched_input(reader):
            game_mod._main_menu(st)
        captured = capsys.readouterr().out
        assert "No scores recorded" in captured
        assert "Goodbye" in captured

    def test_main_menu_help_screen_returns_to_menu(self, tmp_path, capsys):
        st = ScoreTracker(path=tmp_path / "scores.json")
        reader = _make_iter_reader(["5", "", "6"])
        with patched_input(reader):
            game_mod._main_menu(st)
        captured = capsys.readouterr().out
        assert "AI difficulty levels" in captured

    def test_main_menu_invalid_choice_reprompts(self, tmp_path, capsys):
        st = ScoreTracker(path=tmp_path / "scores.json")
        reader = _make_iter_reader(["banana", "6"])
        with patched_input(reader):
            game_mod._main_menu(st)
        captured = capsys.readouterr().out
        assert "Invalid choice" in captured

    def test_main_menu_eof_quits_cleanly(self, tmp_path, capsys):
        st = ScoreTracker(path=tmp_path / "scores.json")

        def eof_input(_=""):
            raise EOFError()

        with patched_input(eof_input):
            game_mod._main_menu(st)
        captured = capsys.readouterr().out
        assert "Goodbye" in captured

    def test_main_menu_reset_scores_confirmed(self, tmp_path, capsys):
        path = tmp_path / "scores.json"
        st = ScoreTracker(path=path)
        st.record_win("Alice")
        st.save()
        reader = _make_iter_reader(["4", "y", "6"])
        with patched_input(reader):
            game_mod._main_menu(st)
        captured = capsys.readouterr().out
        assert "Scores cleared" in captured
        assert st.players == {}
        assert (tmp_path / "scores.json.bak").exists()

    def test_main_menu_reset_scores_cancelled(self, tmp_path, capsys):
        st = ScoreTracker(path=tmp_path / "scores.json")
        st.record_win("Alice")
        reader = _make_iter_reader(["4", "n", "6"])
        with patched_input(reader):
            game_mod._main_menu(st)
        captured = capsys.readouterr().out
        assert "Reset cancelled" in captured
        assert st.get("Alice")["wins"] == 1

    def test_print_scoreboard_with_records(self, capsys):
        st = ScoreTracker()
        st.record_win("Alice")
        st.record_loss("Bob")
        game_mod._print_scoreboard(st)
        out = capsys.readouterr().out
        assert "Alice" in out and "Bob" in out
        # Header present (single 'W', 'L', 'D', 'P' tokens + 'Player').
        assert "Player" in out
        for token in ("W", "L", "D", "P"):
            assert token in out

    def test_print_scoreboard_empty(self, capsys):
        st = ScoreTracker()
        game_mod._print_scoreboard(st)
        out = capsys.readouterr().out
        assert "No scores recorded" in out

    def test_prompt_difficulty_each_choice(self):
        for choice, expected in [("1", "easy"), ("2", "medium"), ("3", "hard")]:
            reader = _make_iter_reader([choice])
            with patched_input(reader):
                assert game_mod._prompt_difficulty() == expected

    def test_prompt_difficulty_invalid_then_valid(self, capsys):
        reader = _make_iter_reader(["banana", "2"])
        with patched_input(reader):
            assert game_mod._prompt_difficulty() == "medium"
        out = capsys.readouterr().out
        assert "Invalid choice" in out

    def test_prompt_difficulty_eof_returns_none(self):
        def eof_input(_=""):
            raise EOFError()

        with patched_input(eof_input):
            assert game_mod._prompt_difficulty() is None

    def test_prompt_name_invalid_then_valid(self, capsys):
        reader = _make_iter_reader(["AI", "Alice"])
        with patched_input(reader):
            assert game_mod._prompt_name("Name? ") == "Alice"
        out = capsys.readouterr().out
        assert "reserved" in out.lower()

    def test_prompt_name_eof_returns_none(self):
        def eof_input(_=""):
            raise EOFError()

        with patched_input(eof_input):
            assert game_mod._prompt_name("Name? ") is None

    def test_start_session_hvh_full_round_then_main_menu(self, tmp_path):
        # Full HvH session: enter Alice, Bob, play one Alice-winning round,
        # then choose '2' (Main Menu) to return.
        st = ScoreTracker(path=tmp_path / "scores.json")
        reader = _make_iter_reader([
            "Alice", "Bob",
            "1", "4", "2", "5", "3",
            "2",
        ])
        with patched_input(reader):
            game_mod._start_session(st, vs_ai=False)
        assert st.get("Alice")["wins"] == 1
        assert st.get("Bob")["losses"] == 1
        assert (tmp_path / "scores.json").exists()

    def test_start_session_hvai_easy_session_records_outcome(self, tmp_path,
                                                              monkeypatch):
        # Drive an Easy-AI session. To make it fully deterministic, monkeypatch
        # AI.get_move so the AI always plays the highest free cell (it never
        # picks a number Alice will play), guaranteeing Alice wins via top row.
        st = ScoreTracker(path=tmp_path / "scores.json")

        def fake_get_move(self, board):
            # Always grab the highest empty cell; Alice plays the lowest.
            empties = board.empty_cells()
            return empties[-1] + 1

        monkeypatch.setattr(AI, "get_move", fake_get_move)

        # 1 = easy difficulty; Alice plays 1, 2, 3 to win top row in 5 plies.
        # AI replies will be 9, 8 (highest empty cells). Then "2" returns to menu.
        reader = _make_iter_reader([
            "1", "Alice",
            "1", "2", "3",
            "2",
        ])
        with patched_input(reader):
            game_mod._start_session(st, vs_ai=True)
        assert st.get("Alice")["wins"] == 1
        # The AI label should be one of the keys recorded.
        keys = list(st.players.keys())
        assert any(k.startswith("ai (") for k in keys), keys

    def test_start_session_hvh_quit_choice_calls_sys_exit(self, tmp_path):
        st = ScoreTracker(path=tmp_path / "scores.json")
        reader = _make_iter_reader([
            "Alice", "Bob",
            "1", "4", "2", "5", "3",
            "3",  # quit
        ])
        with patched_input(reader):
            with pytest.raises(SystemExit) as exc:
                game_mod._start_session(st, vs_ai=False)
        assert exc.value.code == 0

    def test_start_session_replay_invalid_then_main_menu(self, tmp_path, capsys):
        # An invalid replay answer makes the loop fall through to play yet
        # another round, so we must script a second complete round and then
        # finally choose the main-menu option.
        st = ScoreTracker(path=tmp_path / "scores.json")
        reader = _make_iter_reader([
            "Alice", "Bob",
            "1", "4", "2", "5", "3",  # round 1 (Alice wins)
            "banana",                     # invalid replay choice → another round
            "1", "4", "2", "5", "3",  # round 2 (Bob is X this time, wins)
            "2",                          # main menu
        ])
        with patched_input(reader):
            game_mod._start_session(st, vs_ai=False)
        out = capsys.readouterr().out
        assert "Invalid choice" in out

    def test_start_session_hvai_eof_at_difficulty_returns_silently(self, tmp_path):
        st = ScoreTracker(path=tmp_path / "scores.json")

        def eof_input(_=""):
            raise EOFError()

        with patched_input(eof_input):
            game_mod._start_session(st, vs_ai=True)

    def test_start_session_hvh_eof_at_first_name_returns(self, tmp_path):
        st = ScoreTracker(path=tmp_path / "scores.json")

        def eof_input(_=""):
            raise EOFError()

        with patched_input(eof_input):
            game_mod._start_session(st, vs_ai=False)

    def test_start_session_two_rounds_then_main_menu(self, tmp_path):
        # Replay path: choose '1' (yes) after round 1 → play another round,
        # then return to main menu.
        st = ScoreTracker(path=tmp_path / "scores.json")
        reader = _make_iter_reader([
            "Alice", "Bob",
            "1", "4", "2", "5", "3",  # Alice wins
            "1",                        # play again (yes)
            "1", "4", "2", "5", "3",  # this round Bob is X (rotated) — Bob wins
            "2",                        # main menu
        ])
        with patched_input(reader):
            game_mod._start_session(st, vs_ai=False)
        assert st.get("Alice")["wins"] == 1
        assert st.get("Alice")["losses"] == 1
        assert st.get("Bob")["wins"] == 1
        assert st.get("Bob")["losses"] == 1


# ---------------------------------------------------------------------------
# main() top-level entry point
# ---------------------------------------------------------------------------

class TestMainEntryPoint:
    def test_main_loads_existing_scores_and_quits(self, tmp_path, capsys, monkeypatch):
        scores_path = tmp_path / "scores.json"
        st_temp = ScoreTracker(path=scores_path)
        st_temp.record_win("Alice")
        st_temp.save()

        monkeypatch.setattr(ScoreTracker, "DEFAULT_PATH", scores_path)
        reader = _make_iter_reader(["3", "6"])  # view scores then quit
        with patched_input(reader):
            game_mod.main()
        out = capsys.readouterr().out
        assert "Alice" in out
        assert "Goodbye" in out

    def test_main_handles_keyboard_interrupt(self, tmp_path, monkeypatch, capsys):
        monkeypatch.setattr(
            ScoreTracker, "DEFAULT_PATH", tmp_path / "scores.json"
        )

        def raise_kbi(_st):
            raise KeyboardInterrupt()

        monkeypatch.setattr(game_mod, "_main_menu", raise_kbi)
        with pytest.raises(SystemExit) as exc:
            game_mod.main()
        assert exc.value.code == 130
        out = capsys.readouterr().out
        assert "interrupted" in out.lower()
