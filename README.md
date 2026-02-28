<p align='center'>
  <img src='./apps/ui/public/logo.svg' alt='Openframe logo' width='120' />
</p>

# Openframe

Openframe is an AI-powered script-to-production studio with both desktop and web runtimes.

[中文文档](./README.zh.md)

## Highlights

- End-to-end workflow: project -> script -> character/prop/scene -> shots -> production/export
- Script editor with AI toolkit:
  - autocomplete
  - generate script from idea
  - adapt script from novel excerpt
  - scene expand / rewrite / dialogue polish / pacing / continuity check
- Character relation graph with script-driven extraction and optimization
- Language-aware extraction for core entities (character / prop / scene / shot)
- Shot generation supports target shot count input (higher count -> richer output)
- Thumbnail full-image preview in character / prop / scene / shot panels
- First-launch Driver.js style onboarding tour

## App Targets

- `apps/desktop`: Electron shell (native desktop app)
- `apps/ui`: Shared React UI and business logic
- `apps/web`: Web shell + API proxy route for browser deployment

## Runtime Differences

### Desktop

- Persistence: SQLite (`better-sqlite3`) + `electron-store`
- Native features: local directory selection, media cleanup, native exports
- Vector search: available in desktop runtime (`sqlite-vec`)

### Web

- Persistence: IndexedDB (SQLite replacement in browser)
- Settings storage: `localStorage` (settings JSON replacement in browser)
- Backend: `/api/ai` proxy only (forwarding requests)
- Data panel hides desktop-only operations (directory open/change, media cleanup, local media size sections)

## Tech Stack

- Monorepo: `pnpm workspace`
- Desktop app: `Electron + React + Vite + TypeScript`
- Web app: `Vite + React + Vercel Functions`
- UI: `Tailwind CSS + daisyUI + lucide-react`
- Editor: `TipTap`
- Desktop data layer: `SQLite + better-sqlite3 + Drizzle schema`
- Web data layer: `IndexedDB + localStorage`
- Reactive local state: `TanStack DB`
- AI integration: `Vercel AI SDK + custom REST providers`

## Repository Layout

```text
openframe/
  apps/
    desktop/                 # Electron app (main/preload/desktop shell)
    ui/                      # Shared UI + routes + collections
    web/                     # Web shell + api/ai proxy route
  packages/
    db/                      # Shared DB schema
    providers/               # AI provider/model definitions
    runtime-contract/        # Shared Window/runtime type contract
    shared/                  # Shared constants/utils
```

## Prerequisites

- Node.js (LTS recommended)
- `pnpm@9.12.2`
- Desktop OS for Electron builds: macOS / Windows / Linux

## Install

```bash
pnpm install
```

`apps/desktop` runs `electron-rebuild` for `better-sqlite3` during `postinstall`.

## Common Commands

```bash
# root
pnpm dev            # desktop dev
pnpm dev:web        # web dev (http://localhost:5170)
pnpm build
pnpm build:web
pnpm lint
pnpm test
pnpm db:generate
pnpm db:migrate

# type check
pnpm -C apps/ui exec tsc --noEmit
pnpm -C apps/web exec tsc --noEmit
pnpm -C apps/desktop exec tsc --noEmit
```

## Web Deployment (Vercel)

This repository includes `vercel.json` for monorepo deployment.

- Build output: `apps/web/dist`
- API function source: `apps/web/api/**/*.ts`
- Public API path: `/api/ai` (rewritten to `/apps/web/api/ai`)

Important setting in Vercel project:

- `Root Directory` should be repository root (`.`), not `apps/web`.

## Architecture Rules

- Renderer/UI must not access DB/filesystem directly.
- Persistence and side effects go through `window.*API` runtime contracts.
- For new entities in desktop+ui flow, update this chain together:
  1. `packages/db/schema.ts`
  2. `apps/desktop/electron/handlers/*.ts`
  3. `apps/desktop/electron/preload.ts`
  4. `packages/runtime-contract/index.d.ts`
  5. `apps/ui/src/db/*_collection.ts`
- Handler SQL uses raw `better-sqlite3`.
- Do not manually edit generated route tree files.

## Database & Migrations

- Desktop runtime DB path: `app.getPath('userData')/app.db`
- Migration folder: `apps/desktop/electron/migrations/`

After schema changes:

```bash
pnpm -C apps/desktop db:generate
```

## i18n

Keep locale files aligned:

- `apps/ui/src/i18n/locales/en.ts`
- `apps/ui/src/i18n/locales/zh.ts`

## Troubleshooting

- `No default text model configured`: configure and enable a text model in Settings.
- Native dependency build issues: rerun `pnpm install` and verify `electron-rebuild` success.
- Vercel cannot detect correct root/build context:
  - ensure project `Root Directory` is `.`
  - redeploy after pulling latest `vercel.json`
- AI proxy issues in web:
  - verify `/api/ai` is deployed and reachable

## Release

- Push a tag matching `v*` (for example, `v0.7.0`) to trigger release workflow.
- GitHub Actions builds desktop packages for macOS / Windows / Linux and uploads artifacts to GitHub Release.
- Release notes are auto-generated (`generate_release_notes` in `.github/workflows/release-build.yml`).
- macOS release requires signing secrets:
  - `CSC_LINK`, `CSC_KEY_PASSWORD`
- macOS release also requires notarization credentials (one set is enough):
  - `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`
  - or `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`
