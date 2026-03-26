# Security Policy

## Supported Versions

| Version | Supported |
| --- | --- |
| main (latest) | Yes |
| Older commits/tags | No |

Security fixes are applied to the latest code on `main`.

## Reporting a Vulnerability

If you discover a security issue, do not open a public issue with exploit details.

Report privately with:
- A clear description of the issue
- Steps to reproduce
- Potential impact
- Any suggested mitigation

Use one of these channels:
- GitHub private vulnerability report for this repository
- Direct contact with project maintainers (if available)

Expected response targets:
- Initial acknowledgment: within 72 hours
- Triage decision: within 7 days
- Fix timeline: based on severity and complexity

## Disclosure Process

1. Receive and acknowledge report.
2. Validate impact and affected scope.
3. Implement and test a fix.
4. Release patch to `main`.
5. Publish a disclosure summary after remediation.

## Secret Handling Rules

- Never commit API keys, tokens, credentials, or private certificates.
- Keep sensitive values in environment variables only.
- Treat `GEMINI_API_KEY` as server-only secret.
- Frontend must use only non-secret `VITE_*` configuration.
- Rotate any leaked key immediately and remove exposed history where feasible.

## Dependency Update Rules

- Run dependency checks regularly (`npm audit`).
- Prioritize high/critical fixes and patch quickly.
- Prefer pinned lockfile updates via `package-lock.json`.
- Validate with `npm run lint` and `npm run build` before merge.

## Scope and Safe Harbor

- Testing should avoid privacy violations, data destruction, or service disruption.
- Do not access accounts or data beyond explicit authorization.
