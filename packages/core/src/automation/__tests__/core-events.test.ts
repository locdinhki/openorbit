import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CoreEventBus, getCoreEventBus, resetCoreEventBus } from '../core-events'
import type { AutomationStatus, JobListing } from '../../types'

describe('CoreEventBus', () => {
  beforeEach(() => {
    resetCoreEventBus()
  })

  it('emits and receives automation:status events', () => {
    const bus = new CoreEventBus()
    const handler = vi.fn()
    bus.on('automation:status', handler)

    const status: AutomationStatus = {
      state: 'running',
      jobsExtracted: 5,
      jobsAnalyzed: 3,
      applicationsSubmitted: 1,
      actionsPerMinute: 2,
      errors: []
    }
    bus.emit('automation:status', status)

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith(status)
  })

  it('emits and receives jobs:new events', () => {
    const bus = new CoreEventBus()
    const handler = vi.fn()
    bus.on('jobs:new', handler)

    const job = { id: 'j1', title: 'Dev', company: 'Acme' } as JobListing
    bus.emit('jobs:new', job)

    expect(handler).toHaveBeenCalledWith(job)
  })

  it('emits application:progress events', () => {
    const bus = new CoreEventBus()
    const handler = vi.fn()
    bus.on('application:progress', handler)

    bus.emit('application:progress', { jobId: 'j1', step: 2, currentAction: 'Filling form' })

    expect(handler).toHaveBeenCalledWith({
      jobId: 'j1',
      step: 2,
      currentAction: 'Filling form'
    })
  })

  it('supports off to remove listeners', () => {
    const bus = new CoreEventBus()
    const handler = vi.fn()
    bus.on('automation:status', handler)
    bus.off('automation:status', handler)

    bus.emit('automation:status', { state: 'idle' } as AutomationStatus)
    expect(handler).not.toHaveBeenCalled()
  })

  it('supports once for single-fire listeners', () => {
    const bus = new CoreEventBus()
    const handler = vi.fn()
    bus.once('jobs:new', handler)

    const job = { id: 'j1' } as JobListing
    bus.emit('jobs:new', job)
    bus.emit('jobs:new', job)

    expect(handler).toHaveBeenCalledOnce()
  })
})

describe('getCoreEventBus singleton', () => {
  beforeEach(() => {
    resetCoreEventBus()
  })

  it('returns the same instance on repeated calls', () => {
    const bus1 = getCoreEventBus()
    const bus2 = getCoreEventBus()
    expect(bus1).toBe(bus2)
  })

  it('returns a new instance after reset', () => {
    const bus1 = getCoreEventBus()
    resetCoreEventBus()
    const bus2 = getCoreEventBus()
    expect(bus1).not.toBe(bus2)
  })
})
