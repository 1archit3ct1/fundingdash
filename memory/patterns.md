# Patterns

- Keep browser code free of secrets. Any key-dependent logic must live in backend endpoints.
- Add new behavior behind explicit status items in `task_status.json`.
- Each task should touch only files listed in `memory/open_tasks.md`.
- Favor incremental commits: one red item -> one commit.
- Status updates must match implementation reality: green, partial, or red.