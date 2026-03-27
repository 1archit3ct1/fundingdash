# Providers

- AI provider: Gemini model calls should execute from backend only.
- Frontend may only access `VITE_` prefixed variables; never expose secret keys.
- Backend secrets should be read from process environment without logging values.
- If provider request fails, return typed error and use deterministic fallback checks where possible.

## Azure Hosting Notes

- Preferred low-cost path: Azure Static Web Apps (frontend) + minimal API host (Azure Functions or App Service B1).
- Keep Gemini/API secrets in Azure app settings or Key Vault references, never in repo.
- Restrict backend CORS to the deployed frontend origin.
- Add Azure budget alerts and monthly spend thresholds before public rollout.
- Re-validate pricing/credit limits before each production change; free-credit terms may vary.

## Live Search Platform Notes

- Gemini with Google Search remains the search provider; external platforms add storage/compute around it.
- Supabase is the preferred first add-on for live search cache, audit logs, and per-user quotas with low ops overhead.
- Oracle Cloud Always Free is useful for scheduled/background enrichment workers when Vercel function limits become a bottleneck.
- Keep all provider credentials in runtime secret stores only; never commit keys into repo files.