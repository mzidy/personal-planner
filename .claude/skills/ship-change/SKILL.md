---
name: ship-change
description: Ship a change to this repo through a branch and a pull request. Use whenever work in personal-planner-app is ready to commit — this project never commits to main. Covers branching, the pre-PR checks, opening the PR with gh, and merging it.
---

# Shipping a change

`main` only ever moves through a pull request. This applies to every change,
including one-line fixes and anything already verified in the browser.

## 1. Branch

Start from an up-to-date `main`:

```bash
git checkout main && git pull
git checkout -b <type>/<short-description>
```

Prefixes: `feature/`, `fix/`, `chore/`, `docs/`.

If work was already done on `main` by mistake, move it across before
committing — `git checkout -b <branch>` carries uncommitted changes with it.

## 2. Check before committing

Both must be clean. A PR that fails these wastes a review cycle.

```bash
npm run typecheck
npm run test
```

Then confirm nothing sensitive is staged. `.env`, `.env.local`,
`.vercel/project.json` and `.data/planner.db` are gitignored, but verify rather
than assume:

```bash
git add -A
git diff --cached | grep -inE "eyJ[A-Za-z0-9_-]{20,}|sk-ant-|ghp_|TURSO_AUTH_TOKEN=[A-Za-z0-9]"
```

Any hit that is not a documentation placeholder must be removed before the
commit, not after — rewriting published history is far worse than catching it
here.

## 3. Commit

Write the message for someone who was not here. Say what changed and why; name
bugs that were fixed in passing, since those are the ones nobody remembers the
reason for later.

End the message with:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

## 4. Open the pull request

```bash
git push -u origin <branch>
gh pr create --fill
```

For a longer description, use `--title` and `--body` instead of `--fill`. End
the body with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Hand the user the PR URL. Do not merge without being asked.

## 5. Merge

When the user asks for it:

```bash
gh pr merge --squash --delete-branch
```

Then return to `main` and pull:

```bash
git checkout main && git pull
```

## If the change is already deployed

Deploys run from a local build (`vercel deploy --prebuilt`), not from git, so a
live site can be ahead of `main`. When that happens, say so plainly — the repo
and production are out of sync until the PR lands.
