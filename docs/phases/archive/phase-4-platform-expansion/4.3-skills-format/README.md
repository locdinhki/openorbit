# 4.3: Skills Format Evolution (COMPLETE ✓)

**Effort:** Moderate | **Status:** Complete

## Background

From [OpenClaw Analysis Section 4G](../../research/openclaw-analysis.md): Evolve JSON hint files into richer markdown-based skills combining natural language instructions + selectors + examples. The agent could eventually write its own skills.

## Tasks

### Design Skills Schema
- [x] Define markdown + YAML frontmatter format:
  ```markdown
  ---
  name: linkedin-easy-apply
  platform: linkedin
  version: 2
  triggers: ["apply_to_job", "click_easy_apply"]
  ---
  # LinkedIn Easy Apply

  ## Steps
  1. Click the "Easy Apply" button
     - selectors: [".jobs-apply-button", "button[aria-label='Easy Apply']"]
     - fallback_text: ["Easy Apply"]

  2. Fill contact information
     - selectors: ...
  ```

### Create Skills Loader
- [x] Create `src/main/automation/skills-loader.ts`:
  - Parse markdown + YAML frontmatter
  - Convert to internal `SiteHintFile` format for backward compatibility
  - Support both JSON and markdown formats during migration period
  - Progressive loading: only load full skill when triggered (frontmatter loaded at startup)

### Migrate Existing Hints
- [x] Convert `hints/linkedin-jobs.json` → `hints/linkedin-jobs.md`
- [x] Keep JSON as fallback (loader checks both)
- [x] Migrate Indeed and Upwork hints if they exist

### Self-Modifying Skills (stretch)
- [x] When the agent encounters a new page layout and solves it, write a new skill file
- [x] Store in `{userData}/skills/` directory (user-owned, not in app bundle)

## Files to Create

```
src/main/automation/skills-loader.ts
hints/linkedin-jobs.md
```

## Files to Modify

```
src/main/automation/hint-executor.ts (use skills-loader)
```

## Success Criteria

- [x] Markdown skills parsed correctly with selectors and fallbacks
- [x] Backward compatible with existing JSON hint files
- [x] Skills are human-readable and git-diffable
