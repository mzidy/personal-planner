# The Serene Executive

Nuxt 4 + Vue 3 + TypeScript personal planner for focus, time blocks, diary capture, yearly goals, manual finance tracking, and a read-only AI brief.

## Stack

- Nuxt 4 SSR with Nitro server routes
- Tailwind CSS with a Stitch-inspired editorial design system
- `nuxt-auth-utils` for sealed cookie sessions and Google OAuth
- Drizzle ORM schema and PostgreSQL-ready configuration
- Demo storage fallback for local exploration when `DATABASE_URL` is not configured
- Vitest and Playwright scaffolding

## Routes

- Public: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`
- Protected: `/dashboard`, `/calendar`, `/priorities`, `/diary`, `/goals`, `/finance`, `/assistant`

## Local setup

1. Copy `.env.example` to `.env`.
2. Set `NUXT_SESSION_PASSWORD` to a secret with at least 32 characters.
3. Keep `NUXT_APP_ORIGIN` as a full site URL like `http://localhost:3000`.
4. Do not set `NUXT_APP_BASE_URL` unless you intentionally want a path prefix such as `/app/`.
5. Add Google OAuth credentials if you want live OAuth.
6. Run `npm install`.
7. Run `npm run dev`.

## Demo mode

If `NUXT_DATABASE_URL` is empty, the app boots in demo storage mode with seeded data and demo credentials:

- Email: `founder@serene-executive.app`
- Password: `ConciergeDemo123!`

The registration flow can still replace that seeded owner account, preserving the sample workspace data.

## Database mode

When `NUXT_DATABASE_URL` is present, the project exposes:

- Drizzle schema in [server/database/schema.ts](/Users/mihazidar/Documents/Playground/personal-planner-app/server/database/schema.ts)
- Drizzle config in [drizzle.config.ts](/Users/mihazidar/Documents/Playground/personal-planner-app/drizzle.config.ts)
- Lazy PostgreSQL client in [server/database/client.ts](/Users/mihazidar/Documents/Playground/personal-planner-app/server/database/client.ts)

Generate migrations with:

```bash
npm run db:generate
```

## Quality checks

- `npm run typecheck`
- `npm run test`
- `npm run test:e2e`

## Note on this environment

In this Codex sandbox, the workspace `esbuild` binary cannot execute directly, so local verification may require setting `ESBUILD_BINARY_PATH=/opt/homebrew/bin/esbuild` while running Nuxt and Vitest commands. This is an environment quirk, not an app runtime requirement.
