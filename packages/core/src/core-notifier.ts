/**
 * Core notifier interface — no Electron dependencies.
 * The Electron `Notifier` class implements this interface.
 * The CLI can implement it with console output, or leave it null.
 */
export interface CoreNotifier {
  notifyHighMatchJob(job: { title: string; company: string; matchScore?: number }): void
  notifyApplicationComplete(job: { title: string; company: string }): void
  notifyApplicationFailed(job: { title: string; company: string }, reason: string): void
  notifyCircuitBreakerTripped(): void
  notifySessionComplete(stats: {
    jobsExtracted: number
    jobsAnalyzed: number
    applicationsSubmitted: number
  }): void
}

let notifier: CoreNotifier | null = null

export function setCoreNotifier(n: CoreNotifier): void {
  notifier = n
}

export function getCoreNotifier(): CoreNotifier | null {
  return notifier
}
