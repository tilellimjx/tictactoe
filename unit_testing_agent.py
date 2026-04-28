#!/usr/bin/env python3
"""Unit testing agent — writes and runs tests for the Tic Tac Toe game.

Environment variables
---------------------
ANTHROPIC_API_KEY   Required. Anthropic API key.
GAME_FILE           Path to the game source (default: game.py).
TEST_FILE           Where to write the test suite (default: test_game.py).
WORK_DIR            Project root (default: directory of this script).
MAX_ITERATIONS      Agent loop cap (default: 30).
"""

import os
import sys
from pathlib import Path

from agent_utils import TOOLS_DEV, require_api_key, run_agent, work_dir_from_env
import anthropic

SYSTEM_PROMPT = """You are an expert Python test engineer writing a pytest test suite for a Tic Tac Toe game.

Your workflow:
1. Read the game source file to understand the implementation.
2. Install pytest if necessary: `pip install pytest pytest-cov`.
3. Write a comprehensive test suite covering every testable unit.
4. Run the tests with `pytest <TEST_FILE> -v`.
5. Read any failures, fix the tests (or identify genuine bugs in the game), and re-run.
6. Iterate until all tests pass (or document any real game bugs you found).

Test coverage requirements:
- Board state: initialisation, valid/invalid moves, board-full detection.
- Win detection: all rows, all columns, both diagonals, no false positives.
- Draw detection: full board with no winner.
- Turn management: alternating players, correct symbol assignment.
- AI — Easy: always returns a legal move.
- AI — Medium: blocks an immediate opponent win when one exists.
- AI — Hard (minimax): never loses; always takes a winning move when available.
- Score tracking: wins, losses, draws increment correctly; persistence load/save round-trips correctly.
- Replay flow: game resets cleanly between rounds.

Testing rules:
- Use pytest with clear, descriptive test names.
- Keep tests independent — no shared mutable state between tests.
- Mock file I/O for score persistence tests so no files are written to disk.
- Do not import or depend on anything outside the game file and the standard library.
- If the game uses classes, test each class in isolation where possible.

When all tests pass, print a final summary of the test results and coverage."""


def main() -> None:
    require_api_key()
    client = anthropic.Anthropic()

    work_dir = work_dir_from_env(str(Path(__file__).parent))
    game_file = Path(os.environ.get("GAME_FILE", "game.py"))
    test_file = Path(os.environ.get("TEST_FILE", "test_game.py"))
    max_iterations = int(os.environ.get("MAX_ITERATIONS", "30"))

    # Pre-load game source so the agent starts with full context
    game_path = work_dir / game_file
    if not game_path.exists():
        sys.exit(
            f"ERROR: game file not found: {game_path}\n"
            f"Run coding_agent.py first to generate the game."
        )
    game_source = game_path.read_text(encoding="utf-8")

    print("Tic Tac Toe - Unit Testing Agent")
    print("=" * 60)
    print(f"  Work dir  : {work_dir}")
    print(f"  Game file : {game_file}")
    print(f"  Test file : {test_file}")
    print("=" * 60)

    initial_message = (
        f"Write and run a comprehensive pytest test suite for the Tic Tac Toe game.\n\n"
        f"Write the tests to: {test_file}\n\n"
        f"Here is the full game source:\n\n"
        f"```python\n{game_source}\n```\n\n"
        f"Start by writing the test suite, then run it and fix any failures."
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

    test_path = work_dir / test_file
    print("\n" + "=" * 60)
    if test_path.exists():
        size = test_path.stat().st_size
        print(f"Done. Test suite written to: {test_path} ({size:,} bytes)")
    else:
        print("WARNING: agent finished but test file was not created.")
    print("=" * 60)


if __name__ == "__main__":
    main()
