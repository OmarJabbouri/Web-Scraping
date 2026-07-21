<!-- Keep this PR focused on one phase / feature. Delete any section that doesn't apply. -->

## Summary

<!-- One or two sentences: what does this PR add and why? -->

**Phase / tasks:** <!-- e.g. Phase 2 — tasks 2.1–2.6 (see tasks.md) -->

## Changes

<!-- Bullet the concrete changes. Add a line per step as you push. -->

-
-

## How to test

<!-- Exact commands a reviewer can run. -->

```bash
docker compose up -d postgres redis
npm run build
# ...
```

## Type of change

- [ ] New feature
- [ ] Bug fix
- [ ] Refactor / cleanup
- [ ] Docs / report
- [ ] Infra / CI / Docker

## Checklist

- [ ] `npm run build` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] Tests / manual verification done (describe above)
- [ ] `tasks.md` checkboxes updated for the completed tasks
- [ ] Env vars documented in `.env.example` (if any were added)

## Notes for reviewer

<!-- Anything left for a later phase, trade-offs, or things to look at closely. -->
