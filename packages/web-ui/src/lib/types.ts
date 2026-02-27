export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface JobListing {
  id: string
  title: string
  company: string
  location: string
  platform: string
  status: string
  score: number | null
  url: string
  postedAt: string | null
  salary: string | null
  description: string | null
  highlights: string[]
  redFlags: string[]
}

export interface AutomationStatus {
  running: boolean
  paused: boolean
  currentPlatform: string | null
  currentStep: string | null
  jobsFound: number
  jobsApplied: number
}

export interface RPCResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
