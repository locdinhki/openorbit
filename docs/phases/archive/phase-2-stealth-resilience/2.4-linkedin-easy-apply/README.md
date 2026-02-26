# 2.4: LinkedIn Easy Apply Engine

**Effort:** High | **Status:** Complete

> The highest-impact feature in the roadmap. `linkedin-applicator.ts` is currently a 2-line stub.

## Tasks

### Implement LinkedInApplicator
- [x] Create the full application flow in `src/main/platforms/linkedin/linkedin-applicator.ts`:
  1. Click "Easy Apply" button
  2. Detect multi-step form (LinkedIn uses 1-6 step forms)
  3. Fill contact information (name, email, phone)
  4. Upload resume from configured file path
  5. Detect question types:
     - Text input (free text)
     - Select dropdown
     - Radio buttons
     - Checkboxes
     - Numeric input (years of experience)
  6. Answer questions:
     - Check `AnswersRepo` for known templates first
     - Fall back to `AnswerGenerator` for AI-generated answers
  7. Handle "Review" step before final submission
  8. Detect success/failure after submission
  9. Use `HumanBehavior` for all interactions (typing, delays, scrolling)

### Add Easy Apply Hints
- [x] Add action entries to `hints/linkedin-jobs.json`:
  - `click_easy_apply` — Easy Apply button selectors
  - `fill_contact_info` — Contact form fields
  - `upload_resume` — File upload input
  - `detect_questions` — Question container selectors
  - `answer_question` — Input field selectors by type
  - `click_next_step` — "Next" button selectors
  - `click_review` — "Review" button selectors
  - `click_submit` — "Submit application" button selectors
  - Each with multiple selector fallbacks

### Wire Into Adapter
- [x] Update `src/main/platforms/linkedin/linkedin-adapter.ts`:
  - Replace stub `applyToJob()` with orchestrated flow
  - Call applicator → save results → update job status → log action

### Wire IPC Channels
- [x] Implement in `src/main/ipc-handlers.ts`:
  - `APPLICATION_START` — begin application for a specific job
  - `APPLICATION_PROGRESS` — push progress updates to renderer
  - `APPLICATION_PAUSE_QUESTION` — pause for user review on custom questions
  - `APPLICATION_ANSWER` — receive user's edited answer
  - `APPLICATION_COMPLETE` — notify success/failure

### Pause-for-Review Flow
- [x] When autonomy settings require pause (custom questions, salary, low confidence):
  1. Emit `APPLICATION_PAUSE_QUESTION` to renderer with question details
  2. Renderer shows question in `AnswerEditor` component
  3. User approves or edits answer
  4. User sends back via `APPLICATION_ANSWER`
  5. Applicator resumes form filling

## Files to Create/Modify

```
src/main/platforms/linkedin/linkedin-applicator.ts (implement)
hints/linkedin-jobs.json (add Easy Apply actions)
src/main/platforms/linkedin/linkedin-adapter.ts (wire applyToJob)
src/main/ipc-handlers.ts (application channels)
```

## Success Criteria

- [x] Can complete a LinkedIn Easy Apply end-to-end
- [x] Multi-step forms handled correctly (1-6 steps)
- [x] Custom questions pause for review at autonomy level 1-2
- [x] Application results saved to DB with answers, resume, cover letter used
- [x] Rate limiter enforces application caps
