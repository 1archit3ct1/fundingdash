# Open Tasks

Agents: read this file only after identifying a red item in task_status.json.
Find your task, read only the files listed, implement, update status, commit.

---

## Red

### step4_azure_option.azure_free_credit_path
**What:** Document Azure free-credit deployment option.
**Files:** `README.md`, `memory/providers.md`
**Impl:** Add steps for Azure Static Web Apps + minimal API hosting and credit constraints.

### step4_azure_option.env_contract
**What:** Define environment variable contract.
**Files:** `.env.example`, `README.md`
**Impl:** Separate frontend-safe vars from backend-secret vars with required/optional notes.

---

## Completed

### step3_release_readiness.cloudflare_link_slot
Added `publicDemoUrl` slot to `metadata.json` and README deployment checklist steps for Cloudflare website demo-link update.

### step3_release_readiness.ci_quality_gate
Added `.github/workflows/ci.yml` to run `npm ci`, `npm run lint`, and `npm run build` on push and pull request to `main`.

### step3_release_readiness.repo_hardening_docs
Added `SECURITY.md` and README security guidance covering disclosure process, supported versions, secret handling, and dependency update policy.

### step2_funding_core.freshness_persistence
Added versioned localStorage cache for accelerators + last refresh timestamp, then rehydrated state on startup before refresh.

### step2_funding_core.validation_resilience
Added deterministic server fallback (HTTP HEAD then GET) when model validation fails or key is missing, while preserving last known-good prerequisites.

### step2_funding_core.real_data_provider
Added `datasets/funding_programs.json`, served it via `/api/funding-programs`, and switched frontend rendering to API-provided programs.

### step1_security.http_security_headers
Enabled Helmet hardening, env-driven strict CORS allowlist, and validation route rate limiting in `server/index.ts` with required dependencies.

### step1_security.input_query_sanitization
Added client/server sanitization guardrails with length + character policies, URL normalization, and explicit malformed-input responses.

### step1_security.gemini_key_client_exposure
Moved Gemini validation from browser to `server/index.ts` and switched `src/App.tsx` to call `/api/validate`; documented server/client API env vars.

---

## Rules
- Read only the files listed for your task
- If you need broader system context first, read `memory/architecture.md`
- After completing: update `task_status.json` + run render script + commit