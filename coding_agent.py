#!/usr/bin/env python3
"""Coding agent — implements the Tic Tac Toe game from the final requirements doc.

Environment variables
---------------------
ANTHROPIC_API_KEY   Required. Anthropic API key.
REQUIREMENTS_FILE   Path to the requirements doc (default: requirements/requirements_final.md).
OUTPUT_FILE         Where to write the game (default: game.py).
WORK_DIR            Project root (default: directory of this script).
MAX_ITERATIONS      Agent loop cap (default: 30).
"""

import os
import sys
from pathlib import Path

from agent_utils import TOOLS_DEV, require_api_key, run_agent, work_dir_from_env
import anthropic

SYSTEM_PROMPT = """You are an expert Python developer implementing a command-line Tic Tac Toe game.

Your workflow:
1. Read the requirements file to understand the full spec.
2. List the project directory so you know what already exists.
3. Implement the complete game in a single file (OUTPUT_FILE).
4. Run the file with `python <OUTPUT_FILE> --help` or a syntax check to confirm it parses cleanly.
5. Iterate and fix any errors until the file runs without syntax errors.

Implementation rules:
- Use only the Python standard library (no third-party packages).
- Structure the code with clear functions/classes: Board, Game, AI, ScoreTracker.
- AI difficulty levels:
    Easy   — random legal move
    Medium — blocks immediate wins, otherwise random
    Hard   — minimax algorithm (unbeatable)
- Persist scores to a JSON file (scores.json) in the working directory; load on startup, save on exit.
- Support both Human vs Human and Human vs AI modes.
- Include a replay prompt after each game.
- The game must be fully playable from a terminal with no external dependencies.
- Write clean, well-structured code with descriptive names; avoid unnecessary comments.

When you are satisfied the implementation is complete and error-free, summarise what was built."""


def main() -> None:
    require_api_key()
    client = anthropic.Anthropic()

    work_dir = work_dir_from_env(str(Path(__file__).parent))
    requirements_file = Path(os.environ.get("REQUIREMENTS_FILE", "requirements/requirements_final.md"))
    output_file = Path(os.environ.get("OUTPUT_FILE", "game.py"))
    max_iterations = int(os.environ.get("MAX_ITERATIONS", "30"))

    # Pre-load requirements so the agent starts with full context
    req_path = work_dir / requirements_file
    if not req_path.exists():
        sys.exit(f"ERROR: requirements file not found: {req_path}")
    requirements_content = req_path.read_text(encoding="utf-8")

    print("Tic Tac Toe - Coding Agent")
    print("=" * 60)
    print(f"  Work dir  : {work_dir}")
    print(f"  Spec      : {requirements_file}")
    print(f"  Output    : {output_file}")
    print("=" * 60)

    initial_message = (
        f"Implement the Tic Tac Toe game.\n\n"
        f"Write the complete implementation to: {output_file}\n\n"
        f"Here is the full requirements specification:\n\n"
        f"---\n\n{requirements_content}\n\n---\n\n"
        f"Start by listing the project directory, then implement and verify the code."
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

    game_path = work_dir / output_file
    print("\n" + "=" * 60)
    if game_path.exists():
        size = game_path.stat().st_size
        print(f"Done. Game written to: {game_path} ({size:,} bytes)")
    else:
        print("WARNING: agent finished but output file was not created.")
    print("=" * 60)


if __name__ == "__main__":
    main()
