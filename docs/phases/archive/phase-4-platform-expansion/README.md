# Phase 4: Platform Expansion (COMPLETE ✓)

**Theme:** Expand beyond LinkedIn to Indeed and Upwork. Desktop integration. Release infrastructure.

**Effort:** High | **Depends on:** Phase 3 | **Status:** Complete

## Why This Phase

LinkedIn is the foundation, but contractors work across multiple platforms. The memory system and scheduling from Phase 3 make multi-platform operation practical. Desktop integration (tray, notifications, auto-update) makes the app feel production-grade.

## Subphases

| # | Subphase | Effort | Description |
|---|----------|--------|-------------|
| 4.1 | [Indeed Adapter](4.1-indeed-adapter/) | Moderate | Full PlatformAdapter implementation for Indeed |
| 4.2 | [Upwork Adapter](4.2-upwork-adapter/) | Moderate-High | Proposal-based flow for Upwork freelance marketplace |
| 4.3 | [Skills Format](4.3-skills-format/) | Moderate | Evolve JSON hints to markdown-based skills |
| 4.4 | [System Tray + Notifications](4.4-system-tray-notifications/) | Low | Menu bar presence, desktop notifications |
| 4.5 | [Auto-Update + Release](4.5-auto-update-release/) | Low-Moderate | electron-updater with GitHub Releases, code signing |

## OpenClaw Analysis References

- 4.3: Section 4G (skills format evolution, markdown + YAML frontmatter)

## Success Criteria

- [x] Can extract jobs from Indeed with full adapter
- [x] Can extract projects and submit proposals on Upwork
- [x] Skills format supports both JSON (backward compat) and markdown
- [x] System tray icon with context menu (show/hide, start/stop, quit)
- [x] Desktop notifications for high-match jobs and completed applications
- [x] App auto-updates from GitHub Releases
- [x] Code signing works on macOS and Windows
