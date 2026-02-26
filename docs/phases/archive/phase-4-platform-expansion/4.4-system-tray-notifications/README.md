# 4.4: System Tray + Desktop Notifications (COMPLETE ✓)

**Effort:** Low | **Status:** Complete

## Goal

Implement the stubbed tray icon and notification system for a production-grade desktop experience.

## Tasks

### System Tray
- [x] Implement `src/main/tray.ts`:
  - Show app icon in menu bar (macOS) / system tray (Windows/Linux)
  - Context menu items:
    - Show/Hide window
    - Start/Stop automation
    - Current status indicator
    - Quit
  - Minimize to tray instead of closing (configurable)
  - Animated/colored icon to indicate automation status (idle, running, error)
- [x] Initialize tray in `src/main/index.ts` on app ready

### Desktop Notifications
- [x] Implement `src/main/utils/notifier.ts`:
  - Use Electron's `Notification` API
  - Notification triggers:
    - High-match job found (score >= autoApplyThreshold)
    - Application completed successfully
    - Application failed or needs attention
    - Scheduled run complete with summary
    - Circuit breaker tripped
  - Respect user notification preferences from settings
  - Clicking notification focuses the app and navigates to relevant content

## Files to Modify

```
src/main/tray.ts (implement from stub)
src/main/utils/notifier.ts (implement from stub)
src/main/index.ts (initialize tray)
```

## Success Criteria

- [x] Tray icon visible in menu bar / system tray
- [x] Context menu works for show/hide, start/stop, quit
- [x] Desktop notifications fire for important events
- [x] Notifications are configurable (can be disabled per event type)
