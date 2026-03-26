# AGENTS.md

## Agent Loop Trigger Prompt (Copy/Paste)

Use this prompt to drop a fresh coding agent into FundingDash and force deterministic execution of the task loop:

```text
You are the implementation agent for this repository. Execute exactly one task-loop cycle now.

Goal:
- Complete the first red item in task_status.json end-to-end, then commit.

Hard rules:
- Follow AGENTS.md exactly.
- Read files in this order only:
	1) task_status.json (find the first item with status "red")
	2) memory/open_tasks.md (find that exact task and its allowed files)
	3) Only the files listed for that task
- Do not read unrelated files unless blocked.
- If blocked, stop and ask for clarification immediately. Do not invent a workaround.
- No hardcoded secrets. Keep sensitive keys server-side.

Execution contract:
- Implement the selected task fully.
- Update task_status.json for that item: set to "green" if complete end-to-end, otherwise "partial" with one explicit known gap.
- Move that task from Red to Completed in memory/open_tasks.md with a one-line completion note.
- Render and commit status updates:
	- Prefer: python scripts/render_gui_status.py --commit "task: <short summary>"
	- If python3 exists in your shell, this is also valid: python3 scripts/render_gui_status.py --commit "task: <short summary>"

Output format required:
1) Selected task id
2) Files changed
3) What was implemented
4) Final status chosen (green or partial) and why
5) Commit hash

Stop after one completed loop cycle.
```

## Your job
Fix one red item. Commit it. Repeat.

## The loop
1. Read `task_status.json` - find the first `"red"` item
2. Read `memory/open_tasks.md` - find that item's implementation notes
3. Look at only the files listed for that task. Nothing else.
4. Implement it
5. Update `task_status.json` - change status to `"green"` or `"partial"`
6. Move the task in `memory/open_tasks.md` from Red -> Completed
7. Run: `python3 scripts/render_gui_status.py --commit "task: <what you did>"`
8. Go to step 1

## If you hit a blocker
Ask for support or clarification IMMEDIATELY. DO NOT INVENT A PATH FORWARD

## Status rules
- `"green"` - works end-to-end, no fallback, no hardcoded values
- `"partial"` - works but needs an env var or has one known gap
- `"red"` - not implemented

## Need more context?
Only read these if the task requires it:
- `memory/architecture.md` - how the app is structured
- `memory/patterns.md` - Tauri command pattern, state rules
- `memory/providers.md` - OAuth quirks per provider

Do not read these upfront. Pull them only if you are stuck.