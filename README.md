<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

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

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/a8efaf45-ed21-4402-9b2d-1c0a056356af

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
