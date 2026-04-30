#!/usr/bin/env python3
"""V2 Requirements Agent — synthesises the V2 spec from V1 requirements + V2 additions.

Reads:
  requirements/requirements_final.md   — the V1 console app spec
  V2 requirements.txt                  — the V2 enhancement request

Writes:
  v2/requirements/v2_requirements.md   — the complete V2 web app spec

Environment variables
---------------------
ANTHROPIC_API_KEY   Required.
WORK_DIR            Repo root (default: three levels above this script).
MAX_ITERATIONS      Agent loop cap (default: 10).
"""

import sys
from pathlib import Path

# Allow sibling imports (agent_utils, slack_utils) when run from any cwd.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from agent_utils import TOOLS_DEV, require_api_key, run_agent, work_dir_from_env
from slack_utils import critical, progress, start, success
import anthropic

SYSTEM_PROMPT = """You are a senior software product manager creating a V2 requirements specification \
for a Tic Tac Toe web application.

You will be given:
  1. The V1 requirements (requirements_final.md) — a complete console-app spec.
  2. The V2 enhancement request — what needs to change.

Your task:
1. Read both documents carefully.
2. Identify which V1 requirements carry over to V2 (adapted for a web context).
3. Create a comprehensive V2 requirements spec saved to v2/requirements/v2_requirements.md that:
   a. Adapts all relevant V1 requirements for a browser-based web app.
   b. Adds the THREE THEMES requirement (Beach, Mountains, Desert — each with a distinct
      background and unique X / O symbols).
   c. Proposes EXACTLY THREE additional new features not present in V1. Choose features that:
        - Work well as web features (pure HTML/CSS/JavaScript, no backend server).
        - Enhance gameplay or user experience in a meaningful, distinct way.
        - Are NOT present in V1 (check carefully).
        - Are fully implementable in a single-file or small multi-file static site.
      Justify each chosen feature with a one-line rationale.
   d. Specifies clear UI/UX requirements for the web interface.
   e. Defines technical requirements for a static web app (pure HTML/CSS/JS, no build tools,
      openable by double-clicking index.html).
   f. Includes a testing section describing what unit tests should cover (Jest + jsdom).

Format: Use the same structured Markdown format as the V1 spec — sections for Overview,
Functional Requirements, Non-Functional Requirements, UI Requirements, Technical Requirements,
Testing Requirements.

Be specific and actionable — the coding agent will implement exactly what you write.
Write a complete, self-contained document; do not reference "see V1" without quoting the content."""


def main() -> None:
    require_api_key()
    client = anthropic.Anthropic()

    work_dir = work_dir_from_env(str(Path(__file__).resolve().parent.parent.parent))
    v1_req_path = work_dir / "requirements" / "requirements_final.md"
    v2_input_path = work_dir / "V2 requirements.txt"
    output_path = work_dir / "v2" / "requirements" / "v2_requirements.md"
    max_iterations = int(__import__("os").environ.get("MAX_ITERATIONS", "10"))

    print("Tic Tac Toe V2 — Requirements Agent")
    print("=" * 60)
    print(f"  Work dir : {work_dir}")
    print(f"  V1 spec  : {v1_req_path.relative_to(work_dir)}")
    print(f"  V2 input : {v2_input_path.relative_to(work_dir)}")
    print(f"  Output   : {output_path.relative_to(work_dir)}")
    print("=" * 60)

    for path, label in [(v1_req_path, "V1 requirements"), (v2_input_path, "V2 requirements.txt")]:
        if not path.exists():
            critical("Requirements Agent", f"{label} not found: {path}")
            sys.exit(1)

    start("Requirements Agent")

    v1_content = v1_req_path.read_text(encoding="utf-8")
    v2_input = v2_input_path.read_text(encoding="utf-8")

    initial_message = (
        "Create the V2 requirements specification.\n\n"
        f"Output file: v2/requirements/v2_requirements.md\n\n"
        "=== V1 REQUIREMENTS (requirements_final.md) ===\n\n"
        f"{v1_content}\n\n"
        "=== V2 ENHANCEMENT REQUEST (V2 requirements.txt) ===\n\n"
        f"{v2_input}\n\n"
        "List the project directory first, then write the complete V2 spec. "
        "Choose three specific new web features, justify each, and document all requirements fully."
    )

    try:
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
    except Exception as exc:
        critical("Requirements Agent", str(exc))
        sys.exit(1)

    if output_path.exists():
        size = output_path.stat().st_size
        success("Requirements Agent", f"v2/requirements/v2_requirements.md created ({size:,} bytes)")
        print(f"\n[OK] Output: {output_path} ({size:,} bytes)")
    else:
        critical("Requirements Agent", "Output file was not created by the agent.")
        sys.exit(1)


if __name__ == "__main__":
    main()
