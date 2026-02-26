# 5.3: CLI Tool (COMPLETE ✓)

**Effort:** Moderate | **Status:** Complete

## Goal

Build a headless CLI tool that uses `@openorbit/core` for job searching, analyzing, and applying without a GUI.

## Commands

```bash
# Search for jobs
openorbit search --profile "senior react" --limit 20 --platform linkedin

# Analyze a specific job
openorbit analyze --job-id <id>

# Apply to a job
openorbit apply --job-id <id> --resume default

# Create a schedule
openorbit schedule create --cron "0 8 * * 1-5" --profile "senior react"

# Check status
openorbit status

# Export jobs
openorbit export --format csv --output jobs.csv

# Interactive TUI mode
openorbit
```

## Tasks

### CLI Framework
- [x] Create `packages/cli/src/index.ts`:
  - Use `commander` or `yargs` for command parsing
  - Global options: `--config`, `--data-dir`, `--verbose`
  - Auto-detect data dir (use same as Electron app by default)

### Commands
- [x] `search` — headless job extraction using core's ExtractionRunner
- [x] `analyze` — run Claude analysis on a specific job
- [x] `apply` — submit application for a job
- [x] `schedule` — CRUD for cron schedules
- [x] `status` — show current automation status, recent sessions
- [x] `export` — export jobs to CSV/JSON

### Interactive TUI (stretch)
- [x] Use `@clack/prompts` for interactive mode
- [x] Job list with arrow-key navigation
- [x] Approve/reject/skip jobs
- [x] View job details

### Distribution
- [x] Publish to npm: `npm install -g @openorbit/cli`
- [x] Or use npx: `npx @openorbit/cli search --profile "senior react"`

## Files to Create

```
packages/cli/src/index.ts
packages/cli/src/commands/search.ts
packages/cli/src/commands/analyze.ts
packages/cli/src/commands/apply.ts
packages/cli/src/commands/schedule.ts
packages/cli/src/commands/status.ts
packages/cli/src/commands/export.ts
packages/cli/package.json
```

## Success Criteria

- [x] `openorbit search` runs headlessly and outputs results to terminal
- [x] CLI shares the same database and config as the Electron app
- [x] All commands work without Electron installed
- [x] Published to npm and installable globally
