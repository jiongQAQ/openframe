# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Run from the repo root unless noted otherwise.

```bash
# Development
pnpm dev               # Start Electron app with Vite dev server

# Build
pnpm build             # TypeScript check + Vite build + electron-builder

# Lint
pnpm lint              # ESLint across all packages

# Database (run from apps/desktop/)
pnpm db:generate       # Generate Drizzle migration from schema changes
pnpm db:migrate        # Apply pending migrations
```

After changing `packages/db/schema.ts`, always run `pnpm db:generate` from `apps/desktop/` to produce the SQL migration file, then commit both the schema change and the generated files under `electron/migrations/`.

## Architecture

### Monorepo Layout

```
apps/desktop/          # Electron application
  electron/            # Main process (Node.js)
  src/                 # Renderer process (React)
packages/db/           # Shared Drizzle schema (schema.ts only)
packages/providers/    # AI provider definitions and factory
```

### Electron IPC Pattern

All database and filesystem access from the renderer goes through a strict IPC bridge:

1. **`packages/db/schema.ts`** — Drizzle table definitions (source of truth for DB shape)
2. **`apps/desktop/electron/handlers/*.ts`** — Main-process IPC handlers using raw `better-sqlite3` SQL (not Drizzle ORM queries)
3. **`apps/desktop/electron/preload.ts`** — `contextBridge` exposes typed APIs on `window` (`settingsAPI`, `genresAPI`, `categoriesAPI`, `thumbnailsAPI`, `aiAPI`, `vectorsAPI`)
4. **`apps/desktop/electron/electron-env.d.ts`** — `Window` interface declarations for all exposed APIs
5. **`apps/desktop/src/db/*Collection.ts`** — TanStack DB collections that sync via the preload APIs and provide reactive state to React

When adding a new data entity, this chain must be updated end-to-end in order.

### TanStack DB Collections

Collections follow the pattern in `settingsCollection.ts` / `genresCollection.ts`:
- `sync.sync()` loads all rows from the IPC API on mount and calls `markReady()`
- `onInsert` / `onUpdate` / `onDelete` persist mutations back to the main process and call `confirmSync()` to commit the optimistic update
- Use `useLiveQuery(collection)` in components to get reactive `{ data }` arrays

### Routing

TanStack Router with file-based routing. The route tree is auto-generated into `src/routeTree.gen.ts` by the Vite plugin — do not edit it manually. Add new pages by creating files in `src/routes/`. The filename determines the URL path (e.g. `genres.tsx` → `/genres`).

### Database

- **Location at runtime:** `app.getPath('userData')/app.db` (managed by Electron, not a hardcoded path)
- **Migrations folder:** `apps/desktop/electron/migrations/` (dev) / `extraResources/migrations/` (packaged)
- Drizzle `migrate()` runs automatically at app startup via `getDb()` in `electron/db.ts`
- Handlers use `getRawDb()` (returns the raw `better-sqlite3` instance) for all SQL — not the Drizzle ORM query builder
- Thumbnails are stored as files under `app.getPath('userData')/thumbnails/`; only the file path is stored in the DB

### Settings Storage

Settings (language, theme) and AI config are stored in a JSON file via `electron-store`, not in SQLite. The single store instance lives in `electron/store.ts` and is shared by `handlers/settings.ts` and `handlers/ai.ts`. The file is saved to `app.getPath('userData')/settings.json`.

### AI Providers

Provider definitions live in `packages/providers/`:
- `providers.ts` — list of supported providers and their models (text/image/video)
- `factory.ts` — `createProviderModel(providerId, modelId, config)` returns an `AnyModel` (`LanguageModel | ImageModel | VideoModel | CustomRestModel`)
- `colors.ts` — brand colors per provider

Supported providers: openai, anthropic, google, mistral, groq, xai, doubao, qwen, zhipu, together, perplexity, openrouter, lmstudio, ollama.

`CustomRestModel` (`{ _tag: 'custom-rest', ... }`) is used for providers without an AI SDK (e.g. image/video endpoints on alibaba/openai-compatible). Use the type guards (`isLanguageModel`, `isImageModel`, `isVideoModel`, `isCustomRestModel`) before calling model-specific APIs.

### Vector Search (sqlite-vec)

The app uses `sqlite-vec` for RAG/vector similarity search, loaded as a SQLite extension in `electron/db.ts`:

- `vec_chunks` is a `vec0` virtual table with `embedding FLOAT[1536]` — created automatically at startup, **not** managed by Drizzle migrations
- `chunks` (relational table) stores the raw text and links to `documents` via `document_id`; `chunks.id` is the foreign key used as `vec_chunks.chunk_id`
- All vector operations go through `handlers/vectors.ts` and are exposed as `window.vectorsAPI`

**IPC methods:**
- `vectorsAPI.insertDocument(doc)` — upsert a document record
- `vectorsAPI.insertChunk({ document_id, content, chunk_index, embedding })` — insert text + float32 embedding (pass as `number[]`)
- `vectorsAPI.search({ embedding, limit?, document_id? })` — KNN search, returns `{ chunk_id, document_id, content, chunk_index, distance }[]`
- `vectorsAPI.deleteDocument(document_id)` — deletes document, chunks, and vec_chunks rows

Embeddings are serialized to a `Float32Array` blob internally. The vector dimension is fixed at 1536 at table-creation time; changing it requires dropping and recreating `vec_chunks`.

### i18n

Locale files are in `src/i18n/locales/en.ts` and `zh.ts` as typed `as const` objects. Both files must be kept in sync whenever new translation keys are added.
