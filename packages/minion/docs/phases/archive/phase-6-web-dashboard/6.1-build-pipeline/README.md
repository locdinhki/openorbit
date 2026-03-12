# 6.1: Build Pipeline + Static Serving

**Effort:** Low | **Status:** Complete

## Tasks

- [x] Vite project under `packages/hive/dashboard/` (React + Tailwind)
- [x] `npm run build:dashboard` → outputs to `packages/hive/dist/dashboard/`
- [x] Express serves `dist/dashboard/` at `/` with SPA fallback (`index.html` for all non-API routes)
- [x] Auth gate: token from `localStorage`, validated against `/api/devices` endpoint on load
- [x] Login page: single password field, stores token in `localStorage`
- [x] Dockerfile updated to run `build:dashboard` before hive server build

## SPA Fallback Route

```typescript
// Express 5 wildcard syntax
app.get('/{*path}', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/minion')) {
    res.sendFile(join(__dirname, '../dashboard/index.html'))
  }
})
```

Note: Express 5 uses `/{*path}` not `*` (path-to-regexp v8 breaking change).

## Success Criteria

- [x] `npm run build:dashboard` succeeds with no errors
- [x] Dashboard loads at `https://hive.openorbit.ai/`
- [x] Unauthenticated requests redirect to `/login`
- [x] SPA client-side routing works (direct URL navigation doesn't 404)
- [x] Existing `/api/*` routes still work after adding static middleware
