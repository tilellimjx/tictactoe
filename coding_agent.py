#!/usr/bin/env python3
"""Coding agent — implements the Tic Tac Toe game and its unit tests.

Produces two files:
  OUTPUT_FILE     — the complete game implementation (default: game.py)
  UNIT_TEST_FILE  — pytest unit tests for every function/class written (default: test_units.py)

The agent writes tests alongside the code, runs them to confirm they pass,
and iterates until both files are complete and green.

Environment variables
---------------------
ANTHROPIC_API_KEY   Required. Anthropic API key.
REQUIREMENTS_FILE   Path to the requirements doc (default: requirements/requirements_final.md).
OUTPUT_FILE         Game implementation output path (default: game.py).
UNIT_TEST_FILE      Unit test output path (default: test_units.py).
WORK_DIR            Project root (default: directory of this script).
MAX_ITERATIONS      Agent loop cap (default: 30).
"""

import os
import sys
from pathlib import Path

from agent_utils import TOOLS_DEV, require_api_key, run_agent, work_dir_from_env
import anthropic

SYSTEM_PROMPT = """You are an expert Python developer implementing a command-line Tic Tac Toe game with full unit test coverage.

Your workflow:
1. Read the requirements file to understand the full spec.
2. List the project directory so you know what already exists.
3. Implement the complete game in OUTPUT_FILE, structured into testable units.
4. For every class and non-trivial function you write, immediately write corresponding
   unit tests in UNIT_TEST_FILE. Tests must be written for each unit as you go —
   not as an afterthought at the end.
5. Run the unit tests with `pytest UNIT_TEST_FILE -v` to verify they pass.
6. Fix any failures in either file and re-run until all tests are green.
7. Do a final syntax check on both files.

Implementation rules for OUTPUT_FILE:
- Use only the Python standard library (no third-party packages).
- Structure the code around testable classes: Board, AI, ScoreTracker, Game.
  Each class must be importable and testable in isolation.
- AI difficulty levels:
    Easy   — random legal move
    Medium — blocks an immediate opponent win when one exists; otherwise random
    Hard   — minimax algorithm (unbeatable)
- Persist scores to scores.json in the working directory; load on startup, save on exit.
- Support Human vs Human and Human vs AI modes.
- Include a replay prompt after each game.
- Guard the game entry point with `if __name__ == "__main__":` so tests can import
  the module without launching the game.

Unit test rules for UNIT_TEST_FILE:
- Use pytest. One test function per behaviour, named descriptively.
- Cover every public method of Board, AI, and ScoreTracker.
- Board: initialisation, valid/invalid moves, board-full detection, win detection
  (all rows, columns, diagonals), draw detection, reset.
- AI Easy: always returns a legal move from any board state.
- AI Medium: returns a blocking move when the opponent has two in a row with one empty.
- AI Hard (minimax): never loses; takes a winning move when one is available.
- ScoreTracker: increments correctly; file I/O round-trips (use unittest.mock.patch
  for open so no real file is written).
- Keep tests independent — no shared mutable state between test functions.
- All tests must be importable without launching the game's interactive loop.

When all tests pass, summarise: files written, number of tests, and any noteworthy
design decisions."""


def main() -> None:
    require_api_key()
    client = anthropic.Anthropic()

    work_dir = work_dir_from_env(str(Path(__file__).parent))
    requirements_file = Path(os.environ.get("REQUIREMENTS_FILE", "requirements/requirements_final.md"))
    output_file = Path(os.environ.get("OUTPUT_FILE", "game.py"))
    unit_test_file = Path(os.environ.get("UNIT_TEST_FILE", "test_units.py"))
    max_iterations = int(os.environ.get("MAX_ITERATIONS", "30"))

    req_path = work_dir / requirements_file
    if not req_path.exists():
        sys.exit(f"ERROR: requirements file not found: {req_path}")
    requirements_content = req_path.read_text(encoding="utf-8")

    print("Tic Tac Toe - Coding Agent")
    print("=" * 60)
    print(f"  Work dir       : {work_dir}")
    print(f"  Spec           : {requirements_file}")
    print(f"  Game output    : {output_file}")
    print(f"  Unit test file : {unit_test_file}")
    print("=" * 60)

    initial_message = (
        f"Implement the Tic Tac Toe game and its unit tests.\n\n"
        f"Game file    : {output_file}\n"
        f"Unit tests   : {unit_test_file}\n\n"
        f"Write unit tests for every class and non-trivial function as you implement them — "
        f"not all at the end. Run `pytest {unit_test_file} -v` after each batch to confirm "
        f"they pass before moving on.\n\n"
        f"Here is the full requirements specification:\n\n"
        f"---\n\n{requirements_content}\n\n---\n\n"
        f"Start by listing the project directory, then begin implementing."
    )

    run_agent(
        client,
        model="claude-opus-4-7",
        system_prompt=SYSTEM_PROMPT,
        initial_message=initial_message,
        tools=TOOLS_DEV,
        work_dir=work_dir,
        max_tokens=16384,
        max_iterations=max_iterations,
    )

    print("\n" + "=" * 60)
    for label, path in [("Game", work_dir / output_file), ("Unit tests", work_dir / unit_test_file)]:
        if path.exists():
            print(f"  [OK] {label}: {path} ({path.stat().st_size:,} bytes)")
        else:
            print(f"  [MISSING] {label}: {path}")
    print("=" * 60)


if __name__ == "__main__":
    main()
