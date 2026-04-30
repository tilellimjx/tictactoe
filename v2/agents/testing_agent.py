#!/usr/bin/env python3
"""V2 Testing Agent — runs Jest tests and iterates with a fix agent until all pass.

Workflow:
  1. Verify prerequisites (v2/app/index.html, v2/package.json, v2/tests/game.test.js).
  2. npm install in v2/.
  3. Loop up to MAX_FIX_ITERATIONS:
       a. Run `cd v2 && npm test`.
       b. If all pass → notify success and exit 0.
       c. If failures → spawn a fix agent that reads the output and patches v2/app/ files.
  4. If still failing after all iterations → notify critical error and exit 1.

The fix agent edits only v2/app/ source files; it never modifies the test file.

Environment variables
---------------------
ANTHROPIC_API_KEY   Required.
WORK_DIR            Repo root (default: three levels above this script).
MAX_FIX_ITERATIONS  How many fix cycles to attempt (default: 5).
MAX_AGENT_ITER      Inner agent loop cap per fix cycle (default: 15).
"""

import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from agent_utils import TOOLS_DEV, require_api_key, run_agent, work_dir_from_env
from slack_utils import critical, failure, progress, start, success
import anthropic

FIX_AGENT_SYSTEM = """You are an expert JavaScript/web developer debugging a Tic Tac Toe web app.

You will be given the output of failing Jest tests. Your task:
1. Read the failing tests (v2/tests/game.test.js) to understand what is expected.
2. Read the relevant source files (v2/app/game.js, v2/app/index.html, v2/app/style.css,
   v2/app/themes/*.css) to understand the current implementation.
3. Identify the root cause of EACH failing test.
4. Fix ONLY the source files in v2/app/ — do NOT modify v2/tests/game.test.js.
5. Run `cd v2 && npm test` to verify all tests now pass.
6. Summarise every change you made and why.

Constraints:
- Fix only what is broken; do not refactor working code.
- If a test expectation appears wrong, read the spec in v2/requirements/v2_requirements.md
  before concluding the test is at fault — source code is more likely wrong.
- Never change test files."""


def _run_subprocess(cmd: str, cwd: Path, timeout: int = 180) -> tuple[int, str]:
    """Run a shell command; return (returncode, combined output)."""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=str(cwd),
        )
        parts = []
        if result.stdout.strip():
            parts.append(f"STDOUT:\n{result.stdout.rstrip()}")
        if result.stderr.strip():
            parts.append(f"STDERR:\n{result.stderr.rstrip()}")
        return result.returncode, "\n".join(parts) or "(no output)"
    except subprocess.TimeoutExpired:
        return 1, f"ERROR: command timed out after {timeout}s"
    except Exception as exc:
        return 1, f"ERROR: {exc}"


def _npm_install(v2_dir: Path) -> None:
    progress("Installing npm dependencies (npm install)...")
    code, out = _run_subprocess("npm install", cwd=v2_dir)
    if code != 0:
        critical("Testing Agent", f"npm install failed:\n{out}")
        sys.exit(1)
    print("[npm install OK]")


def _run_tests(v2_dir: Path) -> tuple[bool, str]:
    code, out = _run_subprocess("npm test -- --forceExit 2>&1", cwd=v2_dir)
    return code == 0, out


def _run_fix_agent(client: anthropic.Anthropic, work_dir: Path,
                   test_output: str, iteration: int) -> None:
    progress(f"Fix iteration {iteration} — spawning fix agent...")
    initial_message = (
        f"Fix the failing tests (iteration {iteration}).\n\n"
        "Test output:\n"
        f"```\n{test_output[:4000]}\n```\n\n"
        "Read the test file and source files, identify root causes, fix v2/app/ files, "
        "then run `cd v2 && npm test` to confirm all tests pass."
    )
    run_agent(
        client,
        model="claude-opus-4-7",
        system_prompt=FIX_AGENT_SYSTEM,
        initial_message=initial_message,
        tools=TOOLS_DEV,
        work_dir=work_dir,
        max_tokens=16384,
        max_iterations=int(os.environ.get("MAX_AGENT_ITER", "15")),
    )


def main() -> None:
    require_api_key()
    client = anthropic.Anthropic()

    work_dir = work_dir_from_env(str(Path(__file__).resolve().parent.parent.parent))
    v2_dir = work_dir / "v2"
    max_fix = int(os.environ.get("MAX_FIX_ITERATIONS", "5"))

    print("Tic Tac Toe V2 — Testing Agent")
    print("=" * 60)
    print(f"  Work dir         : {work_dir}")
    print(f"  V2 dir           : {v2_dir}")
    print(f"  Max fix attempts : {max_fix}")
    print("=" * 60)

    # --- Prerequisite checks ------------------------------------------------
    missing = []
    for rel in ["app/index.html", "package.json", "tests/game.test.js"]:
        if not (v2_dir / rel).exists():
            missing.append(f"v2/{rel}")
    if missing:
        critical(
            "Testing Agent",
            "Prerequisites missing — run coding_agent.py first:\n  " + "\n  ".join(missing),
        )
        sys.exit(1)

    start("Testing Agent")
    _npm_install(v2_dir)

    # --- Test / fix loop ----------------------------------------------------
    for attempt in range(max_fix + 1):
        progress(f"Running tests (attempt {attempt + 1}/{max_fix + 1})...")
        passed, output = _run_tests(v2_dir)
        print(output[:2000])

        if passed:
            success(
                "Testing Agent",
                f"All tests passed on attempt {attempt + 1}. :tada:\n"
                "The V2 Tic Tac Toe web app is ready.",
            )
            print(f"\n[OK] All tests green after {attempt + 1} attempt(s).")
            return

        if attempt < max_fix:
            failure("Testing Agent", f"Attempt {attempt + 1} failed — starting fix agent...")
            _run_fix_agent(client, work_dir, output, attempt + 1)
        else:
            critical(
                "Testing Agent",
                f"Tests still failing after {max_fix} fix attempt(s).\n\n"
                f"Last test output (truncated):\n{output[:1200]}",
            )
            sys.exit(1)


if __name__ == "__main__":
    main()
