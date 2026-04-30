#!/usr/bin/env python3
"""V2 Coding Agent — builds the Tic Tac Toe web app and its Jest unit tests.

Reads:
  v2/requirements/v2_requirements.md   — the V2 spec (from requirements_agent.py)

Writes:
  v2/app/index.html                    — main entry point (double-click to open)
  v2/app/game.js                       — all game logic
  v2/app/style.css                     — base styles
  v2/app/themes/beach.css              — Beach theme
  v2/app/themes/mountains.css          — Mountains theme
  v2/app/themes/desert.css             — Desert theme
  v2/tests/game.test.js                — Jest unit tests
  v2/package.json                      — Jest dev dependency + test script

Environment variables
---------------------
ANTHROPIC_API_KEY   Required.
WORK_DIR            Repo root (default: three levels above this script).
MAX_ITERATIONS      Agent loop cap (default: 30).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from agent_utils import TOOLS_DEV, require_api_key, run_agent, work_dir_from_env
from slack_utils import critical, progress, start, success
import anthropic

SYSTEM_PROMPT = """You are an expert front-end developer building a Tic Tac Toe web application.

Your workflow:
1. Read v2/requirements/v2_requirements.md for the full spec.
2. List the project structure.
3. Build the complete web app as PURE HTML/CSS/JavaScript (no server, no build tools required):

   v2/app/index.html
     - Complete self-contained HTML file; opening it in any browser starts the game.
     - Links to game.js, style.css, and the active theme CSS.
     - All three themes are selectable via UI; no page reload needed.

   v2/app/game.js
     - All game logic: Board class, AI (Easy/Medium/Hard minimax), ScoreManager, UIController.
     - Exports nothing — loaded as a plain <script> tag.
     - Guard interactive startup with DOMContentLoaded so Jest can import the file safely.

   v2/app/style.css
     - Base layout, board grid, buttons, scoreboard, responsive design.
     - Uses CSS custom properties (--bg-color, --x-symbol, --o-symbol, etc.) for theme overrides.

   v2/app/themes/beach.css
   v2/app/themes/mountains.css
   v2/app/themes/desert.css
     - Each theme overrides the CSS custom properties defined in style.css.
     - Backgrounds use CSS gradients or data-URI images (NO external URLs).
     - X and O symbols are replaced with theme-appropriate emoji or Unicode characters
       (e.g., Beach: 🌊 / 🏖️, Mountains: 🏔️ / 🌲, Desert: 🌵 / ☀️) with plain-text ASCII
       fallbacks (B/M, M/T, C/S) for environments that don't support emoji.

   v2/tests/game.test.js
     - Jest tests using jsdom environment.
     - Test: board init, all 8 win lines, draw detection, move validation.
     - Test: Easy AI never picks occupied cell; Medium AI blocks a two-in-a-row.
     - Test: Hard (minimax) AI never loses (full game simulation, multiple seeds).
     - Test: score tracking increments correctly.
     - Test: theme switching applies correct CSS class to document.
     - Test: all three new features specified in the requirements.
     - Use jest.fn() for DOM side effects; import game.js via require() with jsdom globals set.

   v2/package.json
     - { "scripts": { "test": "jest" }, "devDependencies": { "jest": "^29", "jest-environment-jsdom": "^29" },
         "jest": { "testEnvironment": "jsdom", "testMatch": ["**/tests/**/*.test.js"] } }

4. Install deps: run `cd v2 && npm install`.
5. Run tests: `cd v2 && npm test`. Fix any failures and re-run until fully green.
6. Print a summary: files created, test count, pass/fail.

Implementation rules:
- The game MUST work by double-clicking index.html — no localhost server, no npm, no build step.
- All JavaScript is vanilla ES6+ (no frameworks, no bundler).
- Preserve all applicable V1 features: Human vs Human, Human vs AI (3 levels), score tracking
  with persistence (localStorage replaces scores.json), replay prompt, win/draw detection.
- Implement EXACTLY the three new features from the requirements spec — no more, no less.
- Keep game.js importable in Jest without launching the interactive UI (guard with
  typeof document !== 'undefined' or a DOMContentLoaded check around UI init code).
- Use localStorage for score persistence (replaces the V1 JSON file approach).
- Make the theme switcher work without a page reload (swap a <link> href or a body class)."""


def main() -> None:
    require_api_key()
    client = anthropic.Anthropic()

    work_dir = work_dir_from_env(str(Path(__file__).resolve().parent.parent.parent))
    req_path = work_dir / "v2" / "requirements" / "v2_requirements.md"
    max_iterations = int(__import__("os").environ.get("MAX_ITERATIONS", "30"))

    print("Tic Tac Toe V2 — Coding Agent")
    print("=" * 60)
    print(f"  Work dir     : {work_dir}")
    print(f"  Requirements : {req_path.relative_to(work_dir)}")
    print(f"  App output   : v2/app/")
    print(f"  Tests        : v2/tests/game.test.js")
    print("=" * 60)

    if not req_path.exists():
        critical(
            "Coding Agent",
            f"V2 requirements not found: {req_path}\nRun requirements_agent.py first.",
        )
        sys.exit(1)

    start("Coding Agent")

    initial_message = (
        "Build the V2 Tic Tac Toe web application and its test suite.\n\n"
        "Requirements : v2/requirements/v2_requirements.md\n"
        "App output   : v2/app/  (index.html, game.js, style.css, themes/)\n"
        "Tests        : v2/tests/game.test.js\n"
        "Package      : v2/package.json\n\n"
        "Start by reading v2/requirements/v2_requirements.md, then list the project, "
        "then implement all files. Run `cd v2 && npm install && npm test` when done "
        "and iterate until all tests pass."
    )

    try:
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
    except Exception as exc:
        critical("Coding Agent", str(exc))
        sys.exit(1)

    app_index = work_dir / "v2" / "app" / "index.html"
    if app_index.exists():
        app_files = list((work_dir / "v2" / "app").rglob("*"))
        file_count = sum(1 for f in app_files if f.is_file())
        success("Coding Agent", f"v2/app/ created — {file_count} files.")
        print(f"\n[OK] v2/app/index.html exists ({file_count} total app files)")
    else:
        critical("Coding Agent", "v2/app/index.html was not created by the agent.")
        sys.exit(1)


if __name__ == "__main__":
    main()
