# Phase 1: Solid Foundation

**Theme:** Make what exists reliable, testable, and CI-gated. Zero new features — pure engineering hardening.

**Effort:** Moderate | **Depends on:** Nothing | **Status:** Complete

## Why This Phase First

The MVP works but has no safety nets. Every subsequent phase depends on being able to refactor confidently, catch regressions, and validate IPC contracts. This phase establishes the engineering floor.

## Subphases

| # | Subphase | Effort | Description |
|---|----------|--------|-------------|
| 1.1 | [Testing Infrastructure](1.1-testing-infrastructure/) | Moderate | Vitest setup, unit tests for repos/AI/automation |
| 1.2 | [IPC Schema Validation](1.2-ipc-schema-validation/) | Moderate | Zod schemas for all 25 IPC channels |
| 1.3 | [Error Handling](1.3-error-handling/) | Low-Moderate | Structured errors, React Error Boundaries |
| 1.4 | [CI/CD Pipeline](1.4-ci-cd-pipeline/) | Low-Moderate | GitHub Actions, pre-commit hooks |
| 1.5 | [Database Hardening](1.5-database-hardening/) | Low | Transactions, backups, schema validation |

## Success Criteria

- [x] `npm test` runs and passes all tests (201 tests)
- [x] `npm run test:coverage` shows >70% on `db/`, `ai/`, `automation/`
- [x] Every IPC handler validates inputs at runtime with Zod (33 channels)
- [x] Invalid IPC payloads return structured errors, not crashes
- [x] React Error Boundaries prevent one panel from crashing the whole app
- [x] Every PR gets automated lint, typecheck, test, build via GitHub Actions
- [x] SQLite backups exist before every migration
