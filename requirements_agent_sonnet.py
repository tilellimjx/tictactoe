#!/usr/bin/env python3
"""Requirements generation agent for a Tic Tac Toe game (Claude Sonnet 4.6)."""

import anthropic
from pathlib import Path

REQUIREMENTS_FILE = Path("requirements/requirements_sonnet.md")
MAX_ITERATIONS = 20

SYSTEM_PROMPT = """You are an expert software requirements analyst specialising in game development.

Your task is to create comprehensive, well-structured requirements for a Tic Tac Toe game.

Workflow:
1. Use ask_user to gather context (platform, number of players, special features, etc.).
   Ask at most 3 concise questions.
2. Generate a thorough requirements document covering:
   - Functional Requirements  (FR-001, FR-002, ...): rules, win/draw detection, turns, input
   - Non-Functional Requirements (NFR-001, ...): performance, usability, maintainability
   - User Interface Requirements (UI-001, ...): display, prompts, feedback
   - Technical Requirements (TR-001, ...): constraints, dependencies, architecture hints
3. Call save_requirements with the finished Markdown document.

Each requirement must include: ID · Title · Description · Acceptance Criteria."""


def main() -> None:
    client = anthropic.Anthropic()

    tools: list[dict] = [
        {
            "name": "ask_user",
            "description": "Ask the user a clarifying question to gather requirements context.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "question": {
                        "type": "string",
                        "description": "The question to ask the user.",
                    }
                },
                "required": ["question"],
            },
        },
        {
            "name": "save_requirements",
            "description": "Save the completed requirements document to requirements_sonnet.md.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "content": {
                        "type": "string",
                        "description": "The full requirements document in Markdown format.",
                    }
                },
                "required": ["content"],
            },
        },
    ]

    messages: list[dict] = [
        {
            "role": "user",
            "content": (
                "Generate comprehensive requirements for a Tic Tac Toe game. "
                "Ask me a few questions for context, then produce and save a "
                "structured requirements document."
            ),
        }
    ]

    print("Tic Tac Toe — Requirements Agent (Claude Sonnet 4.6)")
    print("=" * 50)

    for _ in range(MAX_ITERATIONS):
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=8192,
            thinking={"type": "adaptive"},
            system=[
                {
                    "type": "text",
                    "text": SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            tools=tools,
            messages=messages,
        )

        for block in response.content:
            if block.type == "text" and block.text:
                print(f"\n{block.text}")

        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason in ("end_turn", "stop_sequence"):
            break

        if response.stop_reason != "tool_use":
            print(f"[agent stopped: {response.stop_reason}]")
            break

        tool_results = []
        saved = False

        for block in response.content:
            if block.type != "tool_use":
                continue

            if block.name == "ask_user":
                print(f"\n{block.input['question']}")
                answer = input("> ").strip()
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": answer or "(no answer provided)",
                    }
                )

            elif block.name == "save_requirements":
                content: str = block.input["content"]
                REQUIREMENTS_FILE.parent.mkdir(parents=True, exist_ok=True)
                REQUIREMENTS_FILE.write_text(content, encoding="utf-8")
                print(f"\nRequirements saved to {REQUIREMENTS_FILE}")
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": f"Successfully saved to {REQUIREMENTS_FILE}.",
                    }
                )
                saved = True

        messages.append({"role": "user", "content": tool_results})

        if saved:
            break

    print("\n" + "=" * 50)
    if REQUIREMENTS_FILE.exists():
        print(f"Done. Requirements written to: {REQUIREMENTS_FILE}")
    else:
        print("Agent finished without saving a requirements document.")


if __name__ == "__main__":
    main()
