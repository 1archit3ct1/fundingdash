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