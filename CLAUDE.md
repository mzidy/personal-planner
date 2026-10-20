# The Serene Executive — working notes

## Git workflow (required)

Never commit to `main`. Every change, however small, goes:

1. `git checkout -b <type>/<short-description>` off an up-to-date `main`
2. Commit on that branch
3. `git push -u origin <branch>`
4. `gh pr create` — open a pull request, do not merge locally
5. Merge through the pull request (`gh pr merge --squash --delete-branch`)

Branch prefixes: `feature/`, `fix/`, `chore/`, `docs/`.

Open the PR even when the work is finished and verified; the PR is the record
of what changed and why, and `main` should only ever move through one.

## Running it

```bash
npm run dev          # http://localhost:4000
npm run typecheck    # vue-tsc, must be clean before a PR
npm run test         # vitest unit tests
```

Do not set `ESBUILD_BINARY_PATH` — a Homebrew esbuild will mismatch Vite's
bundled one and the dev server dies with "service was stopped: write EPIPE".

Keep the project out of iCloud-synced folders. An evicted ("dataless") file
makes the dev server hang at 0% CPU inside a blocking `pread()`.

## Database

One code path, two targets, chosen by environment:

- **No `TURSO_DATABASE_URL`** → local file `.data/planner.db` via the native
  `@libsql/client`, with migrations applied at boot.
- **`TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`** → hosted Turso via
  `@libsql/client/web` and `drizzle-orm/libsql/web`.

Three things that are easy to get wrong:

- A file-backed database **cannot** work on a serverless host. The filesystem is
  read-only and per-instance, so writes are lost rather than refused.
- Import `drizzle-orm/libsql/web` for remote. The node driver imports
  `@libsql/client`, and that static import alone pulls in native bindings that
  break the deployed function with `Cannot find module '@libsql/linux-x64-gnu'`.
- Migrations **cannot** run on Vercel. Drizzle's migrator reads `drizzle/` from
  disk and that folder is not in the serverless bundle. Apply them from a
  developer machine instead.

```bash
npm run db:generate   # create a migration after changing schema.ts
npm run db:deploy     # apply migrations to Turso (needs both TURSO_ vars)
npm run db:copy-user  # copy one user's rows from local SQLite to Turso
```

## Deployment

Vercel project `personal-planner` in team `mzi1`, live at
<https://personal-planner-sandy.vercel.app>.

```bash
NITRO_PRESET=vercel npx nuxt build
vercel deploy --prebuilt --prod --scope mzi1 --yes
```

`/api/health` reports which database is actually in use — it does not run a
query, so a 200 there is not evidence that the database works. Check
`/api/auth/bootstrap` for that.

## Conventions

- Components in `app/components/ui` are registered **without** a path prefix
  (`<PanelCard>`, `<StatusPill>`); everything else keeps Nuxt's default prefix
  (`AppPageHero`, `FinanceSectionView`). This is set in `nuxt.config.ts` and is
  not optional — without it those components silently render as inert custom
  elements with no styling at all.
- The theme flattens `teal` to a single token, so `text-teal-600` and the rest
  of the numeric Tailwind scale do not exist. Use `text-teal`.
- A page that needs sub-pages lives at `pages/<name>/index.vue`. Never keep both
  `pages/x.vue` and `pages/x/`; the former becomes a parent layout and every
  child renders the parent unless it includes `<NuxtPage />`.
- Pure logic worth trusting (indicators, financial maths) goes in `shared/utils`
  with unit tests, not inline in a component.
- `useFetch` data is a shallow ref. Replace `data.value` with a new object;
  mutating a nested field saves nothing visible.

## Claude features

The assistant, the learning notebook and Claudemy need `NUXT_ANTHROPIC_API_KEY`
(in `.env` locally, and in Vercel for production); without it they answer 503.

Claudemy (AI Learning → Claudemy) cannot run as one long job: a Vercel function
gets 300 s (`nitro.vercel.functions.maxDuration`). `server/utils/claudemy-pipeline.ts`
does one bounded step per request and saves the result; the course page calls
the step endpoint in a loop. Keep any new step well under that limit. Citations
are checked in code (`shared/utils/claudemy-check.ts`) against the pages that
were actually fetched, never against what the model says it read.

## Smart Home (Roborock)

The vacuum is reached through Roborock's cloud, the same way the Roborock app
does it: login by emailed code (`server/utils/roborock-api.ts`), then one MQTT
connection per request (`server/utils/roborock-mqtt.ts`), because a serverless
function cannot keep one open. The wire format lives in
`server/utils/roborock-protocol.ts` and is checked byte for byte in tests
against vectors computed independently from python-roborock's definitions;
change it only with a new vector.

The Roborock session and device keys are sealed with a key derived from
`NUXT_SESSION_PASSWORD` (`server/utils/secret-box.ts`). Rotating that password
logs the account out here, and it has to be connected again. Only "1.0"
(V1) devices are supported; A01/B01/L01 devices are listed but not controlled.
