# 4.5: Auto-Update + Release Pipeline (COMPLETE ✓)

**Effort:** Low-Moderate | **Status:** Complete

## Goal

Wire electron-updater with GitHub Releases so users get automatic updates. Set up code signing for trusted distribution.

## Tasks

### Auto-Updater
- [x] Create `src/main/updater.ts`:
  - Use `electron-updater` (part of electron-builder)
  - Check for updates on app launch and every 4 hours
  - Show update notification in UI with changelog
  - Download in background
  - Install on user confirmation (or on next restart)
  - Handle update errors gracefully

### Publish Configuration
- [x] Update `electron-builder.yml`:
  - Replace `url: https://example.com/auto-updates` with GitHub Releases provider:
    ```yaml
    publish:
      provider: github
      owner: <github-username>
      repo: openorbit
    ```

### Code Signing
- [x] macOS:
  - Apple Developer certificate
  - Notarization via `electron-notarize`
  - Gatekeeper-approved distribution
- [x] Windows:
  - Code signing certificate (EV or standard)
  - SmartScreen reputation building

### Release Channels (stretch)
- [x] Support `stable`, `beta`, `dev` channels:
  - `stable` — npm `latest` tag, default
  - `beta` — pre-release tags (`v1.0.0-beta.1`)
  - `dev` — nightly builds from `main`

### Integration with CI
- [x] Update `.github/workflows/release.yml` to:
  - Build signed binaries
  - Publish to GitHub Releases
  - Generate changelog from commits

## Files to Create

```
src/main/updater.ts
```

## Files to Modify

```
electron-builder.yml (github releases provider, signing config)
src/main/index.ts (initialize updater)
.github/workflows/release.yml (signed builds, changelog)
```

## Success Criteria

- [x] App checks for updates and notifies user
- [x] Download and install works on macOS and Windows
- [x] macOS build passes Gatekeeper (notarized)
- [x] GitHub Releases contain all platform artifacts
