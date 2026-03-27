Powered by the @gemini API 

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

# Run and deploy FundingDash

This contains everything you need to run your app locally.

Live demo: https://fundingdash.vercel.app

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Security

Before contributing or deploying, review [SECURITY.md](SECURITY.md).

Key rules:
- Report vulnerabilities through private channels (not public issues with exploit details).
- Keep secrets out of source control; server-only secrets must never be exposed to the client.
- Frontend config should use non-secret `VITE_*` values only.
- Keep dependencies updated and validate with `npm run lint` and `npm run build` before merge.

## Open-Source Release Security Checklist

- Confirm no credentials or tokens are committed.
- Ensure `.env` files with real secrets are excluded.
- Verify `SECURITY.md` remains current.
- Run `npm audit`, `npm run lint`, and `npm run build` before release tagging.

## Deployment Link Checklist

- Set `publicDemoUrl` in `metadata.json` to the live deployment URL.
- Add or update the FundingDash demo link on the NEXTAURA Cloudflare website.
- Verify the public URL serves correctly from desktop and mobile networks.

## Azure Free-Credit Deployment Path

Use this path when applying Azure free credits and keeping monthly cost minimal.

1. Create a resource group in your preferred region.
2. Deploy frontend with Azure Static Web Apps (free tier when available).
3. Host the backend API as a minimal Azure Functions app or low-tier App Service.
4. Set production env vars in Azure settings (never in repo files).
5. Configure CORS allowlist to the Static Web App domain only.
6. Validate health and key routes after deployment (`/api/health`, `/api/funding-programs`).

### Credit and Cost Constraints

- Free tiers can change by region and subscription type; confirm limits before go-live.
- Set budget alerts and spending caps in Cost Management on day one.
- Keep a rollback path to local or alternate hosting if credits expire.
- Avoid high-frequency polling jobs that can burn free credits quickly.

## Environment Variable Contract

Use this contract to keep secrets server-side and frontend configuration explicit.

### Frontend-Safe Variables (browser-visible)

- `VITE_API_BASE_URL` (required): API base URL used by the frontend.

### Backend Secret / Runtime Variables

- `GEMINI_API_KEY` (required in production): Gemini key for server-side validation only.
- `DISCOVERY_REFRESH_HOURS` (optional): cadence for live discovery refreshes, default `12` for twice-daily updates.
- `SERVER_PORT` (optional): API listen port, default `8787`.
- `VALIDATION_RATE_LIMIT_MAX` (optional): per-IP limit for `/api/validate` per 15 minutes.
- `LIVE_SEARCH_RATE_LIMIT_MAX` (optional): per-IP limit for `/api/live-search` per 15 minutes.
- `CORS_ALLOWLIST` (optional): comma-separated allowed origins for API requests.
- `APP_URL` (optional): canonical app URL for callbacks/self-referential links.

### Rules

- Never expose backend secrets to browser bundles.
- Only variables prefixed with `VITE_` may be referenced by frontend code.
- Keep production values in hosting platform settings, not in committed `.env` files.

## Live Web Search API (Vercel + Local)

FundingDash now exposes a backend-only live web search endpoint powered by Gemini with Google Search tool use.

- Route: `POST /api/live-search`
- Runtime secret required: `GEMINI_API_KEY`
- Request body: `{ "query": "<search string>", "maxResults": 5 }`
- Response shape: `{ "searchSummary": "...", "results": [{ "title": "...", "url": "...", "snippet": "...", "sourceDomain": "..." }], "source": "gemini-google-search" }`

Example request:

```bash
curl -X POST "https://fundingdash.vercel.app/api/live-search" \
   -H "Content-Type: application/json" \
   -d '{"query":"top startup accelerators accepting applications now","maxResults":5}'
```

### Vercel Setup (Safe)

1. Add `GEMINI_API_KEY` in Vercel Project Settings -> Environment Variables.
2. Optionally set `DISCOVERY_REFRESH_HOURS`, `VALIDATION_RATE_LIMIT_MAX`, and `LIVE_SEARCH_RATE_LIMIT_MAX`.
3. Redeploy and verify `/api/health`, `/api/funding-programs`, and `/api/live-search`.
4. Keep all secrets in Vercel env settings only; do not commit keys.


