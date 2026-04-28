"""Unit tests for game.py — Board, AI, ScoreTracker, Game."""

from __future__ import annotations

import json
from pathlib import Path
import random
from unittest.mock import mock_open, patch

import pytest

from game import EMPTY, AI, Board


# Known non-winning full board:
#  X | O | X
#  X | X | O
#  O | X | O
DRAW_CELLS = ["X", "O", "X",
              "X", "X", "O",
              "O", "X", "O"]


# ---------------------------------------------------------------------------
# Board
# ---------------------------------------------------------------------------

class TestBoardInit:
    def test_new_board_is_empty(self):
        b = Board()
        assert b.cells == [EMPTY] * 9
        assert b.empty_cells() == list(range(9))

    def test_new_board_has_no_winner(self):
        assert Board().winner() is None

    def test_new_board_not_full(self):
        assert Board().is_full() is False

    def test_new_board_not_draw(self):
        assert Board().is_draw() is False


class TestBoardMoves:
    def test_valid_move_in_empty_cell_succeeds(self):
        b = Board()
        assert b.make_move(1, "X") is True
        assert b.cells[0] == "X"

    def test_move_on_occupied_cell_fails(self):
        b = Board()
        b.make_move(5, "X")
        assert b.make_move(5, "O") is False
        assert b.cells[4] == "X"

    def test_move_out_of_range_low_fails(self):
        b = Board()
        assert b.make_move(0, "X") is False

    def test_move_out_of_range_high_fails(self):
        b = Board()
        assert b.make_move(10, "X") is False

    def test_invalid_symbol_raises(self):
        b = Board()
        with pytest.raises(ValueError):
            b.make_move(1, "Z")

    def test_is_valid_move_rejects_non_int(self):
        b = Board()
        assert b.is_valid_move("1") is False  # type: ignore[arg-type]

    def test_is_valid_move_true_for_empty(self):
        b = Board()
        assert b.is_valid_move(3) is True

    def test_is_valid_move_false_for_taken(self):
        b = Board()
        b.make_move(3, "X")
        assert b.is_valid_move(3) is False


class TestBoardFullAndDraw:
    def test_full_board_is_full(self):
        b = Board()
        b.cells = list(DRAW_CELLS)
        assert b.is_full() is True
        assert b.winner() is None
        assert b.is_draw() is True

    def test_partially_filled_not_full(self):
        b = Board()
        b.make_move(1, "X")
        assert b.is_full() is False

    def test_empty_cells_decreases_after_move(self):
        b = Board()
        b.make_move(1, "X")
        assert 0 not in b.empty_cells()
        assert len(b.empty_cells()) == 8

    def test_full_board_with_winner_is_not_draw(self):
        b = Board()
        b.cells = ["X", "X", "X",
                   "O", "O", "X",
                   "X", "X", "O"]
        assert b.is_full() is True
        assert b.winner() == "X"
        assert b.is_draw() is False


class TestBoardWinDetection:
    @pytest.mark.parametrize("positions", [
        (1, 2, 3),
        (4, 5, 6),
        (7, 8, 9),
    ])
    def test_row_wins(self, positions):
        b = Board()
        for p in positions:
            b.cells[p - 1] = "X"
        assert b.winner() == "X"

    @pytest.mark.parametrize("positions", [
        (1, 4, 7),
        (2, 5, 8),
        (3, 6, 9),
    ])
    def test_column_wins(self, positions):
        b = Board()
        for p in positions:
            b.cells[p - 1] = "O"
        assert b.winner() == "O"

    def test_main_diagonal_win(self):
        b = Board()
        for p in (1, 5, 9):
            b.cells[p - 1] = "X"
        assert b.winner() == "X"

    def test_anti_diagonal_win(self):
        b = Board()
        for p in (3, 5, 7):
            b.cells[p - 1] = "O"
        assert b.winner() == "O"

    def test_winning_line_returned(self):
        b = Board()
        for p in (1, 2, 3):
            b.cells[p - 1] = "X"
        assert b.winning_line() == (0, 1, 2)

    def test_no_winner_returns_none(self):
        b = Board()
        b.cells = list(DRAW_CELLS)
        assert b.winning_line() is None


class TestBoardReset:
    def test_reset_clears_all_cells(self):
        b = Board()
        b.make_move(1, "X")
        b.make_move(5, "O")
        b.reset()
        assert b.cells == [EMPTY] * 9
        assert b.empty_cells() == list(range(9))

    def test_undo_move_clears_cell(self):
        b = Board()
        b.make_move(1, "X")
        b.undo_move(1)
        assert b.cells[0] == EMPTY


class TestBoardRender:
    def test_render_shows_position_legend_when_empty(self):
        b = Board()
        out = b.render()
        for n in range(1, 10):
            assert str(n) in out

    def test_render_shows_symbols(self):
        b = Board()
        b.make_move(1, "X")
        b.make_move(5, "O")
        out = b.render()
        assert "X" in out and "O" in out

    def test_render_highlight_wraps_cells(self):
        b = Board()
        for p in (1, 2, 3):
            b.cells[p - 1] = "X"
        out = b.render(highlight=(0, 1, 2))
        assert "[X]" in out


# ---------------------------------------------------------------------------
# AI
# ---------------------------------------------------------------------------

class TestAIConstruction:
    def test_default_difficulty_is_hard(self):
        ai = AI("X")
        assert ai.difficulty == "hard"

    def test_invalid_symbol_raises(self):
        with pytest.raises(ValueError):
            AI("Z")

    def test_invalid_difficulty_raises(self):
        with pytest.raises(ValueError):
            AI("X", "impossible")

    def test_opponent_symbol_is_inverse(self):
        assert AI("X").opponent == "O"
        assert AI("O").opponent == "X"

    def test_label_uses_difficulty(self):
        assert AI("O", "easy").label == "AI (Easy)"
        assert AI("O", "medium").label == "AI (Medium)"
        assert AI("O", "hard").label == "AI (Hard)"

    def test_get_move_on_full_board_raises(self):
        b = Board()
        b.cells = list(DRAW_CELLS)
        with pytest.raises(ValueError):
            AI("X", "easy").get_move(b)


class TestAIEasy:
    def test_easy_returns_legal_move_on_empty_board(self):
        ai = AI("X", "easy", rng=random.Random(0))
        b = Board()
        move = ai.get_move(b)
        assert 1 <= move <= 9
        assert b.is_valid_move(move)

    def test_easy_never_picks_occupied_cell(self):
        # Property-style: across many seeds the move is always legal.
        b = Board()
        # Fill cells 1..8 leaving only 9.
        for i, sym in enumerate(["X", "O", "X", "O", "X", "O", "X", "O"]):
            b.cells[i] = sym
        for seed in range(50):
            ai = AI("X", "easy", rng=random.Random(seed))
            assert ai.get_move(b) == 9

    def test_easy_does_not_mutate_board(self):
        b = Board()
        b.cells[0] = "X"
        snapshot = list(b.cells)
        ai = AI("O", "easy", rng=random.Random(42))
        ai.get_move(b)
        assert b.cells == snapshot

    def test_easy_distribution_uses_rng(self):
        # Two different seeds should be able to pick different cells.
        b = Board()
        results = set()
        for seed in range(20):
            ai = AI("X", "easy", rng=random.Random(seed))
            results.add(ai.get_move(b))
        assert len(results) > 1


class TestAIMedium:
    def test_medium_takes_immediate_win(self):
        # X has two-in-a-row at top; AI is X and should complete the row.
        b = Board()
        b.cells[0] = "X"
        b.cells[1] = "X"
        b.cells[3] = "O"
        ai = AI("X", "medium", rng=random.Random(0))
        assert ai.get_move(b) == 3  # cell index 2 -> position 3

    def test_medium_blocks_opponent_immediate_win(self):
        # O has two-in-a-row at top; AI is X and must block at position 3.
        b = Board()
        b.cells[0] = "O"
        b.cells[1] = "O"
        b.cells[4] = "X"
        ai = AI("X", "medium", rng=random.Random(0))
        assert ai.get_move(b) == 3

    def test_medium_blocks_diagonal_threat(self):
        # O on cells 1 and 5 (diagonal); block by playing 9.
        b = Board()
        b.cells[0] = "O"
        b.cells[4] = "O"
        b.cells[1] = "X"
        ai = AI("X", "medium", rng=random.Random(0))
        assert ai.get_move(b) == 9

    def test_medium_blocks_column_threat(self):
        # O on cells 1 and 4 (column 1); block at 7.
        b = Board()
        b.cells[0] = "O"
        b.cells[3] = "O"
        b.cells[1] = "X"
        ai = AI("X", "medium", rng=random.Random(0))
        assert ai.get_move(b) == 7

    def test_medium_falls_back_to_random(self):
        # No immediate wins or blocks anywhere — must still pick a legal cell.
        b = Board()
        ai = AI("X", "medium", rng=random.Random(0))
        move = ai.get_move(b)
        assert 1 <= move <= 9 and b.is_valid_move(move)

    def test_medium_prefers_win_over_block(self):
        # AI X has a winning move at position 3; opponent O also threatens
        # at column (cells 4 & 7 → would win at 1). AI should WIN, not block.
        b = Board()
        b.cells[0] = "X"
        b.cells[1] = "X"  # X X _  — win at 3
        b.cells[3] = "O"  # O
        b.cells[6] = "O"  # column threat at 1
        ai = AI("X", "medium", rng=random.Random(0))
        assert ai.get_move(b) == 3

    def test_medium_does_not_mutate_board(self):
        b = Board()
        b.cells[0] = "O"
        b.cells[1] = "O"
        snapshot = list(b.cells)
        ai = AI("X", "medium", rng=random.Random(0))
        ai.get_move(b)
        assert b.cells == snapshot


class TestAIHard:
    def test_hard_takes_immediate_win(self):
        # X to move and complete top row.
        b = Board()
        b.cells[0] = "X"
        b.cells[1] = "X"
        b.cells[3] = "O"
        b.cells[4] = "O"
        ai = AI("X", "hard")
        assert ai.get_move(b) == 3

    def test_hard_blocks_opponent_immediate_win(self):
        # O threatens to win at position 3; hard AI must block.
        b = Board()
        b.cells[0] = "O"
        b.cells[1] = "O"
        b.cells[4] = "X"
        ai = AI("X", "hard")
        assert ai.get_move(b) == 3

    def test_hard_does_not_mutate_board(self):
        b = Board()
        b.cells[0] = "X"
        b.cells[4] = "O"
        snapshot = list(b.cells)
        AI("X", "hard").get_move(b)
        assert b.cells == snapshot

    def test_hard_returns_legal_move(self):
        b = Board()
        move = AI("X", "hard").get_move(b)
        assert 1 <= move <= 9 and b.is_valid_move(move)

    @staticmethod
    def _play_random_vs_hard(seed: int, hard_first: bool) -> str:
        """Play one game between Hard AI and a random opponent.

        Returns 'hard', 'random', or 'draw'.
        """
        rng = random.Random(seed)
        board = Board()
        if hard_first:
            hard = AI("X", "hard")
            rand_ai = AI("O", "easy", rng=rng)
            current = hard
        else:
            rand_ai = AI("X", "easy", rng=rng)
            hard = AI("O", "hard")
            current = rand_ai
        while not board.is_game_over():
            move = current.get_move(board)
            board.make_move(move, current.symbol)
            current = hard if current is rand_ai else rand_ai
        w = board.winner()
        if w is None:
            return "draw"
        return "hard" if w == hard.symbol else "random"

    def test_hard_never_loses_to_random(self):
        # Property: Hard AI must never lose to a random opponent over
        # many seeds, whether playing first or second.
        for seed in range(30):
            for hard_first in (True, False):
                result = self._play_random_vs_hard(seed, hard_first)
                assert result != "random", (
                    f"Hard AI lost to random (seed={seed}, hard_first={hard_first})"
                )

    def test_hard_vs_hard_is_draw(self):
        # Two Hard AIs must always draw.
        board = Board()
        x = AI("X", "hard")
        o = AI("O", "hard")
        current = x
        while not board.is_game_over():
            move = current.get_move(board)
            board.make_move(move, current.symbol)
            current = o if current is x else x
        assert board.winner() is None
        assert board.is_draw()

    def test_hard_picks_fastest_win(self):
        # Position where the AI has multiple winning moves; depth-aware
        # scoring must pick the immediately-winning one rather than any
        # equally-evaluating but slower path.
        b = Board()
        # X X _    AI is X — must play 3 to win immediately.
        # O _ _
        # O _ _
        b.cells[0] = "X"
        b.cells[1] = "X"
        b.cells[3] = "O"
        b.cells[6] = "O"
        ai = AI("X", "hard")
        assert ai.get_move(b) == 3


# ---------------------------------------------------------------------------
# ScoreTracker
# ---------------------------------------------------------------------------

from game import ScoreTracker  # noqa: E402  (placed here for test grouping)


class TestScoreTrackerInit:
    def test_starts_empty(self):
        s = ScoreTracker()
        assert s.players == {}
        assert s.all_records() == []


class TestScoreTrackerIncrement:
    def test_record_win_increments(self):
        s = ScoreTracker()
        s.record_win("Alice")
        assert s.get("Alice")["wins"] == 1
        assert s.get("Alice")["losses"] == 0
        assert s.get("Alice")["draws"] == 0

    def test_record_loss_increments(self):
        s = ScoreTracker()
        s.record_loss("Bob")
        assert s.get("Bob")["losses"] == 1

    def test_record_draw_increments(self):
        s = ScoreTracker()
        s.record_draw("Carol")
        assert s.get("Carol")["draws"] == 1

    def test_lookup_is_case_insensitive(self):
        s = ScoreTracker()
        s.record_win("Alice")
        s.record_win("alice")
        s.record_win("ALICE")
        assert s.get("ALice")["wins"] == 3
        # only one record created, keyed lowercase
        assert list(s.players.keys()) == ["alice"]

    def test_display_name_preserves_first_casing(self):
        s = ScoreTracker()
        s.record_win("Alice")
        s.record_loss("alice")
        assert s.get("alice")["display_name"] == "Alice"

    def test_record_result_updates_winner_and_loser(self):
        s = ScoreTracker()
        s.record_result("Alice", "Bob")
        assert s.get("Alice")["wins"] == 1
        assert s.get("Bob")["losses"] == 1

    def test_record_draw_pair_updates_both(self):
        s = ScoreTracker()
        s.record_draw_pair("Alice", "Bob")
        assert s.get("Alice")["draws"] == 1
        assert s.get("Bob")["draws"] == 1

    def test_record_draw_pair_same_player_only_counts_once(self):
        s = ScoreTracker()
        s.record_draw_pair("Alice", "alice")
        assert s.get("Alice")["draws"] == 1

    def test_empty_name_rejected(self):
        s = ScoreTracker()
        with pytest.raises(ValueError):
            s.record_win("   ")
        with pytest.raises(ValueError):
            s.record_win("")

    def test_reset_clears_all(self):
        s = ScoreTracker()
        s.record_win("Alice")
        s.record_loss("Bob")
        s.reset()
        assert s.players == {}


class TestScoreTrackerSorting:
    def test_records_sorted_by_wins_then_losses_then_name(self):
        s = ScoreTracker()
        s.record_win("Bob")
        s.record_win("Alice")
        s.record_win("Alice")
        s.record_loss("Alice")
        s.record_win("Carol")
        s.record_win("Carol")
        records = s.all_records()
        # Alice (2W,1L), Carol (2W,0L), Bob (1W,0L)
        # Sort: -wins asc, losses asc, name asc
        # Carol(2W,0L) before Alice(2W,1L); then Bob(1W).
        names = [r["display_name"] for r in records]
        assert names == ["Carol", "Alice", "Bob"]

    def test_played_field_is_sum(self):
        s = ScoreTracker()
        s.record_win("Alice")
        s.record_loss("Alice")
        s.record_draw("Alice")
        recs = s.all_records()
        assert recs[0]["played"] == 3


class TestScoreTrackerPersistence:
    def test_save_writes_json_via_open(self):
        s = ScoreTracker(path="dummy.json")
        s.record_win("Alice")
        s.record_loss("Bob")
        m = mock_open()
        with patch("builtins.open", m):
            assert s.save() is True
        m.assert_called_once_with(Path("dummy.json"), "w", encoding="utf-8")
        # Reconstruct what was written
        handle = m()
        written = "".join(call.args[0] for call in handle.write.call_args_list)
        data = json.loads(written)
        assert data["schema_version"] == 1
        assert data["players"]["alice"]["wins"] == 1
        assert data["players"]["bob"]["losses"] == 1
        assert data["players"]["alice"]["display_name"] == "Alice"

    def test_save_returns_false_on_oserror(self):
        s = ScoreTracker(path="dummy.json")
        s.record_win("Alice")
        with patch("builtins.open", side_effect=PermissionError("denied")):
            assert s.save() is False

    def test_load_missing_file_returns_false(self):
        s = ScoreTracker(path="dummy.json")
        with patch("builtins.open", side_effect=FileNotFoundError()):
            assert s.load() is False
        assert s.players == {}

    def test_round_trip_save_then_load_preserves_data(self):
        # Build a populated tracker, save into a captured buffer, then
        # load from that same buffer into a fresh tracker.
        s1 = ScoreTracker(path="dummy.json")
        s1.record_win("Alice")
        s1.record_win("Alice")
        s1.record_loss("Bob")
        s1.record_draw_pair("Alice", "Bob")

        m_save = mock_open()
        with patch("builtins.open", m_save):
            assert s1.save() is True
        written = "".join(c.args[0] for c in m_save().write.call_args_list)

        s2 = ScoreTracker(path="dummy.json")
        with patch("builtins.open", mock_open(read_data=written)):
            assert s2.load() is True
        assert s2.get("Alice")["wins"] == 2
        assert s2.get("Alice")["draws"] == 1
        assert s2.get("Bob")["losses"] == 1
        assert s2.get("Bob")["draws"] == 1
        assert s2.get("alice")["display_name"] == "Alice"

    def test_load_corrupt_json_starts_empty_and_writes_bak(self):
        s = ScoreTracker(path="dummy.json")
        # First open() reads corrupt content; second open() is the .bak write.
        reads = mock_open(read_data="this is not json {{{").return_value
        writes = mock_open().return_value
        opens = [reads, writes]

        def fake_open(*args, **kwargs):
            return opens.pop(0)

        with patch("builtins.open", side_effect=fake_open):
            assert s.load() is False
        assert s.players == {}

    def test_load_rejects_unknown_schema_version(self):
        s = ScoreTracker(path="dummy.json")
        bad = json.dumps({"schema_version": 999, "players": {}})
        # need two opens: read corrupt, write .bak
        read_handle = mock_open(read_data=bad).return_value
        write_handle = mock_open().return_value
        handles = [read_handle, write_handle]
        with patch("builtins.open", side_effect=lambda *a, **k: handles.pop(0)):
            assert s.load() is False
        assert s.players == {}

    def test_load_rejects_negative_counters(self):
        s = ScoreTracker(path="dummy.json")
        bad = json.dumps({
            "schema_version": 1,
            "players": {"alice": {"display_name": "Alice",
                                   "wins": -1, "losses": 0, "draws": 0}}
        })
        read_handle = mock_open(read_data=bad).return_value
        write_handle = mock_open().return_value
        handles = [read_handle, write_handle]
        with patch("builtins.open", side_effect=lambda *a, **k: handles.pop(0)):
            assert s.load() is False
        assert s.players == {}

    def test_load_valid_data_populates_records(self):
        s = ScoreTracker(path="dummy.json")
        good = json.dumps({
            "schema_version": 1,
            "players": {
                "alice": {"display_name": "Alice", "wins": 3, "losses": 1, "draws": 2},
            }
        })
        with patch("builtins.open", mock_open(read_data=good)):
            assert s.load() is True
        assert s.get("Alice")["wins"] == 3
        assert s.get("Alice")["losses"] == 1
        assert s.get("Alice")["draws"] == 2


# ---------------------------------------------------------------------------
# Game (with injected I/O) and validate_name
# ---------------------------------------------------------------------------

from game import Game, validate_name  # noqa: E402


class _ScriptedInput:
    """Pop scripted answers from a queue. Raises if exhausted."""
    def __init__(self, answers):
        self.answers = list(answers)
        self.prompts: list[str] = []

    def __call__(self, prompt=""):
        self.prompts.append(prompt)
        if not self.answers:
            raise AssertionError(f"No scripted answer for prompt: {prompt!r}")
        return self.answers.pop(0)


class _CapturedOutput:
    def __init__(self):
        self.lines: list[str] = []

    def __call__(self, msg=""):
        self.lines.append(str(msg))

    def joined(self) -> str:
        return "\n".join(self.lines)


def make_human_pair():
    return [
        {"name": "Alice", "is_ai": False, "ai": None},
        {"name": "Bob",   "is_ai": False, "ai": None},
    ]


def make_human_vs_ai(difficulty="hard"):
    ai = AI("O", difficulty)
    return [
        {"name": "Alice", "is_ai": False, "ai": None},
        {"name": ai.label, "is_ai": True, "ai": ai},
    ]


class TestValidateName:
    def test_accepts_simple_name(self):
        ok, val = validate_name("Alice")
        assert ok and val == "Alice"

    def test_strips_whitespace(self):
        ok, val = validate_name("  Bob  ")
        assert ok and val == "Bob"

    def test_rejects_empty(self):
        ok, _ = validate_name("   ")
        assert ok is False

    def test_rejects_too_long(self):
        ok, _ = validate_name("a" * 21)
        assert ok is False

    def test_rejects_bad_chars(self):
        ok, _ = validate_name("Alice!")
        assert ok is False

    def test_accepts_hyphen_and_underscore(self):
        ok, _ = validate_name("Mary-Jo_2")
        assert ok is True

    @pytest.mark.parametrize("name", ["AI", "ai", "Computer", "AI (Hard)", "ai (medium)"])
    def test_rejects_reserved(self, name):
        ok, msg = validate_name(name)
        assert ok is False
        assert "reserved" in msg.lower()

    def test_rejects_taken_case_insensitive(self):
        ok, _ = validate_name("alice", taken=["Alice"])
        assert ok is False

    def test_rejects_non_string(self):
        ok, _ = validate_name(None)  # type: ignore[arg-type]
        assert ok is False


class TestGameConstruction:
    def test_requires_two_players(self):
        with pytest.raises(ValueError):
            Game([])
        with pytest.raises(ValueError):
            Game([{"name": "A", "is_ai": False, "ai": None}])

    def test_creates_score_tracker_if_none_given(self):
        g = Game(make_human_pair())
        assert isinstance(g.score_tracker, ScoreTracker)


class TestGamePlayRound:
    def test_human_win_records_and_returns_winner(self):
        # Alice plays X and wins on top row: 1, 4, 2, 5, 3.
        inp = _ScriptedInput(["1", "4", "2", "5", "3"])
        out = _CapturedOutput()
        st = ScoreTracker()
        g = Game(make_human_pair(), score_tracker=st,
                 input_fn=inp, output_fn=out)
        result = g.play_round(starting_index=0)
        assert result["winner"] == "Alice"
        assert result["loser"] == "Bob"
        assert result["draw"] is False
        assert result["forfeit"] is False
        assert st.get("Alice")["wins"] == 1
        assert st.get("Bob")["losses"] == 1

    def test_starting_index_one_makes_other_player_x(self):
        # Bob starts → Bob is X. Bob wins top row: 1, 4, 2, 5, 3.
        inp = _ScriptedInput(["1", "4", "2", "5", "3"])
        st = ScoreTracker()
        g = Game(make_human_pair(), score_tracker=st,
                 input_fn=inp, output_fn=_CapturedOutput())
        result = g.play_round(starting_index=1)
        assert result["winner"] == "Bob"
        assert st.get("Bob")["wins"] == 1
        assert st.get("Alice")["losses"] == 1

    def test_invalid_starting_index_raises(self):
        g = Game(make_human_pair(), input_fn=lambda *_: "1",
                 output_fn=lambda *_: None)
        with pytest.raises(ValueError):
            g.play_round(starting_index=2)

    def test_draw_records_for_both_players(self):
        # A scripted draw:
        #  X | O | X
        #  X | X | O
        #  O | X | O
        # Move order (Alice X, Bob O):
        # X1, O2, X3, O6, X5 (X), wait — careful. Let me script a known draw.
        # Sequence below produces the DRAW_CELLS pattern with no wins along the way.
        # Plays: X→1, O→2, X→3, O→6, X→4, O→9, X→5, O→7? — verify no premature win.
        # Use this sequence (X moves: 5,1,3,7,8; O moves: 2,4,6,9):
        #  position layout after all:
        #   X(1) O(2) X(3)
        #   O(4) X(5) O(6)
        #   X(7) X(8) O(9)
        # That's wins on top row? No: X O X — fine. Middle row: O X O — fine.
        # Bottom: X X O — fine. Cols: 1,4,7 = X O X; 2,5,8 = O X X; 3,6,9 = X O O.
        # Diagonals: 1,5,9 = X X O; 3,5,7 = X X X — that IS a win for X!
        # Try: X→1, O→5, X→9, O→3, X→7, O→4, X→6, O→2, X→8.
        # Final:
        #  X(1) O(2) O(3)
        #  O(4) O(5) X(6)
        #  X(7) X(8) X(9)  ← bottom row X win! Bad.
        # Use the canonical draw: X→5, O→1, X→9, O→4, X→6, O→7, X→3, O→2, X→8 wait that's a final cell.
        # Easier: build draw via the well-known sequence:
        #   X1, O5, X9, O4, X6, O3, X7, O8, X2 — let's check:
        #    X(1) X(2) O(3)
        #    O(4) O(5) X(6)
        #    X(7) O(8) X(9)
        # Rows: XXO / OOX / XOX  — no wins.
        # Cols: 1,4,7 XOX; 2,5,8 XOO; 3,6,9 OXX — no wins.
        # Diagonals: 1,5,9 XOX; 3,5,7 OOX  — no wins. Full board → DRAW. Good.
        inp = _ScriptedInput(["1", "5", "9", "4", "6", "3", "7", "8", "2"])
        st = ScoreTracker()
        g = Game(make_human_pair(), score_tracker=st,
                 input_fn=inp, output_fn=_CapturedOutput())
        result = g.play_round(starting_index=0)
        assert result["draw"] is True
        assert result["winner"] is None
        assert st.get("Alice")["draws"] == 1
        assert st.get("Bob")["draws"] == 1

    def test_invalid_input_reprompts_then_accepts(self):
        # First answer non-numeric, then valid. Win sequence as before.
        inp = _ScriptedInput(["banana", "1", "4", "2", "5", "3"])
        out = _CapturedOutput()
        g = Game(make_human_pair(), input_fn=inp, output_fn=out)
        result = g.play_round(starting_index=0)
        assert result["winner"] == "Alice"
        assert any("Invalid input" in line for line in out.lines)

    def test_out_of_range_input_reprompts(self):
        inp = _ScriptedInput(["99", "1", "4", "2", "5", "3"])
        out = _CapturedOutput()
        g = Game(make_human_pair(), input_fn=inp, output_fn=out)
        g.play_round(starting_index=0)
        assert any("Invalid input" in line for line in out.lines)

    def test_taken_cell_input_reprompts(self):
        # Alice plays 1, Bob tries 1 then plays 4, etc.
        inp = _ScriptedInput(["1", "1", "4", "2", "5", "3"])
        out = _CapturedOutput()
        g = Game(make_human_pair(), input_fn=inp, output_fn=out)
        result = g.play_round(starting_index=0)
        assert any("already taken" in line for line in out.lines)
        assert result["winner"] == "Alice"

    def test_forfeit_confirmed_returns_no_result(self):
        inp = _ScriptedInput(["q", "y"])
        st = ScoreTracker()
        g = Game(make_human_pair(), score_tracker=st,
                 input_fn=inp, output_fn=_CapturedOutput())
        result = g.play_round(starting_index=0)
        assert result["forfeit"] is True
        assert result["winner"] is None
        # Forfeits are NOT recorded in v1.
        assert st.players == {}

    def test_forfeit_cancelled_continues_game(self):
        # Alice tries to quit then cancels (n), then plays the winning sequence.
        inp = _ScriptedInput(["q", "n", "1", "4", "2", "5", "3"])
        g = Game(make_human_pair(), input_fn=inp, output_fn=_CapturedOutput())
        result = g.play_round(starting_index=0)
        assert result["winner"] == "Alice"
        assert result["forfeit"] is False

    def test_eof_during_move_acts_as_forfeit(self):
        # input_fn raises EOFError → treated as forfeit, no recording.
        def eof_input(prompt=""):
            raise EOFError()
        st = ScoreTracker()
        g = Game(make_human_pair(), score_tracker=st,
                 input_fn=eof_input, output_fn=_CapturedOutput())
        result = g.play_round(starting_index=0)
        assert result["forfeit"] is True
        assert st.players == {}

    def test_board_resets_between_rounds(self):
        # Play one full game, then start another — board must be fresh.
        inp = _ScriptedInput(["1", "4", "2", "5", "3",   # round 1: Alice wins
                              "1", "4", "2", "5", "3"])  # round 2: same again
        st = ScoreTracker()
        g = Game(make_human_pair(), score_tracker=st,
                 input_fn=inp, output_fn=_CapturedOutput())
        r1 = g.play_round(starting_index=0)
        r2 = g.play_round(starting_index=0)
        assert r1["winner"] == r2["winner"] == "Alice"
        assert st.get("Alice")["wins"] == 2


class TestGameAgainstAI:
    def test_human_vs_hard_ai_human_cannot_win(self):
        # Hard AI plays as O and is unbeatable. Even with sane human moves,
        # the worst case for the human is a draw.
        # Drive with a deterministic but suboptimal human strategy and
        # confirm: the AI never loses (i.e., human never wins).
        for human_opening in (1, 2, 3, 4, 5, 6, 7, 8, 9):
            board = Board()
            ai = AI("O", "hard")
            human_sym, ai_sym = "X", "O"
            board.make_move(human_opening, human_sym)
            current = "ai"
            while not board.is_game_over():
                if current == "ai":
                    move = ai.get_move(board)
                    board.make_move(move, ai_sym)
                else:
                    # Human plays the lowest available cell — naive strategy.
                    move = board.empty_cells()[0] + 1
                    board.make_move(move, human_sym)
                current = "human" if current == "ai" else "ai"
            assert board.winner() != human_sym, (
                f"Hard AI lost when human opened with {human_opening}"
            )

    def test_ai_move_is_announced_to_output(self):
        # Force a quick AI win as O: Alice plays 1; AI is set to easy with
        # a seed that picks something deterministic.
        ai = AI("O", "easy", rng=random.Random(0))
        players = [
            {"name": "Alice", "is_ai": False, "ai": None},
            {"name": ai.label, "is_ai": True, "ai": ai},
        ]
        # Alice plays 5 then quits (forfeit) — we just want to see that the
        # AI announcement appears once before the forfeit.
        inp = _ScriptedInput(["5", "q", "y"])
        out = _CapturedOutput()
        g = Game(players, input_fn=inp, output_fn=out)
        g.play_round(starting_index=0)
        announcements = [line for line in out.lines if "plays at position" in line]
        assert len(announcements) >= 1
        assert ai.label in announcements[0]
