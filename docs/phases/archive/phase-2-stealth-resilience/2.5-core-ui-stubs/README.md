# 2.5: Core UI Stubs

**Effort:** Moderate | **Status:** Complete

## Goal

Implement the renderer component stubs needed for Phase 2 features (Jobs browsing, Chat, Application review, Browser panel) to be usable.

## Tasks

### Hooks
- [x] `src/renderer/src/hooks/useJobs.ts` — Wire IPC calls to Zustand jobs slice
- [x] `src/renderer/src/hooks/useBrowser.ts` — Wire browser session IPC to store

### Job Components
- [x] `src/renderer/src/components/Jobs/JobCard.tsx` — Job listing card with title, company, score badge, status
- [x] `src/renderer/src/components/Jobs/JobList.tsx` — Scrollable list of JobCards with loading/empty states
- [x] `src/renderer/src/components/Jobs/JobDetail.tsx` — Full job details view with analysis, red flags, highlights
- [x] `src/renderer/src/components/Jobs/JobFilters.tsx` — Filter by status, platform, score range, profile
- [x] `src/renderer/src/components/Jobs/MatchBadge.tsx` — Visual score indicator (color-coded)

### Chat Components
- [x] `src/renderer/src/components/Chat/ChatPanel.tsx` — Chat container with message list and input
- [x] `src/renderer/src/components/Chat/ChatMessage.tsx` — Individual message bubble (user/assistant)
- [x] `src/renderer/src/components/Chat/ChatInput.tsx` — Text input with send button

### Application Components
- [x] `src/renderer/src/components/Application/ApplicationQueue.tsx` — Queue of pending applications with status
- [x] `src/renderer/src/components/Application/AnswerEditor.tsx` — Edit AI-generated answers before submission
- [x] `src/renderer/src/components/Application/ResumeSelector.tsx` — Choose which resume to use
- [x] `src/renderer/src/components/Application/CoverLetterPreview.tsx` — Preview generated cover letter

## Files to Modify

All files listed above (all are existing stubs with `// TODO` comments).

## Success Criteria

- [x] Job list displays extracted jobs with filtering
- [x] Chat panel sends messages and displays Claude responses
- [x] Application queue shows pending applications with approve/reject actions
- [x] All components use the typed IPC client from Phase 1.2
