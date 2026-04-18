#!/usr/bin/env python3
"""
PostToolUse hook: auto-format Python files with Black after edits.
Reads hook JSON from stdin. Never blocks (always exits 0).
"""
import json
import subprocess
import sys


def main() -> None:
    try:
        data = json.load(sys.stdin)
        file_path = data.get("tool_input", {}).get("file_path", "")
    except Exception:
        sys.exit(0)

    if not file_path or not file_path.endswith(".py"):
        sys.exit(0)

    try:
        result = subprocess.run(
            [sys.executable, "-m", "black", "--quiet", file_path],
            capture_output=True,
            timeout=30,
        )
        if result.returncode == 0:
            # Black made changes — let Claude know
            print(f"[hook] black formatted {file_path}", flush=True)
    except FileNotFoundError:
        pass  # black not installed — skip silently
    except Exception:
        pass  # never block on formatter failure

    sys.exit(0)


if __name__ == "__main__":
    main()
