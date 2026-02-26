// ============================================================================
// OpenOrbit — Shared Type Definitions
// ============================================================================

// --- Search Profile ---

export interface SearchProfile {
  id: string
  name: string
  enabled: boolean
  platform: PlatformName
  search: {
    keywords: string[]
    location: string[]
    datePosted: 'past24hrs' | 'pastWeek' | 'pastMonth'
    experienceLevel: string[]
    jobType: ('full-time' | 'contract' | 'freelance' | 'part-time')[]
    salaryMin?: number
    easyApplyOnly?: boolean
    excludeTerms: string[]
    remoteOnly?: boolean
  }
  application: {
    resumeFile: string
    coverLetterTemplate?: string
    defaultAnswers: Record<string, string>
  }
  createdAt: string
  updatedAt: string
}

// --- Job Listing ---

export type JobStatus =
  | 'new'
  | 'reviewed'
  | 'approved'
  | 'rejected'
  | 'applied'
  | 'skipped'
  | 'error'

export interface JobListing {
  id: string
  externalId: string
  platform: string
  profileId: string
  url: string
  title: string
  company: string
  location: string
  salary?: string
  jobType: string
  description: string
  postedDate: string
  easyApply: boolean

  // Claude-generated fields
  matchScore?: number
  matchReasoning?: string
  summary?: string
  redFlags?: string[]
  highlights?: string[]

  // User actions
  status: JobStatus
  userNotes?: string
  reviewedAt?: string
  appliedAt?: string

  // Application details
  applicationAnswers?: Record<string, string>
  coverLetterUsed?: string
  resumeUsed?: string

  createdAt: string
  updatedAt: string
}

// --- Hint Files ---

export interface SiteHintFile {
  site: string
  lastFullScan: string
  lastVerified: string
  actions: {
    [intentName: string]: {
      steps: ActionStep[]
    }
  }
  changeLog: {
    date: string
    change: string
  }[]
}

export interface ActionStep {
  intent: string
  hint: {
    selectors: string[]
    textMatches: string[]
    ariaLabels: string[]
    location: string
    elementType: string
  }
  fallbackDescription: string
  lastVerified: string
  confidence: number
  failureCount: number
}

// --- Action Log (Phase 3 training data) ---

export type ActionType = 'click' | 'type' | 'select' | 'scroll' | 'navigate' | 'upload' | 'wait'
export type ExecutionMethod = 'hint' | 'local_llm' | 'claude_sonnet' | 'claude_opus' | 'manual'

export interface ActionLog {
  id: string
  timestamp: string
  site: string
  url: string
  intent: string
  pageSnapshot: string
  hintUsed: ActionStep
  executionMethod: ExecutionMethod
  action: {
    type: ActionType
    target: string
    value?: string
  }
  success: boolean
  errorMessage?: string
  correctedAction?: {
    target: string
    value?: string
  }
}

// --- User Profile ---

export interface UserProfile {
  name: string
  title: string
  location: string
  summary: string
  skills: string[]
  experience: {
    role: string
    company: string
    duration: string
    description: string
  }[]
  education: {
    degree: string
    school: string
    year: string
  }[]
  preferences: {
    targetRoles: string[]
    targetCompensation: { min: number; max: number; type: 'hourly' | 'annual' }
    workTypes: string[]
    remotePreference: 'remote' | 'hybrid' | 'onsite' | 'any'
    dealbreakers: string[]
    priorities: string[]
  }
  resumes: {
    name: string
    file: string
    targetRoles: string[]
  }[]
}

// --- Automation Engine ---

export interface PageContext {
  site: string
  url: string
  page: unknown // Playwright Page — typed as unknown to avoid main/renderer coupling
}

export interface ActionResult {
  success: boolean
  method: string
  selector?: string
  text?: string
  label?: string
  needsEscalation?: boolean
  errorMessage?: string
}

export interface ActionExecutor {
  execute(intent: string, context: PageContext): Promise<ActionResult>
}

// --- Platform Adapter ---

export type PlatformName = 'linkedin' | 'indeed' | 'upwork' | 'dice' | 'wellfound' | 'glassdoor'

export interface ApplicationResult {
  success: boolean
  jobId: string
  answersUsed: Record<string, string>
  coverLetterUsed?: string
  resumeUsed?: string
  errorMessage?: string
  needsManualIntervention?: boolean
  interventionReason?: string
}

// --- Upwork-specific ---

export interface UpworkProjectDetails {
  budgetType: 'fixed' | 'hourly'
  budgetMin?: number
  budgetMax?: number
  budgetFixed?: number
  timeline?: string
  clientRating?: number
  clientTotalSpent?: string
  clientHireRate?: number
  proposalsCount?: string
  connectsRequired?: number
  skillsRequired: string[]
  experienceLevel?: 'entry' | 'intermediate' | 'expert'
  questions?: string[]
}

// --- Autonomy Settings ---

export interface AutonomySettings {
  level: 1 | 2 | 3
  autoApplyThreshold: number
  reviewThreshold: number
  skipThreshold: number
  pauseOn: {
    customQuestions: boolean
    externalApply: boolean
    salaryQuestions: boolean
    captcha: boolean
    lowConfidenceAnswer: boolean
    newSiteDetected: boolean
  }
  dailyApplicationCap: number
  sessionApplicationCap: number
  sessionDurationMinutes: number
  actionsPerMinute: number
}

// --- Claude AI ---

export type ClaudeTask =
  | 'score_job'
  | 'summarize_job'
  | 'generate_answer'
  | 'cover_letter'
  | 'compare_jobs'
  | 'chat'
  | 'generate_hints'
  | 'repair_hint'
  | 'generate_proposal'

export interface ClaudeAnalysis {
  matchScore: number
  reasoning: string
  summary: string
  redFlags: string[]
  highlights: string[]
  recommendedResume: string
}

export interface ClaudeAnswer {
  answer: string
  confidence: number
  needsReview: boolean
}

// --- Automation Status (for IPC) ---

export type AutomationState = 'idle' | 'running' | 'paused' | 'error'

export interface PlatformStatus {
  platform: string
  state: AutomationState
  currentAction?: string
  jobsExtracted: number
  jobsAnalyzed: number
  applicationsSubmitted: number
  errors: string[]
}

export interface AutomationStatus {
  state: AutomationState
  currentAction?: string
  jobsExtracted: number
  jobsAnalyzed: number
  applicationsSubmitted: number
  actionsPerMinute: number
  sessionStartTime?: string
  errors: string[]
  platforms?: PlatformStatus[]
}

// --- Application Queue ---

export interface QueuedApplication {
  job: JobListing
  answers: Record<string, string>
  coverLetter?: string
  resumePath: string
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'paused'
  pauseReason?: string
}
