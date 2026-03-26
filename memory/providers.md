# Providers

- AI provider: Gemini model calls should execute from backend only.
- Frontend may only access `VITE_` prefixed variables; never expose secret keys.
- Backend secrets should be read from process environment without logging values.
- If provider request fails, return typed error and use deterministic fallback checks where possible.