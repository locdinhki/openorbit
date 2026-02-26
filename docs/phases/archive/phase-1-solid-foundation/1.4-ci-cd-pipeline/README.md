# 1.4: CI/CD Pipeline

**Effort:** Low-Moderate | **Status:** Complete

## Goal

Automate quality gates so every PR is lint-checked, type-checked, tested, and built. Tagged releases produce downloadable artifacts.

## Tasks

### CI Workflow
- [x] Create `.github/workflows/ci.yml`
  - **Trigger:** push to `main`, all PRs
  - **Steps (sequential gates):**
    1. `npm run lint` — ESLint
    2. `npx tsc --noEmit` — TypeScript type check
    3. `npm test` — Vitest
    4. `npm run build` — electron-vite build
  - **Matrix:** build step on `ubuntu-latest`, `macos-latest`, `windows-latest`; tests on ubuntu only
  - **Cache:** `node_modules` keyed on `package-lock.json` hash
  - **Node version:** 22.x (matches OpenClaw's minimum)

### Release Workflow
- [x] Create `.github/workflows/release.yml`
  - **Trigger:** tag push matching `v*`
  - Build on all 3 platforms using electron-builder
  - Upload artifacts to GitHub Releases
  - (Code signing deferred to Phase 4.5)

### Pre-Commit Hooks
- [x] Install `husky` and `lint-staged`
- [x] Create `.husky/pre-commit` hook
- [x] Configure `lint-staged` in `package.json`:
  - `*.{ts,tsx}` → `prettier --check` + `eslint`
  - Prevents CI failures from formatting issues

## Files to Create

```
.github/workflows/ci.yml
.github/workflows/release.yml
.husky/pre-commit
```

## Files to Modify

```
package.json (add husky, lint-staged, scripts)
```

## Success Criteria

- [x] Every PR gets automated lint, typecheck, test, build
- [x] Failing tests block merge
- [x] Tagged releases (`v*`) produce downloadable artifacts for macOS, Windows, Linux
- [x] Pre-commit hooks catch formatting issues locally
