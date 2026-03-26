# Open Tasks

Agents: read this file only after identifying a red item in task_status.json.
Find your task, read only the files listed, implement, update status, commit.

---

## Red

### step3_release_readiness.repo_hardening_docs
**What:** Add security policy for open-source release.
**Files:** `SECURITY.md`, `README.md`
**Impl:** Define disclosure process, supported versions, secret-handling and dependency update rules.

### step3_release_readiness.ci_quality_gate
**What:** Add CI checks for pull requests.
**Files:** `.github/workflows/ci.yml`, `package.json`
**Impl:** Run npm ci, npm run lint, npm run build on push and pull request.

### step3_release_readiness.cloudflare_link_slot
**What:** Track public demo URL for company website update.
**Files:** `metadata.json`, `README.md`
**Impl:** Add `publicDemoUrl` field and release checklist entry for Cloudflare site update.

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