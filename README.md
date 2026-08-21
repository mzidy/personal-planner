# The Serene Executive

Nuxt 4 + Vue 3 + TypeScript personal planner for focus, time blocks, diary capture, yearly goals, manual finance tracking, body metrics, a shopping list, an investment portfolio, and two Claude-powered assistants.

## Stack

- Nuxt 4 SSR with Nitro server routes
- Tailwind CSS with a Stitch-inspired editorial design system
- `nuxt-auth-utils` for sealed cookie sessions and Google OAuth
- Drizzle ORM on SQLite (`@libsql/client`), stored in `.data/planner.db`
- `@anthropic-ai/sdk` for the assistant and learning tabs (optional)
- Vitest and Playwright scaffolding

## Routes

- Public: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`
- Protected:
  - `/dashboard`, `/calendar`, `/priorities`, `/diary`, `/goals`
  - `/finance` with `/finance/investing`, `/finance/income`, `/finance/expenses`
  - `/investments` with `/investments/etf`, `/investments/stocks`, `/investments/options`
  - `/stats` (weekly weigh-ins and a 12-week trend), `/shopping` (short/medium/long-term list)
  - `/assistant` (AI concierge), `/learning` (AI learning notebooks)

## Local setup

1. Copy `.env.example` to `.env`.
2. Set `NUXT_SESSION_PASSWORD` to a secret with at least 32 characters.
3. Keep `NUXT_APP_ORIGIN` as a full site URL like `http://localhost:4000`.
4. Do not set `NUXT_APP_BASE_URL` unless you intentionally want a path prefix such as `/app/`.
5. Add Google OAuth credentials if you want live OAuth.
6. Set `NUXT_ANTHROPIC_API_KEY` if you want the `/assistant` and `/learning` tabs. Without it every other feature works normally and those two endpoints return a 503 explaining the key is missing.
7. Run `npm install`.
8. Run `npm run dev` — the dev server listens on port 4000 (`devServer.port` in `nuxt.config.ts`).

## Database

Data lives in a local SQLite file, `.data/planner.db` by default (override with `NUXT_DATABASE_URL`). On first boot the server applies Drizzle migrations from `./drizzle` and seeds a demo workspace with these credentials:

- Email: `founder@serene-executive.app`
- Password: `ConciergeDemo123!`

The registration flow can replace that seeded owner account, preserving the sample workspace data. `POST /api/auth/reset-demo` wipes all tables and reseeds.

Inspect the database directly with:

```bash
sqlite3 .data/planner.db "SELECT title, status FROM objectives;"
```

After changing `server/database/schema.ts`, generate a new migration with:

```bash
npm run db:generate
```

Migrations are applied automatically at server start.

## Quality checks

- `npm run typecheck`
- `npm run test`
- `npm run test:e2e`
