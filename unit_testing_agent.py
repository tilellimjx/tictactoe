#!/usr/bin/env python3
"""Unit testing agent — runs the coding agent's unit tests, then writes and runs
its own broader integration/behavioural test suite.

Test execution order:
  1. Run UNIT_TEST_FILE (test_units.py) — written by coding_agent.py.
     Failures here are reported but do not stop the agent; the agent reads them
     and factors them into its own tests.
  2. Write TEST_FILE (test_game.py) — a separate, independent suite focused on
     end-to-end game flows, edge cases, and anything not covered by test_units.py.
  3. Run TEST_FILE and iterate until all tests in it pass.
  4. Run both suites together and report the combined result.

Environment variables
---------------------
ANTHROPIC_API_KEY   Required. Anthropic API key.
GAME_FILE           Path to the game source (default: game.py).
UNIT_TEST_FILE      Unit tests written by coding agent (default: test_units.py).
TEST_FILE           Integration tests written by this agent (default: test_game.py).
WORK_DIR            Project root (default: directory of this script).
MAX_ITERATIONS      Agent loop cap (default: 30).
"""

import os
import sys
from pathlib import Path

from agent_utils import TOOLS_DEV, require_api_key, run_agent, work_dir_from_env
import anthropic

SYSTEM_PROMPT = """You are an expert Python test engineer validating a command-line Tic Tac Toe game.

Your workflow:
1. Install pytest and pytest-cov if needed: `pip install pytest pytest-cov`.
2. Run the existing unit tests (UNIT_TEST_FILE) with `pytest UNIT_TEST_FILE -v`.
   - Record which pass and which fail.
   - Do NOT edit UNIT_TEST_FILE — it belongs to the coding agent.
   - If there are failures, note them; they may indicate real game bugs to document.
3. Read the game source (GAME_FILE) thoroughly to understand the implementation.
4. Write your own independent test suite in TEST_FILE covering:
   - Everything not already tested in UNIT_TEST_FILE (check what's there first).
   - Full game flow: start → moves → win/draw → score update → replay decision.
   - Edge cases: first move wins, last cell wins, alternating wins across replays.
   - AI Hard: simulate full games — Hard AI must never lose against any sequence of moves.
   - Score persistence: verify the JSON file written by the game loads back correctly
     after a simulated game (use tmp_path pytest fixture or monkeypatch).
   - Input validation: invalid positions, out-of-range, already-occupied cells.
   - Mode selection: both HvH and HvAI code paths are exercised.
5. Run TEST_FILE with `pytest TEST_FILE -v`. Fix any failures and re-run.
6. Once TEST_FILE is fully green, run both suites together:
   `pytest UNIT_TEST_FILE TEST_FILE -v --tb=short`
7. Run with coverage:
   `pytest UNIT_TEST_FILE TEST_FILE --cov=GAME_FILE --cov-report=term-missing`
8. Report: total tests, pass/fail counts, coverage percentage, and any genuine
   game bugs discovered.

Testing rules:
- Use pytest. Name test functions clearly: test_<what>_<condition>_<expected>.
- Keep tests fully independent — no shared mutable state between functions.
- Mock file I/O (open / json.dump / json.load) where needed to avoid disk writes.
- Never import or depend on anything outside the game file and the standard library.
- If you discover a real bug in the game, document it clearly in your final report
  but do not modify game.py — that is the coding agent's responsibility."""


def main() -> None:
    require_api_key()
    client = anthropic.Anthropic()

    work_dir = work_dir_from_env(str(Path(__file__).parent))
    game_file = Path(os.environ.get("GAME_FILE", "game.py"))
    unit_test_file = Path(os.environ.get("UNIT_TEST_FILE", "test_units.py"))
    test_file = Path(os.environ.get("TEST_FILE", "test_game.py"))
    max_iterations = int(os.environ.get("MAX_ITERATIONS", "30"))

    game_path = work_dir / game_file
    if not game_path.exists():
        sys.exit(
            f"ERROR: game file not found: {game_path}\n"
            f"Run coding_agent.py first."
        )

    unit_test_path = work_dir / unit_test_file
    unit_tests_available = unit_test_path.exists()

    print("Tic Tac Toe - Unit Testing Agent")
    print("=" * 60)
    print(f"  Work dir       : {work_dir}")
    print(f"  Game file      : {game_file}")
    print(f"  Unit tests     : {unit_test_file} ({'found' if unit_tests_available else 'NOT FOUND — skipping step 1'})")
    print(f"  New test file  : {test_file}")
    print("=" * 60)

    game_source = game_path.read_text(encoding="utf-8")
    unit_test_source = unit_test_path.read_text(encoding="utf-8") if unit_tests_available else ""

    initial_message = (
        f"Run the existing unit tests, then write and run your own integration test suite.\n\n"
        f"Game source    : {game_file}\n"
        f"Existing tests : {unit_test_file} ({'present — run these first' if unit_tests_available else 'not present — skip step 1'})\n"
        f"Your test file : {test_file}\n\n"
        + (
            f"--- Existing unit tests ({unit_test_file}) ---\n\n"
            f"```python\n{unit_test_source}\n```\n\n"
            if unit_tests_available else ""
        )
        + f"--- Game source ({game_file}) ---\n\n"
        f"```python\n{game_source}\n```\n\n"
        f"Begin by running `pytest {unit_test_file} -v` "
        + ("to see the baseline." if unit_tests_available else "(skip — file not present).")
        + " Then write your own tests in `{test_file}` and iterate until all pass."
    )

    run_agent(
        client,
        model="claude-opus-4-7",
        system_prompt=SYSTEM_PROMPT,
        initial_message=initial_message,
        tools=TOOLS_DEV,
        work_dir=work_dir,
        max_tokens=32000,
        max_iterations=max_iterations,
    )

    print("\n" + "=" * 60)
    for label, path in [
        ("Game", work_dir / game_file),
        ("Unit tests (coding agent)", work_dir / unit_test_file),
        ("Integration tests (this agent)", work_dir / test_file),
    ]:
        if path.exists():
            print(f"  [OK] {label}: {path.name} ({path.stat().st_size:,} bytes)")
        else:
            print(f"  [MISSING] {label}: {path.name}")
    print("=" * 60)


if __name__ == "__main__":
    main()
