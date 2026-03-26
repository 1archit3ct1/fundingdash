# Architecture

- Frontend: Vite + React app in `src/`.
- Current main UI and validation flow are in `src/App.tsx`.
- Build output is static assets from `npm run build`.
- Security target architecture: browser calls local API; API handles secrets and outbound model calls.
- Planned backend entrypoint: `server/index.ts` (Express).
- Shared project configuration lives in `package.json`, `.env.example`, and `metadata.json`.