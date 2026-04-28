#!/usr/bin/env python3
"""Cross-review and final merge pipeline for Tic Tac Toe requirements.

Step 1: Opus reviews Sonnet's doc  -> requirements_opus_merged.md
Step 2: Sonnet reviews Opus's doc  -> requirements_sonnet_merged.md
Step 3: Opus compares both merged  -> requirements_final.md
"""

import anthropic
from pathlib import Path

OPUS_DOC = Path("requirements/requirements_opus.md")
SONNET_DOC = Path("requirements/requirements_sonnet.md")
OPUS_MERGED = Path("requirements/requirements_opus_merged.md")
SONNET_MERGED = Path("requirements/requirements_sonnet_merged.md")
FINAL_DOC = Path("requirements/requirements_final.md")
MAX_ITERATIONS = 10

SAVE_TOOL = {
    "name": "save_document",
    "description": "Save the completed document to its output file.",
    "input_schema": {
        "type": "object",
        "properties": {
            "content": {
                "type": "string",
                "description": "Full document content in Markdown format.",
            }
        },
        "required": ["content"],
    },
}


def run_agent(
    client: anthropic.Anthropic,
    *,
    model: str,
    system_prompt: str,
    user_message: str,
    output_file: Path,
    thinking: bool = False,
    max_tokens: int = 16384,
) -> None:
    messages: list[dict] = [{"role": "user", "content": user_message}]

    kwargs: dict = {
        "model": model,
        "max_tokens": max_tokens,
        "system": [{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}],
        "tools": [SAVE_TOOL],
        "messages": messages,
    }
    if thinking:
        kwargs["thinking"] = {"type": "adaptive"}

    for _ in range(MAX_ITERATIONS):
        # Use streaming for large token budgets to avoid SDK timeout limits
        with client.messages.stream(**kwargs) as stream:
            response = stream.get_final_message()

        for block in response.content:
            if block.type == "text" and block.text:
                print(block.text)

        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason in ("end_turn", "stop_sequence"):
            break
        if response.stop_reason != "tool_use":
            print(f"[agent stopped: {response.stop_reason}]")
            break

        tool_results = []
        saved = False

        for block in response.content:
            if block.type != "tool_use" or block.name != "save_document":
                continue
            content: str = block.input["content"]
            output_file.parent.mkdir(parents=True, exist_ok=True)
            output_file.write_text(content, encoding="utf-8")
            print(f"Saved -> {output_file}")
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": f"Saved to {output_file}.",
            })
            saved = True

        messages.append({"role": "user", "content": tool_results})
        if saved:
            break


def main() -> None:
    client = anthropic.Anthropic()

    # -- Step 1: Opus reviews Sonnet's document ---------------------------------
    print("\n" + "=" * 60)
    print("Step 1 - Opus reviews Sonnet's requirements")
    print("=" * 60)
    run_agent(
        client,
        model="claude-opus-4-7",
        system_prompt="""You are a senior software requirements analyst specialising in game development.

You are reviewing a requirements document produced by Claude Sonnet for a Tic Tac Toe game.
Your task:
1. Analyse the document critically — structure, completeness, clarity.
2. Add inline commentary using **[Opus: ...]** markers where you agree, disagree, spot gaps, or suggest improvements.
3. Append any requirements you think are missing as new numbered entries.
4. Produce and save the merged document (original + your additions) with save_document.""",
        user_message=(
            "Below is Claude Sonnet's requirements document. Review it and save a merged document "
            "containing the original requirements plus your inline opinions and any additions.\n\n"
            "---\n\n" + SONNET_DOC.read_text(encoding="utf-8")
        ),
        output_file=OPUS_MERGED,
    )

    # -- Step 2: Sonnet reviews Opus's document ---------------------------------
    print("\n" + "=" * 60)
    print("Step 2 - Sonnet reviews Opus's requirements")
    print("=" * 60)
    run_agent(
        client,
        model="claude-sonnet-4-6",
        thinking=True,
        system_prompt="""You are a senior software requirements analyst specialising in game development.

You are reviewing a requirements document produced by Claude Opus for a Tic Tac Toe game.
Your task:
1. Analyse the document critically — structure, completeness, clarity.
2. Add inline commentary using **[Sonnet: ...]** markers where you agree, disagree, spot gaps, or suggest improvements.
3. Append any requirements you think are missing as new numbered entries.
4. Produce and save the merged document (original + your additions) with save_document.""",
        user_message=(
            "Below is Claude Opus's requirements document. Review it and save a merged document "
            "containing the original requirements plus your inline opinions and any additions.\n\n"
            "---\n\n" + OPUS_DOC.read_text(encoding="utf-8")
        ),
        output_file=SONNET_MERGED,
    )

    # -- Step 3: Opus synthesises both into a final document --------------------
    print("\n" + "=" * 60)
    print("Step 3 - Opus synthesises final requirements document")
    print("=" * 60)
    run_agent(
        client,
        model="claude-opus-4-7",
        max_tokens=32000,
        system_prompt="""You are a principal software requirements analyst specialising in game development.

You have two cross-reviewed requirements documents for a Tic Tac Toe game. Each was produced by one AI model after critically reviewing the other's original requirements. Your task is to synthesise both into a single definitive final document that:
1. Incorporates the strongest requirements and ideas from both sources.
2. Resolves conflicts or contradictions with a clear rationale.
3. Eliminates duplication and merges overlapping requirements cleanly.
4. Renumbers all requirements consistently (FR-001, NFR-001, UI-001, TR-001).
5. Produces clean, actionable Acceptance Criteria for every requirement.
6. Includes no inline review markers — this is the clean final spec.

Save the final document with save_document.""",
        user_message=(
            "Here are the two cross-reviewed documents. Synthesise them into the final requirements spec.\n\n"
            "## Document A - Opus's review of Sonnet's requirements\n\n"
            + OPUS_MERGED.read_text(encoding="utf-8")
            + "\n\n---\n\n"
            "## Document B - Sonnet's review of Opus's requirements\n\n"
            + SONNET_MERGED.read_text(encoding="utf-8")
        ),
        output_file=FINAL_DOC,
    )

    print("\n" + "=" * 60)
    print("Pipeline complete. Documents written:")
    for f in [OPUS_MERGED, SONNET_MERGED, FINAL_DOC]:
        mark = "[OK]" if f.exists() else "[MISSING]"
        print(f"  {mark}  {f}")
    print("=" * 60)


if __name__ == "__main__":
    main()
