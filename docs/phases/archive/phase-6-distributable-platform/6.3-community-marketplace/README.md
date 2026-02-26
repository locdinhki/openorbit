# 6.3: Community Marketplace (COMPLETE ✓)

**Effort:** High | **Status:** Complete

## Background

From [OpenClaw Analysis Section 4M](../../research/openclaw-analysis.md): Scale beyond one person's efforts through community-contributed skills, platform adapters, and answer templates.

## Tasks

### Skills Repository
- [x] GitHub-based marketplace for shared skills files
- [x] CLI command: `openorbit skills install @community/glassdoor`
- [x] Skills registry: JSON index of available skills with metadata
- [x] Version management: semantic versioning per skill
- [x] Install location: `{userData}/skills/community/`

### Community Platform Adapters
- [x] Platform adapters as separate npm packages:
  - `@openorbit/glassdoor`
  - `@openorbit/dice`
  - `@openorbit/wellfound`
  - `@openorbit/monster`
- [x] Adapter discovery: scan `node_modules/@openorbit/` for packages with `openorbit-adapter` keyword
- [x] Template repository for creating new adapters

### Answer Template Sharing
- [x] Opt-in: users can contribute successful answers (anonymized)
- [x] Aggregated templates for common application questions
- [x] Quality scoring based on application success rates
- [x] Privacy: no PII, no company-specific details, user reviews before sharing

### Contribution Workflow
- [x] `openorbit skills publish` — publish a skill to the registry
- [x] GitHub PR-based review for quality control
- [x] Automated testing: validate skill format, check selectors against live sites

## Success Criteria

- [x] Community skills installable with one command
- [x] At least 3 community-contributed platform adapters
- [x] Answer template sharing works with privacy controls
- [x] Contribution workflow documented and accessible
