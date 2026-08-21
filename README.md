# The Serene Executive

Nuxt 4 + Vue 3 + TypeScript personal planner for focus, time blocks, diary capture, yearly goals, manual finance tracking, and a read-only AI brief.

## Stack

- Nuxt 4 SSR with Nitro server routes
- Tailwind CSS with a Stitch-inspired editorial design system
- `nuxt-auth-utils` for sealed cookie sessions and Google OAuth
- Drizzle ORM on SQLite (`better-sqlite3`), stored in `.data/planner.db`
- Vitest and Playwright scaffolding

## Routes

- Public: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`
- Protected: `/dashboard`, `/calendar`, `/priorities`, `/diary`, `/goals`, `/finance`, `/assistant`

## Local setup

1. Copy `.env.example` to `.env`.
2. Set `NUXT_SESSION_PASSWORD` to a secret with at least 32 characters.
3. Keep `NUXT_APP_ORIGIN` as a full site URL like `http://localhost:4000`.
4. Do not set `NUXT_APP_BASE_URL` unless you intentionally want a path prefix such as `/app/`.
5. Add Google OAuth credentials if you want live OAuth.
6. Run `npm install`.
7. Run `npm run dev`.

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
