# ContractorOS — Super Prompt for Claude Code

## Project Identity

**Name:** ContractorOS
**Purpose:** An Electron-based autonomous contractor business operating system that sources opportunities, analyzes fit, and applies to jobs/contracts across multiple platforms — with Claude AI as the intelligence layer and Playwright as the browser automation engine.
**User:** Vincent — a software contractor based in Dallas, TX. Works for Hyphen Solutions (construction tech). Also does AI consulting. Wants to maintain a continuous pipeline of contract/freelance/W2 opportunities so there's never a gap between projects.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│  Electron App (ContractorOS)                         │
│                                                      │
│  ┌───────────┐  ┌───────────────┐  ┌──────────────┐ │
│  │ Control    │  │ Embedded      │  │ Claude Chat  │ │
│  │ Panel      │  │ Browser       │  │ Panel        │ │
│  │           │  │ (Playwright)  │  │              │ │
│  │ Profiles  │  │               │  │ Real-time    │ │
│  │ Job List  │  │ Live browsing │  │ analysis &   │ │
│  │ Actions   │  │ visible here  │  │ conversation │ │
│  │ Settings  │  │               │  │              │ │
│  └───────────┘  └───────────────┘  └──────────────┘ │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ Status Bar: Session | Actions/min | Queue      │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
        │                    │                │
        ▼                    ▼                ▼
   Playwright           SQLite DB        Claude API
   (browser)            (state)          (intelligence)
```

---

## Phase Plan

### Phase 1: Option A — Playwright Script Runner (Current Phase)
- Electron app with embedded Playwright browser
- Static hint-based automation with selector/text matching
- Claude API for job analysis, scoring, answer generation
- When hints fail → log failure, skip, and flag for manual review
- Goal: Get the core loop working — extract jobs, review, apply

### Phase 2: Option C — Local LLM for Action Execution
- Add a local LLM (Llama 3 8B or Mistral 7B) via Ollama
- Local LLM handles hint-to-element matching (replaces brittle selectors)
- Claude API remains for intelligence (analysis, content generation)
- Three-tier execution: Local LLM (90%) → Claude Sonnet (9%) → Claude Opus (1%)
- Goal: Self-healing automation that adapts to UI changes

### Phase 3: Option C + Fine-Tuning
- Collect action logs from Phase 2 as training data
- Fine-tune a small model (QLoRA on Llama 3 8B) specifically for browser action matching
- Custom model replaces generic local LLM for even faster/more accurate execution
- Goal: Purpose-built action model trained on real usage patterns

**BUILD PHASE 1 ONLY. Design the architecture so Phase 2 and 3 are clean upgrades, not rewrites.**

---

## Tech Stack

```
Runtime & UI:
  - Electron (latest stable)
  - React + TypeScript (renderer)
  - Tailwind CSS (styling)
  - Zustand or Redux Toolkit (state management)

Browser Automation:
  - Playwright (NOT Puppeteer — Playwright has better API, multi-browser, built-in session persistence)
  - Run in headed mode (visible browser inside Electron or external window)
  - Use Chromium channel="chrome" for realistic fingerprinting

Database:
  - SQLite via better-sqlite3 (local, fast, no server)
  - Stores: jobs, applications, search profiles, answer templates, action logs, hint files

AI:
  - Claude API (Anthropic SDK)
    - Sonnet for real-time analysis, scoring, quick answers
    - Opus for cover letters, complex analysis, strategy
  - Phase 2: Ollama for local LLM
  - Phase 3: Custom fine-tuned model

IPC:
  - Electron IPC bridge between renderer (React UI) and main process (Playwright + Claude)
```

---

## Core Data Models

### Search Profile
```typescript
interface SearchProfile {
  id: string;
  name: string;
  enabled: boolean;
  platform: 'linkedin' | 'indeed' | 'upwork' | 'dice' | 'wellfound' | 'glassdoor';
  search: {
    keywords: string[];
    location: string[];
    datePosted: 'past24hrs' | 'pastWeek' | 'pastMonth';
    experienceLevel: string[];
    jobType: ('full-time' | 'contract' | 'freelance' | 'part-time')[];
    salaryMin?: number;
    easyApplyOnly?: boolean;
    excludeTerms: string[];
    remoteOnly?: boolean;
  };
  application: {
    resumeFile: string;           // path to resume PDF
    coverLetterTemplate?: string; // path to template or "auto" for Claude-generated
    defaultAnswers: Record<string, string>;
  };
  createdAt: string;
  updatedAt: string;
}
```

### Job Listing
```typescript
interface JobListing {
  id: string;
  externalId: string;             // platform-specific ID
  platform: string;
  profileId: string;              // which search profile found this
  url: string;
  title: string;
  company: string;
  location: string;
  salary?: string;
  jobType: string;
  description: string;            // full job description text
  postedDate: string;
  easyApply: boolean;
  
  // Claude-generated fields
  matchScore?: number;            // 0-100
  matchReasoning?: string;        // why this score
  summary?: string;               // 2-3 bullet summary
  redFlags?: string[];            // concerns Claude identified
  highlights?: string[];          // strong matches Claude identified
  
  // User actions
  status: 'new' | 'reviewed' | 'approved' | 'rejected' | 'applied' | 'skipped' | 'error';
  userNotes?: string;
  reviewedAt?: string;
  appliedAt?: string;
  
  // Application details
  applicationAnswers?: Record<string, string>;  // question -> answer used
  coverLetterUsed?: string;
  resumeUsed?: string;
  
  createdAt: string;
  updatedAt: string;
}
```

### Hint File
```typescript
interface SiteHintFile {
  site: string;                    // e.g., "linkedin.com/jobs"
  lastFullScan: string;            // ISO date
  lastVerified: string;            // ISO date
  actions: {
    [intentName: string]: {
      steps: ActionStep[];
    };
  };
  changeLog: {
    date: string;
    change: string;
  }[];
}

interface ActionStep {
  intent: string;                  // what we're trying to do
  hint: {
    selectors: string[];           // CSS selectors to try, ordered by confidence
    textMatches: string[];         // text content to look for
    ariaLabels: string[];          // accessibility labels
    location: string;              // human description of where on page
    elementType: string;           // button, input, link, etc.
  };
  fallbackDescription: string;     // natural language for Claude/LLM fallback
  lastVerified: string;
  confidence: number;              // 0-1, decreases over time if not verified
  failureCount: number;            // increments on failure, resets on success
}
```

### Action Log (for Phase 3 training data)
```typescript
interface ActionLog {
  id: string;
  timestamp: string;
  site: string;
  url: string;
  intent: string;
  pageSnapshot: string;            // accessibility tree or key elements
  hintUsed: ActionStep;
  executionMethod: 'hint' | 'local_llm' | 'claude_sonnet' | 'claude_opus' | 'manual';
  action: {
    type: 'click' | 'type' | 'select' | 'scroll' | 'navigate' | 'upload' | 'wait';
    target: string;                // selector or description used
    value?: string;                // for type/select actions
  };
  success: boolean;
  errorMessage?: string;
  correctedAction?: {              // if Claude or user corrected the action
    target: string;
    value?: string;
  };
}
```

### User Profile (for Claude context)
```typescript
interface UserProfile {
  name: string;
  title: string;
  location: string;
  summary: string;                 // professional summary
  skills: string[];
  experience: {
    role: string;
    company: string;
    duration: string;
    description: string;
  }[];
  education: {
    degree: string;
    school: string;
    year: string;
  }[];
  preferences: {
    targetRoles: string[];
    targetCompensation: { min: number; max: number; type: 'hourly' | 'annual' };
    workTypes: string[];           // W2, 1099, freelance, retainer, etc.
    remotePreference: 'remote' | 'hybrid' | 'onsite' | 'any';
    dealbreakers: string[];        // things that auto-reject
    priorities: string[];          // what matters most (ordered)
  };
  resumes: {
    name: string;
    file: string;
    targetRoles: string[];         // which roles this resume is for
  }[];
}
```

---

## Automation Engine Design (Phase 1)

### Execution Flow

```
ActionEngine.execute(intent, context)
    │
    ▼
1. Load hint file for current site
    │
    ▼
2. Find matching intent in hints
    │
    ├── Found with confidence > 0.7?
    │   │
    │   ▼
    │   Try hint-based execution:
    │     a. Try each selector in order
    │     b. Try text matching
    │     c. Try aria labels
    │     │
    │     ├── Success → log action, update confidence, continue
    │     └── Failure → increment failureCount, go to fallback
    │
    └── Not found or confidence < 0.7?
        │
        ▼
3. Fallback: Flag for review, log the failure
   (Phase 1: skip and notify user)
   (Phase 2: escalate to local LLM)
   (Phase 3: escalate to fine-tuned model)
    │
    ▼
4. Log everything to ActionLog (training data for Phase 3)
```

### Key Design Principle: The ActionEngine Interface

```typescript
// This interface stays the same across all phases.
// Only the implementation changes.

interface ActionExecutor {
  // Given an intent and page context, figure out what to do and do it.
  execute(intent: string, context: PageContext): Promise<ActionResult>;
}

// Phase 1: HintBasedExecutor
//   Tries selectors and text matching from hint files.
//   Falls back to: skip + flag for user.

// Phase 2: LLMExecutor  
//   Uses local LLM to match hints to page elements.
//   Falls back to: Claude Sonnet API.

// Phase 3: FineTunedExecutor
//   Uses custom fine-tuned model for action matching.
//   Falls back to: generic local LLM → Claude Sonnet.

class ActionEngine {
  private executor: ActionExecutor;
  private logger: ActionLogger;
  
  // Swap executor without changing anything else
  setExecutor(executor: ActionExecutor): void;
  
  // Universal execution method
  async performIntent(intent: string, page: Page): Promise<ActionResult>;
}
```

### Hint-Based Executor (Phase 1 Implementation)

```typescript
class HintBasedExecutor implements ActionExecutor {
  async execute(intent: string, context: PageContext): Promise<ActionResult> {
    const hints = await this.loadHints(context.site);
    const actionHints = hints.actions[intent];
    
    if (!actionHints || actionHints.steps[0].confidence < 0.7) {
      return { success: false, method: 'hint', needsEscalation: true };
    }
    
    for (const step of actionHints.steps) {
      // Try CSS selectors
      for (const selector of step.hint.selectors) {
        try {
          const element = await context.page.waitForSelector(selector, { timeout: 3000 });
          if (element) {
            await this.performAction(element, step, context);
            step.confidence = Math.min(1, step.confidence + 0.05);
            step.failureCount = 0;
            step.lastVerified = new Date().toISOString();
            return { success: true, method: 'hint', selector };
          }
        } catch { continue; }
      }
      
      // Try text matching
      for (const text of step.hint.textMatches) {
        try {
          const element = await context.page.getByText(text, { exact: false }).first();
          if (element) {
            await this.performAction(element, step, context);
            return { success: true, method: 'hint_text', text };
          }
        } catch { continue; }
      }
      
      // Try aria labels
      for (const label of step.hint.ariaLabels) {
        try {
          const element = await context.page.getByRole('button', { name: label });
          if (element) {
            await this.performAction(element, step, context);
            return { success: true, method: 'hint_aria', label };
          }
        } catch { continue; }
      }
      
      // All hints failed
      step.failureCount++;
      step.confidence = Math.max(0, step.confidence - 0.15);
    }
    
    return { success: false, method: 'hint', needsEscalation: true };
  }
}
```

### Human-Like Behavior Module

**CRITICAL: All browser actions must appear human-like. This is non-negotiable.**

```typescript
class HumanBehavior {
  // Random delay between actions (never instant)
  async delay(min: number = 800, max: number = 2500): Promise<void>;
  
  // Type text character by character with variable speed
  async humanType(page: Page, selector: string, text: string): Promise<void>;
  // Each character: 50-150ms delay, occasional pauses, rare typo+backspace
  
  // Scroll naturally (not instant jumps)
  async humanScroll(page: Page, direction: 'down' | 'up', amount: number): Promise<void>;
  // Variable scroll speed, occasional pause mid-scroll
  
  // Move mouse to element with natural curve (not teleport)
  async humanMove(page: Page, element: ElementHandle): Promise<void>;
  
  // Random micro-delays that simulate reading/thinking
  async readingPause(textLength: number): Promise<void>;
  // Longer text = longer pause, 200-500ms per "sentence"
  
  // Between job listings: longer pause (simulating reading)
  async betweenListings(): Promise<void>; // 5-15 seconds
  
  // Between applications: even longer pause
  async betweenApplications(): Promise<void>; // 30-90 seconds
  
  // Occasionally do nothing (human idle behavior)
  async occasionalIdle(): Promise<void>; // 10% chance of 3-10 second pause
  
  // Session-level pacing
  static MAX_ACTIONS_PER_MINUTE: number = 8; // never exceed this
  static MAX_APPLICATIONS_PER_SESSION: number = 15;
  static MAX_EXTRACTIONS_PER_SESSION: number = 75;
  static SESSION_DURATION_MAX_MINUTES: number = 45;
}
```

---

## Claude AI Integration

### Claude's Roles

```typescript
interface ClaudeService {
  // Job Analysis
  analyzeJob(job: JobListing, profile: UserProfile): Promise<{
    matchScore: number;
    reasoning: string;
    summary: string;
    redFlags: string[];
    highlights: string[];
    recommendedResume: string;
  }>;
  
  // Answer Generation
  generateAnswer(question: string, jobContext: JobListing, profile: UserProfile): Promise<{
    answer: string;
    confidence: number;
    needsReview: boolean; // true if Claude isn't sure
  }>;
  
  // Cover Letter
  generateCoverLetter(job: JobListing, profile: UserProfile, template?: string): Promise<string>;
  
  // Chat (real-time conversation with user)
  chat(message: string, context: ConversationContext): Promise<string>;
  
  // Job Comparison
  compareJobs(jobs: JobListing[], profile: UserProfile): Promise<{
    ranking: string[];
    reasoning: string;
  }>;
  
  // Hint File Generation (for new sites)
  generateSiteHints(site: string, pageContent: string): Promise<SiteHintFile>;
  
  // Hint Repair (when actions fail)
  repairHint(failedAction: ActionLog, pageContent: string): Promise<ActionStep>;
}
```

### Claude Context Management

When calling Claude API, always include relevant context:

```typescript
function buildClaudeContext(job: JobListing, profile: UserProfile): string {
  return `
## Your Role
You are an AI assistant integrated into ContractorOS, a tool that helps Vincent 
(a software contractor) find and apply to opportunities. You have full context 
about his background, preferences, and the current job being analyzed.

## User Profile
${JSON.stringify(profile, null, 2)}

## Current Job Listing
${JSON.stringify(job, null, 2)}

## Instructions
- Be direct and concise. Vincent is reviewing many jobs quickly.
- Match scores should be honest — don't inflate.
- Flag genuine red flags, don't be overly cautious.
- When generating answers, be specific to this job, not generic.
- Frame Vincent's experience to best match what this role needs.
- Vincent is a contractor — emphasize project-based experience, fast ramp-up,
  and ability to deliver independently.
`;
}
```

### Model Selection Logic

```typescript
function selectModel(task: ClaudeTask): string {
  switch (task) {
    case 'score_job':          return 'claude-sonnet-4-5-20250929';  // fast, cheap
    case 'summarize_job':      return 'claude-sonnet-4-5-20250929';
    case 'generate_answer':    return 'claude-sonnet-4-5-20250929';  // unless complex
    case 'cover_letter':       return 'claude-opus-4-6';             // quality matters
    case 'compare_jobs':       return 'claude-opus-4-6';
    case 'chat':               return 'claude-sonnet-4-5-20250929';  // responsive
    case 'generate_hints':     return 'claude-opus-4-6';             // needs to be thorough
    case 'repair_hint':        return 'claude-sonnet-4-5-20250929';
    default:                   return 'claude-sonnet-4-5-20250929';
  }
}
```

---

## Electron App Structure

### Window Layout

Three-panel layout (resizable):

```
┌──────────┬────────────────────┬──────────────┐
│ Left     │ Center             │ Right        │
│ Panel    │ Panel              │ Panel        │
│ (300px)  │ (flexible)         │ (350px)      │
│          │                    │              │
│ Search   │ Browser View       │ Claude Chat  │
│ Profiles │ (BrowserView or    │              │
│          │  BrowserWindow)    │ Job Details  │
│ Job List │                    │              │
│          │ Shows LinkedIn,    │ Analysis     │
│ Filters  │ Indeed, etc.       │              │
│          │ live as bot works  │ Answers      │
│ Actions  │                    │ Editor       │
│          │                    │              │
│ Queue    │                    │ Action Log   │
└──────────┴────────────────────┴──────────────┘
```

### Project File Structure

```
contractor-os/
├── package.json
├── electron-builder.yml
├── tsconfig.json
├── tailwind.config.js
│
├── src/
│   ├── main/                          # Electron main process
│   │   ├── index.ts                   # App entry, window creation
│   │   ├── ipc-handlers.ts            # IPC handlers for renderer
│   │   ├── tray.ts                    # System tray (minimize to tray)
│   │   │
│   │   ├── automation/                # Browser automation engine
│   │   │   ├── action-engine.ts       # Core engine (ActionExecutor interface)
│   │   │   ├── hint-executor.ts       # Phase 1: hint-based execution
│   │   │   ├── human-behavior.ts      # Human-like delays, typing, scrolling
│   │   │   ├── session-manager.ts     # Playwright session + persistence
│   │   │   └── page-reader.ts         # Read page accessibility tree / DOM
│   │   │
│   │   ├── platforms/                 # Platform-specific logic
│   │   │   ├── platform-adapter.ts    # Base interface for all platforms
│   │   │   ├── linkedin/
│   │   │   │   ├── linkedin-adapter.ts
│   │   │   │   ├── linkedin-extractor.ts
│   │   │   │   ├── linkedin-applicator.ts
│   │   │   │   └── hints/
│   │   │   │       └── linkedin-jobs.json   # Hint file
│   │   │   ├── indeed/
│   │   │   │   ├── indeed-adapter.ts
│   │   │   │   └── hints/
│   │   │   │       └── indeed-jobs.json
│   │   │   └── upwork/
│   │   │       ├── upwork-adapter.ts
│   │   │       └── hints/
│   │   │           └── upwork-jobs.json
│   │   │
│   │   ├── ai/                        # Claude AI integration
│   │   │   ├── claude-service.ts      # API client + context management
│   │   │   ├── job-analyzer.ts        # Job scoring and analysis
│   │   │   ├── answer-generator.ts    # Application answer generation
│   │   │   ├── cover-letter.ts        # Cover letter generation
│   │   │   └── chat-handler.ts        # Real-time chat with user
│   │   │
│   │   ├── db/                        # Database layer
│   │   │   ├── database.ts            # SQLite setup + migrations
│   │   │   ├── jobs-repo.ts           # Job CRUD
│   │   │   ├── profiles-repo.ts       # Search profile CRUD
│   │   │   ├── applications-repo.ts   # Application history
│   │   │   ├── action-log-repo.ts     # Action logs (Phase 3 training data)
│   │   │   └── answers-repo.ts        # Saved answer templates
│   │   │
│   │   └── utils/
│   │       ├── logger.ts              # Structured logging
│   │       ├── rate-limiter.ts        # Action rate limiting
│   │       └── notifier.ts            # Desktop notifications
│   │
│   ├── renderer/                      # React UI (renderer process)
│   │   ├── App.tsx
│   │   ├── index.tsx
│   │   │
│   │   ├── components/
│   │   │   ├── Layout/
│   │   │   │   ├── ThreePanel.tsx     # Main 3-panel layout
│   │   │   │   ├── LeftPanel.tsx
│   │   │   │   └── RightPanel.tsx
│   │   │   │
│   │   │   ├── Profiles/
│   │   │   │   ├── ProfileList.tsx
│   │   │   │   ├── ProfileEditor.tsx
│   │   │   │   └── ProfileCard.tsx
│   │   │   │
│   │   │   ├── Jobs/
│   │   │   │   ├── JobList.tsx
│   │   │   │   ├── JobCard.tsx
│   │   │   │   ├── JobDetail.tsx
│   │   │   │   ├── JobFilters.tsx
│   │   │   │   └── MatchBadge.tsx
│   │   │   │
│   │   │   ├── Application/
│   │   │   │   ├── ApplicationQueue.tsx
│   │   │   │   ├── AnswerEditor.tsx
│   │   │   │   ├── CoverLetterPreview.tsx
│   │   │   │   └── ResumeSelector.tsx
│   │   │   │
│   │   │   ├── Chat/
│   │   │   │   ├── ChatPanel.tsx
│   │   │   │   ├── ChatMessage.tsx
│   │   │   │   └── ChatInput.tsx
│   │   │   │
│   │   │   ├── Browser/
│   │   │   │   └── BrowserPanel.tsx   # Embedded browser view wrapper
│   │   │   │
│   │   │   ├── Dashboard/
│   │   │   │   ├── PipelineView.tsx   # Kanban: sourced → applied → interviewing
│   │   │   │   ├── StatsCards.tsx     # Quick stats
│   │   │   │   └── ActivityLog.tsx
│   │   │   │
│   │   │   ├── Settings/
│   │   │   │   ├── UserProfile.tsx
│   │   │   │   ├── Resumes.tsx
│   │   │   │   ├── AnswerTemplates.tsx
│   │   │   │   ├── AutomationSettings.tsx  # Autonomy level, rate limits
│   │   │   │   └── APIKeys.tsx
│   │   │   │
│   │   │   └── shared/
│   │   │       ├── Button.tsx
│   │   │       ├── Modal.tsx
│   │   │       ├── Badge.tsx
│   │   │       ├── Slider.tsx         # Autonomy level slider
│   │   │       └── StatusIndicator.tsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useJobs.ts
│   │   │   ├── useProfiles.ts
│   │   │   ├── useAutomation.ts       # Start/stop/pause automation
│   │   │   ├── useChat.ts
│   │   │   └── useBrowser.ts
│   │   │
│   │   └── store/
│   │       ├── index.ts               # Zustand store
│   │       ├── jobsSlice.ts
│   │       ├── profilesSlice.ts
│   │       ├── automationSlice.ts
│   │       └── chatSlice.ts
│   │
│   ├── shared/                        # Shared types between main and renderer
│   │   ├── types.ts                   # All TypeScript interfaces from above
│   │   ├── constants.ts               # Rate limits, default values
│   │   └── ipc-channels.ts            # IPC channel name constants
│   │
│   └── preload/
│       └── index.ts                   # Electron preload script (secure IPC bridge)
│
├── data/                              # User data (gitignored)
│   ├── contractor-os.db               # SQLite database
│   ├── resumes/                       # Resume PDFs
│   ├── session/                       # Playwright session storage
│   ├── hints/                         # Runtime hint files (updated by app)
│   └── logs/                          # Action logs
│
├── hints/                             # Default hint files (shipped with app)
│   ├── linkedin-jobs.json
│   ├── indeed-jobs.json
│   └── upwork-jobs.json
│
└── scripts/
    ├── seed-hints.ts                  # Generate initial hint files
    └── export-training-data.ts        # Phase 3: export action logs for fine-tuning
```

---

## Session Management

### Playwright Session Persistence

```typescript
class SessionManager {
  private browser: Browser;
  private context: BrowserContext;
  
  // Session storage path — persists cookies, localStorage, sessionStorage
  private storagePath = path.join(app.getPath('userData'), 'session', 'browser-state.json');
  
  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: false,
      channel: 'chrome',           // Use real Chrome, not Chromium
      args: [
        '--disable-blink-features=AutomationControlled', // Hide automation
        '--no-first-run',
        '--no-default-browser-check',
      ]
    });
    
    // Load existing session if available
    const storageState = fs.existsSync(this.storagePath) 
      ? this.storagePath 
      : undefined;
    
    this.context = await this.browser.newContext({
      storageState,
      viewport: { width: 1366, height: 768 },
      userAgent: 'Mozilla/5.0 ...', // Real Chrome UA string
      locale: 'en-US',
      timezoneId: 'America/Chicago', // Dallas timezone
    });
    
    // Anti-detection: override navigator.webdriver
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
  }
  
  // Save session after every significant action
  async saveSession(): Promise<void> {
    await this.context.storageState({ path: this.storagePath });
  }
  
  // Get a page for automation
  async getPage(): Promise<Page> {
    const pages = this.context.pages();
    return pages[0] || await this.context.newPage();
  }
}
```

---

## Autonomy Control System

```typescript
interface AutonomySettings {
  level: 1 | 2 | 3;
  
  // Level-specific settings
  autoApplyThreshold: number;      // match score above which to auto-apply (Level 2+)
  reviewThreshold: number;         // match score above which to queue for review
  skipThreshold: number;           // match score below which to auto-skip
  
  // Pause triggers (always ask user regardless of level)
  pauseOn: {
    customQuestions: boolean;       // unusual application questions
    externalApply: boolean;        // non-Easy Apply
    salaryQuestions: boolean;       // salary/rate questions  
    captcha: boolean;              // CAPTCHA or verification
    lowConfidenceAnswer: boolean;  // Claude isn't sure about an answer
    newSiteDetected: boolean;      // first time on a platform
  };
  
  // Rate limits
  dailyApplicationCap: number;     // max applications per day
  sessionApplicationCap: number;   // max per session
  sessionDurationMinutes: number;  // max session length
  actionsPerMinute: number;        // max actions per minute
}

// Default settings (conservative)
const DEFAULT_AUTONOMY: AutonomySettings = {
  level: 2,
  autoApplyThreshold: 90,
  reviewThreshold: 70,
  skipThreshold: 40,
  pauseOn: {
    customQuestions: true,
    externalApply: true,
    salaryQuestions: true,
    captcha: true,
    lowConfidenceAnswer: true,
    newSiteDetected: true,
  },
  dailyApplicationCap: 20,
  sessionApplicationCap: 15,
  sessionDurationMinutes: 45,
  actionsPerMinute: 8,
};
```

---

## Platform Adapter Interface

Every job platform implements this interface. This is how we add new sites without rewriting the engine.

```typescript
interface PlatformAdapter {
  readonly platform: string;       // 'linkedin', 'indeed', etc.
  readonly baseUrl: string;
  
  // Check if we're logged in
  isAuthenticated(page: Page): Promise<boolean>;
  
  // Navigate to login page (user logs in manually)
  navigateToLogin(page: Page): Promise<void>;
  
  // Build search URL from profile
  buildSearchUrl(profile: SearchProfile): string;
  
  // Extract job listings from search results page
  extractListings(page: Page): Promise<Partial<JobListing>[]>;
  
  // Navigate to next page of results
  hasNextPage(page: Page): Promise<boolean>;
  goToNextPage(page: Page): Promise<void>;
  
  // Extract full job details from a listing page
  extractJobDetails(page: Page, url: string): Promise<Partial<JobListing>>;
  
  // Apply to a job (the main automation flow)
  applyToJob(page: Page, job: JobListing, answers: Record<string, string>, resumePath: string): Promise<ApplicationResult>;
  
  // Get hint file for this platform
  getHints(): SiteHintFile;
  updateHints(hints: Partial<SiteHintFile>): void;
}
```

---

## IPC Channels (Main ↔ Renderer Communication)

```typescript
// src/shared/ipc-channels.ts

export const IPC = {
  // Automation control
  AUTOMATION_START: 'automation:start',
  AUTOMATION_STOP: 'automation:stop',
  AUTOMATION_PAUSE: 'automation:pause',
  AUTOMATION_STATUS: 'automation:status',        // main → renderer (live updates)
  
  // Jobs
  JOBS_LIST: 'jobs:list',
  JOBS_UPDATE: 'jobs:update',
  JOBS_APPROVE: 'jobs:approve',
  JOBS_REJECT: 'jobs:reject',
  JOBS_NEW: 'jobs:new',                          // main → renderer (new job found)
  
  // Profiles
  PROFILES_LIST: 'profiles:list',
  PROFILES_CREATE: 'profiles:create',
  PROFILES_UPDATE: 'profiles:update',
  PROFILES_DELETE: 'profiles:delete',
  
  // Claude Chat
  CHAT_SEND: 'chat:send',
  CHAT_RESPONSE: 'chat:response',                // main → renderer (streaming)
  CHAT_ANALYZE_JOB: 'chat:analyze-job',
  
  // Application
  APPLICATION_START: 'application:start',
  APPLICATION_PROGRESS: 'application:progress',   // main → renderer
  APPLICATION_PAUSE_QUESTION: 'application:pause-question', // bot needs help
  APPLICATION_ANSWER: 'application:answer',       // user provides answer
  APPLICATION_COMPLETE: 'application:complete',
  
  // Browser
  BROWSER_NAVIGATE: 'browser:navigate',
  BROWSER_SCREENSHOT: 'browser:screenshot',
  
  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',
  
  // Action Log
  ACTION_LOG_NEW: 'action-log:new',              // main → renderer (live feed)
} as const;
```

---

## Build Instructions for Claude Code

### Step 1: Project Setup
1. Initialize Electron + React + TypeScript project using electron-vite or electron-forge
2. Install dependencies: playwright, better-sqlite3, @anthropic-ai/sdk, zustand, tailwindcss
3. Set up the file structure as specified above
4. Configure Electron main/renderer/preload with proper security (contextIsolation: true)

### Step 2: Database
1. Set up SQLite with better-sqlite3
2. Create tables for: jobs, search_profiles, applications, action_logs, answer_templates, user_profile
3. Write migration system (simple version numbering)
4. Write repository classes for each table

### Step 3: Session Manager
1. Implement Playwright session manager with persistent storage
2. Anti-detection measures (webdriver flag, realistic UA, etc.)
3. Cookie/session persistence between app launches
4. First-launch flow: open browser → user logs into LinkedIn → save session

### Step 4: UI Shell
1. Build three-panel Electron layout
2. Left panel: search profiles + job list
3. Center panel: embedded browser view (show what Playwright is doing)
4. Right panel: Claude chat + job details
5. Bottom status bar: session status, action rate, queue size

### Step 5: Search Profiles
1. CRUD UI for search profiles
2. Profile editor with all fields (keywords, location, filters, resume selection, etc.)
3. Enable/disable toggle per profile
4. "Run Now" button per profile
5. "Run All Enabled" button

### Step 6: Extraction Engine
1. LinkedIn adapter (start with LinkedIn only)
2. Hint file for LinkedIn job search + extraction
3. ActionEngine with HintBasedExecutor
4. HumanBehavior module for realistic timing
5. Extract jobs → save to DB → push to UI via IPC
6. Duplicate detection (skip already-seen jobs by externalId)

### Step 7: Claude Integration
1. Claude service with API client
2. Job analyzer: score, summarize, flag red flags
3. Auto-analyze each extracted job (batch, using Sonnet)
4. Show analysis in right panel when user clicks a job
5. Chat panel for asking Claude questions about jobs

### Step 8: Application Engine
1. Application queue (approved jobs)
2. LinkedIn Easy Apply flow via hint-based automation
3. Answer generation via Claude (pre-fill all form fields)
4. Pause mechanism: when bot encounters unknown question → pause → show in UI → user answers → bot continues
5. Application logging (what was applied, what answers were used)

### Step 9: Review & Apply Workflow
1. Job list shows match score, status badges
2. Bulk approve/reject
3. Per-job answer editing before applying
4. Cover letter preview + edit
5. Resume selector per job
6. "Apply to approved" button starts the application queue

### Step 10: Polish
1. Action log viewer (see what the bot is doing in real time)
2. Desktop notifications (new high-match jobs, application complete, bot needs help)
3. Settings page (autonomy level, rate limits, API keys)
4. Minimize to system tray
5. Error handling and recovery (if browser crashes, resume gracefully)

---

## Critical Implementation Notes

1. **ALWAYS log every action to action_logs table.** This is training data for Phase 3. Log the page snapshot, what hint was used, what actually happened, whether it succeeded. Even in Phase 1, this data is being collected.

2. **NEVER hardcode selectors.** All selectors live in hint JSON files. The code references intents, not selectors. This is the whole point of the architecture.

3. **The ActionExecutor interface is sacred.** It must stay stable across phases. Phase 2 swaps in LLMExecutor, Phase 3 swaps in FineTunedExecutor. The rest of the app doesn't change.

4. **Human-like behavior is non-negotiable.** Random delays, natural mouse movement, reading pauses. LinkedIn WILL ban accounts that behave robotically. Build the HumanBehavior module first and use it everywhere.

5. **Session persistence is the first thing to verify.** If the user has to log in every time, they won't use the app. Electron's session storage + Playwright's storageState must work reliably.

6. **Claude API calls should be batched where possible.** Analyzing 50 jobs one-by-one is slow. Send them in batches of 5-10 with a single system prompt + multiple job descriptions.

7. **The browser view must be visible.** The user needs to see what the bot is doing. This builds trust and lets them intervene. Use BrowserView or a visible Playwright window.

8. **Start with LinkedIn only.** Don't build Indeed/Upwork adapters yet. Get the full LinkedIn flow working perfectly, then add platforms.

9. **Every UI interaction should feel instant.** Job list rendering, profile switching, chat — all should be snappy. Heavy work (API calls, browser automation) runs in background with progress indicators.

10. **Fail gracefully.** If a hint fails, skip that job and move on. Never crash the session over one failed action. Log it, flag it, continue.

---

## Phase 2 Upgrade Notes (For Future Reference)

When ready to add local LLM:

1. Install Ollama, pull Llama 3 8B
2. Create `LLMExecutor implements ActionExecutor`
3. LLMExecutor sends page accessibility tree + hint to local LLM
4. Local LLM returns: action type, target element, confidence score
5. If confidence > 0.85 → execute
6. If confidence 0.5-0.85 → verify with Claude Sonnet
7. If confidence < 0.5 → full Claude reasoning
8. Swap `actionEngine.setExecutor(new LLMExecutor())` — everything else stays the same

## Phase 3 Upgrade Notes (For Future Reference)

When ready to fine-tune:

1. Export action_logs to training format using `scripts/export-training-data.ts`
2. Format: `{ page_snapshot, hint, correct_action }` pairs
3. Fine-tune Llama 3 8B using QLoRA (Vincent's existing knowledge)
4. Create `FineTunedExecutor implements ActionExecutor`
5. Load custom model via Ollama
6. Same confidence threshold escalation as Phase 2
7. Swap executor — everything else stays the same
