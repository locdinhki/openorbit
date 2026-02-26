import { EventEmitter } from 'events'
import type { AutomationStatus, JobListing } from '../types'

export interface ApplicationProgressData {
  jobId: string
  step: number
  currentAction: string
}

export interface ApplicationPauseQuestionData {
  question: string
  jobId: string
}

export interface ApplicationCompleteData {
  jobId: string
  success: boolean
  error?: string
}

export interface RelayAttachedData {
  tabId: number
  url: string
}

export interface RelayDetachedData {
  tabId: number
}

export interface RelayCDPEventData {
  tabId: number
  cdpEvent: string
  cdpParams: unknown
}

export type CoreEventMap = {
  'automation:status': [status: AutomationStatus]
  'jobs:new': [job: JobListing]
  'application:progress': [data: ApplicationProgressData]
  'application:pause-question': [data: ApplicationPauseQuestionData]
  'application:complete': [data: ApplicationCompleteData]
  // Relay events (Chrome extension CDP relay)
  'relay:attached': [data: RelayAttachedData]
  'relay:detached': [data: RelayDetachedData]
  'relay:cdp-event': [data: RelayCDPEventData]
}

export class CoreEventBus extends EventEmitter {
  emit<K extends keyof CoreEventMap>(event: K, ...args: CoreEventMap[K]): boolean {
    return super.emit(event, ...args)
  }

  on<K extends keyof CoreEventMap>(event: K, listener: (...args: CoreEventMap[K]) => void): this {
    return super.on(event, listener as (...args: unknown[]) => void)
  }

  off<K extends keyof CoreEventMap>(event: K, listener: (...args: CoreEventMap[K]) => void): this {
    return super.off(event, listener as (...args: unknown[]) => void)
  }

  once<K extends keyof CoreEventMap>(event: K, listener: (...args: CoreEventMap[K]) => void): this {
    return super.once(event, listener as (...args: unknown[]) => void)
  }
}

let bus: CoreEventBus | null = null

export function getCoreEventBus(): CoreEventBus {
  if (!bus) bus = new CoreEventBus()
  return bus
}

/** Reset the event bus (for testing only) */
export function resetCoreEventBus(): void {
  if (bus) {
    bus.removeAllListeners()
    bus = null
  }
}
