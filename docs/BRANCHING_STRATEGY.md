# EduLanka — Branching Strategy

We follow a **GitFlow variant** optimised for a small core team shipping in sprints.

## Branch Hierarchy

```
main               ← production-ready, tagged releases only
  └── develop      ← integration branch, always deployable to staging
        └── feature/sprint-0/monorepo-setup      ← feature work
        └── feature/phase-1/auth-module
        └── fix/phase-1/jwt-refresh-bug
        └── chore/infra/nginx-rate-limit-tuning
        └── release/v0.1.0                         ← release prep
```

## Branch Naming Convention

```
<type>/<phase-or-sprint>/<short-description>
```

| Type | When to use |
|---|---|
| `feature/` | New functionality |
| `fix/` | Bug fix |
| `hotfix/` | Critical prod fix — branches from `main` |
| `chore/` | Tooling, infra, CI, deps |
| `docs/` | Doc-only changes |
| `release/` | Release prep (version bump, changelog) |

## Workflow

1. **Branch from `develop`** (or `main` for hotfixes)
2. **Open a Draft PR** early — keeps the team aware of in-progress work
3. **CI must pass** before requesting review (lint → typecheck → build → test)
4. **At least 1 approval** required to merge to `develop`
5. **Squash merge** to `develop` — keeps history linear and readable
6. **Merge `develop` → `main`** via a release branch when ready (no force-push to `main`)

## Release Process

1. Cut `release/vX.Y.Z` from `develop`
2. Bump versions (`pnpm changeset version`)
3. Update `CHANGELOG.md`
4. Open PR to `main` — requires 1 lead approval
5. Tag `vX.Y.Z` on `main` after merge
6. Merge `main` back into `develop` to sync

## Protected Branches

| Branch | Rules |
|---|---|
| `main` | No direct push; force-push disabled; requires PR + 1 approval |
| `develop` | No direct push; CI must pass; requires PR |
