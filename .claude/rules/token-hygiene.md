---
description: Token management — what to load and when
---

# Token Hygiene

## Session start — do NOT do these
- Do NOT read the `.jsonl` transcript file (it is 50k–200k tokens; use memory instead)
- Do NOT speculatively read source files "to get oriented" — wait until a task requires it
- Do NOT re-read files already visible in the current context window
- Do NOT spawn an Agent for tasks you can do in 1–3 tool calls yourself

## Reading files — always prefer targeted access
- Use `Grep` or `Glob` before `Read` — find the specific location first
- Use `offset` + `limit` on `Read` for large files (never read 500 lines to find 5)
- Read only what the current task requires, nothing more

## Memory — keep lean
- Do NOT save derivable facts (file paths, function names, code structure)
- Do NOT save completed task lists or activity summaries
- Update existing memory entries instead of creating new ones
- If unsure whether to save: ask "will this still matter in a future session?"

## Context discipline
- `/compact` when context hits ~70% — never wait until forced
- Prefer one well-targeted agent over multiple broad ones
- After compaction: read memory, not the transcript
