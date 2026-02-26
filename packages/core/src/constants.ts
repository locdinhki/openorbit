import type { AutonomySettings } from './types'

// --- Rate Limits ---

export const MAX_ACTIONS_PER_MINUTE = 8
export const MAX_APPLICATIONS_PER_SESSION = 15
export const MAX_EXTRACTIONS_PER_SESSION = 75
export const SESSION_DURATION_MAX_MINUTES = 45

// --- Human Behavior Timing (milliseconds) ---

export const HUMAN_DELAY_MIN = 800
export const HUMAN_DELAY_MAX = 2500
export const HUMAN_TYPE_MIN = 50
export const HUMAN_TYPE_MAX = 150
export const HUMAN_READING_PAUSE_PER_SENTENCE = 350
export const BETWEEN_LISTINGS_MIN = 5000
export const BETWEEN_LISTINGS_MAX = 15000
export const BETWEEN_APPLICATIONS_MIN = 30000
export const BETWEEN_APPLICATIONS_MAX = 90000
export const IDLE_CHANCE = 0.1
export const IDLE_MIN = 3000
export const IDLE_MAX = 10000

// --- Hint Confidence ---

export const HINT_CONFIDENCE_THRESHOLD = 0.7
export const HINT_CONFIDENCE_BOOST = 0.05
export const HINT_CONFIDENCE_PENALTY = 0.15
export const HINT_SELECTOR_TIMEOUT = 3000

// --- Selector Healing ---

export const SELECTOR_SNAPSHOT_MAX_LENGTH = 8000
export const SELECTOR_CACHE_MIN_CONFIDENCE = 0.6
export const SELECTOR_CACHE_MAX_FAILURES = 5
export const SELECTOR_CONFIDENCE_BOOST = 0.05
export const SELECTOR_CONFIDENCE_PENALTY = 0.15

// --- Claude Model IDs ---

export const CLAUDE_MODELS = {
  SONNET: 'claude-sonnet-4-5-20250929',
  OPUS: 'claude-opus-4-6'
} as const

// --- Default Autonomy Settings ---

export const DEFAULT_AUTONOMY: AutonomySettings = {
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
    newSiteDetected: true
  },
  dailyApplicationCap: 20,
  sessionApplicationCap: 15,
  sessionDurationMinutes: 45,
  actionsPerMinute: 8
}

// --- API Retry ---

export const MAX_API_RETRY_ATTEMPTS = 3
export const MAX_BACKOFF_MS = 30_000
export const INITIAL_BACKOFF_MS = 1_000

// --- Database ---

export const DB_FILENAME = 'openorbit.db'

// --- Session ---

export const SESSION_STORAGE_FILENAME = 'browser-state.json'
