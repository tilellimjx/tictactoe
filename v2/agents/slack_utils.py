"""Slack webhook notifications for the V2 pipeline.

The webhook URL is read from the SLACK_WEBHOOK_URL environment variable.
Set it as a GitHub Actions secret named SLACK_WEBHOOK_URL.
"""

import json
import os
import urllib.request

WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL", "")


def _post(payload: dict) -> bool:
    if not WEBHOOK_URL:
        print("[slack] SLACK_WEBHOOK_URL not set — skipping notification.")
        return False
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        WEBHOOK_URL,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception as e:
        print(f"[slack] send failed: {e}")
        return False


def notify(text: str, emoji: str = ":information_source:") -> bool:
    return _post({"text": f"{emoji} {text}"})


def start(step: str) -> None:
    notify(f"*V2 Pipeline* | *{step}* starting...", ":rocket:")


def success(step: str, details: str = "") -> None:
    msg = f"*V2 Pipeline* | *{step}* completed successfully. :white_check_mark:"
    if details:
        msg += f"\n{details}"
    notify(msg, ":white_check_mark:")


def failure(step: str, details: str = "") -> None:
    msg = f"*V2 Pipeline* | *{step}* FAILED. :x:"
    if details:
        msg += f"\n```{details[:1500]}```"
    notify(msg, ":x:")


def critical(step: str, details: str = "") -> None:
    msg = (
        f"*V2 Pipeline* | :rotating_light: *CRITICAL ERROR* in *{step}* "
        f"— human intervention required."
    )
    if details:
        msg += f"\n```{details[:1500]}```"
    notify(msg, ":rotating_light:")


def progress(message: str) -> None:
    notify(f"*V2 Pipeline* | {message}", ":gear:")
