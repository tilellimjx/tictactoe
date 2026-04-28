"""Shared tools and agent loop for all Tic Tac Toe agents.

Every agent imports from here so tool behaviour is consistent
whether running locally or in a cloud environment.
"""

import os
import subprocess
import sys
import time
from pathlib import Path

import anthropic


# ---------------------------------------------------------------------------
# Tool definitions
# ---------------------------------------------------------------------------

TOOL_READ_FILE: dict = {
    "name": "read_file",
    "description": "Read the full text of a file.",
    "input_schema": {
        "type": "object",
        "properties": {
            "path": {"type": "string", "description": "Path relative to the working directory."},
        },
        "required": ["path"],
    },
}

TOOL_WRITE_FILE: dict = {
    "name": "write_file",
    "description": "Write (or overwrite) a file, creating parent directories as needed.",
    "input_schema": {
        "type": "object",
        "properties": {
            "path": {"type": "string", "description": "Path relative to the working directory."},
            "content": {"type": "string", "description": "Full file content to write."},
        },
        "required": ["path", "content"],
    },
}

TOOL_LIST_DIR: dict = {
    "name": "list_directory",
    "description": "List files and subdirectories at a path (one level deep, hidden entries excluded).",
    "input_schema": {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "Directory path relative to working directory. Omit for root.",
                "default": ".",
            }
        },
        "required": [],
    },
}

TOOL_RUN_CMD: dict = {
    "name": "run_command",
    "description": (
        "Run a shell command and return stdout, stderr, and exit code. "
        "Use 'python' for the project interpreter and 'pytest' to run tests — "
        "both are automatically resolved to the current environment's executables."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "command": {"type": "string", "description": "Shell command to execute."},
            "timeout": {
                "type": "integer",
                "description": "Seconds before the command is killed (default 60).",
                "default": 60,
            },
        },
        "required": ["command"],
    },
}

# Convenience bundles
TOOLS_DEV = [TOOL_READ_FILE, TOOL_WRITE_FILE, TOOL_LIST_DIR, TOOL_RUN_CMD]


# ---------------------------------------------------------------------------
# Tool executor
# ---------------------------------------------------------------------------

def _resolve_command(cmd: str) -> str:
    """Replace bare 'python' / 'pytest' / 'pip' with the current interpreter paths
    so agents work in any virtual environment or cloud container."""
    py = sys.executable
    replacements = [
        ("pytest ", f'"{py}" -m pytest '),
        ("pytest\n", f'"{py}" -m pytest\n'),
        ("pytest",  f'"{py}" -m pytest'),
        ("pip ",    f'"{py}" -m pip '),
        ("pip\n",   f'"{py}" -m pip\n'),
        ("pip",     f'"{py}" -m pip'),
        ("python3 ", f'"{py}" '),
        ("python3\n", f'"{py}"\n'),
        ("python3",  f'"{py}"'),
        ("python ", f'"{py}" '),
        ("python\n", f'"{py}"\n'),
        ("python",  f'"{py}"'),
    ]
    for old, new in replacements:
        if cmd.startswith(old) or cmd == old.strip():
            return new + cmd[len(old):]
    return cmd


def execute_tool(block, work_dir: Path) -> str:
    """Dispatch a tool_use block to the appropriate handler."""
    name: str = block.name
    inp: dict = block.input

    if name == "read_file":
        p = work_dir / inp["path"]
        if not p.exists():
            return f"ERROR: file not found — {inp['path']}"
        try:
            return p.read_text(encoding="utf-8")
        except Exception as e:
            return f"ERROR reading {inp['path']}: {e}"

    elif name == "write_file":
        p = work_dir / inp["path"]
        try:
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(inp["content"], encoding="utf-8")
            return f"OK — wrote {len(inp['content'])} bytes to {inp['path']}"
        except Exception as e:
            return f"ERROR writing {inp['path']}: {e}"

    elif name == "list_directory":
        p = work_dir / inp.get("path", ".")
        if not p.exists():
            return f"ERROR: directory not found — {inp.get('path', '.')}"
        try:
            entries = sorted(p.iterdir(), key=lambda e: (e.is_file(), e.name))
            lines = [
                f"{'[dir] ' if e.is_dir() else '      '}{e.name}"
                for e in entries
                if not e.name.startswith(".")
            ]
            return "\n".join(lines) if lines else "(empty)"
        except Exception as e:
            return f"ERROR listing directory: {e}"

    elif name == "run_command":
        cmd = _resolve_command(inp["command"])
        timeout = int(inp.get("timeout", 60))
        try:
            result = subprocess.run(
                cmd,
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=str(work_dir),
            )
            parts = []
            if result.stdout.strip():
                parts.append(f"stdout:\n{result.stdout.rstrip()}")
            if result.stderr.strip():
                parts.append(f"stderr:\n{result.stderr.rstrip()}")
            parts.append(f"exit_code: {result.returncode}")
            return "\n".join(parts)
        except subprocess.TimeoutExpired:
            return f"ERROR: command timed out after {timeout}s"
        except Exception as e:
            return f"ERROR running command: {e}"

    return f"ERROR: unknown tool '{name}'"


# ---------------------------------------------------------------------------
# Agent loop
# ---------------------------------------------------------------------------

def run_agent(
    client: anthropic.Anthropic,
    *,
    model: str,
    system_prompt: str,
    initial_message: str,
    tools: list[dict],
    work_dir: Path,
    thinking: bool = False,
    max_tokens: int = 16384,
    max_iterations: int = 30,
) -> None:
    """Run an agentic tool-use loop until end_turn or max_iterations."""
    messages: list[dict] = [{"role": "user", "content": initial_message}]

    kwargs: dict = {
        "model": model,
        "max_tokens": max_tokens,
        "system": [
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        "tools": tools,
        "messages": messages,
    }
    if thinking:
        kwargs["thinking"] = {"type": "adaptive"}

    for i in range(max_iterations):
        # Retry on rate-limit with exponential backoff (60s, 120s, 240s)
        delay = 60
        for attempt in range(4):
            try:
                with client.messages.stream(**kwargs) as stream:
                    response = stream.get_final_message()
                break
            except anthropic.RateLimitError:
                if attempt == 3:
                    raise
                print(f"[rate limit — retrying in {delay}s (attempt {attempt + 1}/3)]")
                time.sleep(delay)
                delay *= 2

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
        for block in response.content:
            if block.type != "tool_use":
                continue
            result = execute_tool(block, work_dir)
            # Show a concise summary so the log stays readable
            preview = result.replace("\n", " ")[:120]
            print(f"  [{block.name}] {preview}{'...' if len(result) > 120 else ''}")
            tool_results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result,
                }
            )

        messages.append({"role": "user", "content": tool_results})
    else:
        print(f"[agent reached max_iterations={max_iterations}]")


# ---------------------------------------------------------------------------
# Environment helpers
# ---------------------------------------------------------------------------

def require_api_key() -> str:
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        sys.exit(
            "ERROR: ANTHROPIC_API_KEY environment variable is not set.\n"
            "  export ANTHROPIC_API_KEY=sk-ant-api03-..."
        )
    return key


def work_dir_from_env(default: str = ".") -> Path:
    """Return the working directory from WORK_DIR env var or the default."""
    return Path(os.environ.get("WORK_DIR", default)).resolve()
