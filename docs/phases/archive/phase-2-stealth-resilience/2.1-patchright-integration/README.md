# 2.1: Patchright Integration

**Effort:** Minimal | **Status:** Complete

> Highest ROI task in the entire roadmap. One import change eliminates the #1 detection vector.

## Background

From [OpenClaw Analysis Section 3](../../research/openclaw-analysis.md): `Runtime.enable` is the primary signal anti-bot systems use to detect Playwright. Vanilla Playwright always sends this CDP command. Patchright is a patched fork that removes it — same API, zero detection artifacts.

## Tasks

- [x] `npm install patchright`
- [x] Update imports from `'playwright'` to `'patchright'` in all files:
  - `src/main/automation/session-manager.ts`
  - `src/main/automation/hint-executor.ts`
  - `src/main/automation/page-reader.ts`
  - `src/main/automation/human-behavior.ts`
  - `src/main/automation/action-engine.ts`
  - `src/main/platforms/platform-adapter.ts`
  - `src/main/platforms/linkedin/linkedin-adapter.ts`
  - `src/main/platforms/linkedin/linkedin-extractor.ts`
- [x] Remove redundant anti-detection init scripts from `SessionManager` that Patchright handles natively (webdriver override, plugin spoofing)
- [x] Verify `navigator.webdriver === false`
- [x] Verify `__playwright__binding__` and `__pwInitScripts` absent from window
- [x] Run existing automation against LinkedIn to confirm no regressions

## What Patchright Removes

| Detection Signal | Vanilla Playwright | Patchright |
|-----------------|-------------------|------------|
| `Runtime.enable` leak | Present | Removed |
| `Console.enable` leak | Present | Removed |
| `navigator.webdriver` | True by default | Patched to false |
| `__playwright__binding__` | Present | Removed |
| `__pwInitScripts` | Present | Removed |

## Files to Modify

```
package.json (add patchright, consider removing playwright)
src/main/automation/session-manager.ts
src/main/automation/hint-executor.ts
src/main/automation/page-reader.ts
src/main/automation/human-behavior.ts
src/main/automation/action-engine.ts
src/main/platforms/platform-adapter.ts
src/main/platforms/linkedin/linkedin-adapter.ts
src/main/platforms/linkedin/linkedin-extractor.ts
```

## Success Criteria

- [x] `Runtime.enable` no longer sent (verify via CDP logging)
- [x] All 5 detection signals from the table above are absent
- [x] All existing automation flows work identically
