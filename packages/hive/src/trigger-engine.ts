// ============================================================================
// Trigger Engine — event-driven automation (condition → action)
// ============================================================================

import type { Store, Trigger } from './store.js'
import type { WorkflowRunner } from './workflow-runner.js'

export type TriggerEvent =
  | { type: 'alert.fired'; ruleId: string; deviceId: string; deviceName: string; message: string }
  | { type: 'alert.resolved'; ruleId: string; deviceId: string; deviceName: string }
  | { type: 'device.online'; deviceId: string; deviceName: string }
  | { type: 'device.offline'; deviceId: string; deviceName: string }
  | {
      type: 'metric.threshold'
      deviceId: string
      deviceName: string
      metric: string
      value: number
    }

export class TriggerEngine {
  constructor(
    private store: Store,
    private dispatchTaskToDevice: (
      deviceId: string,
      taskId: string,
      instruction: Record<string, unknown>
    ) => boolean,
    private workflowRunner: WorkflowRunner,
    private sendTelegram: (text: string) => Promise<void>
  ) {}

  /** Evaluate all triggers matching the given event. */
  async evaluate(event: TriggerEvent): Promise<void> {
    const matchingTriggers = await this.store.getEnabledTriggersByCondition(event.type)

    for (const trigger of matchingTriggers) {
      try {
        if (!this.matchesParams(trigger, event)) continue
        if (this.isInCooldown(trigger)) continue

        const resultId = await this.executeAction(trigger, event)

        await this.store.updateTrigger(trigger.id, { lastFiredAt: new Date() })
        await this.store.createTriggerRun({
          triggerId: trigger.id,
          conditionData: event as unknown as Record<string, unknown>,
          resultId
        })

        console.log(`[triggers] Fired "${trigger.name}" on ${event.type}`)
      } catch (err) {
        console.error(
          `[triggers] Error evaluating trigger "${trigger.name}":`,
          err instanceof Error ? err.message : err
        )
      }
    }
  }

  /** Check metric.threshold triggers against current metrics. */
  async evaluateMetric(
    deviceId: string,
    deviceName: string,
    metrics: { cpuPercent: number; memPercent: number }
  ): Promise<void> {
    const matchingTriggers = await this.store.getEnabledTriggersByCondition('metric.threshold')

    for (const trigger of matchingTriggers) {
      try {
        const params = trigger.conditionParams as Record<string, unknown> | null
        if (!params) continue

        // Check deviceId filter
        if (params.deviceId && params.deviceId !== deviceId) continue

        const metric = params.metric as string
        const op = params.op as string
        const threshold = params.value as number
        const value = metric === 'cpu' ? metrics.cpuPercent : metrics.memPercent

        if (!this.compare(value, op, threshold)) continue
        if (this.isInCooldown(trigger)) continue

        const event: TriggerEvent = {
          type: 'metric.threshold',
          deviceId,
          deviceName,
          metric,
          value
        }

        const resultId = await this.executeAction(trigger, event)
        await this.store.updateTrigger(trigger.id, { lastFiredAt: new Date() })
        await this.store.createTriggerRun({
          triggerId: trigger.id,
          conditionData: event as unknown as Record<string, unknown>,
          resultId
        })

        console.log(`[triggers] Fired "${trigger.name}" on metric.threshold (${metric}=${value})`)
      } catch (err) {
        console.error(
          `[triggers] Error evaluating metric trigger "${trigger.name}":`,
          err instanceof Error ? err.message : err
        )
      }
    }
  }

  private matchesParams(trigger: Trigger, event: TriggerEvent): boolean {
    const params = trigger.conditionParams as Record<string, unknown> | null
    if (!params) return true

    // Filter by ruleId for alert events
    if (
      (event.type === 'alert.fired' || event.type === 'alert.resolved') &&
      params.ruleId &&
      params.ruleId !== event.ruleId
    ) {
      return false
    }

    // Filter by deviceId for device events
    if (
      (event.type === 'device.online' || event.type === 'device.offline') &&
      params.deviceId &&
      params.deviceId !== event.deviceId
    ) {
      return false
    }

    return true
  }

  private isInCooldown(trigger: Trigger): boolean {
    if (!trigger.lastFiredAt) return false
    const cooldownMs = (trigger.cooldownS ?? 300) * 1000
    return Date.now() - new Date(trigger.lastFiredAt).getTime() < cooldownMs
  }

  private async executeAction(trigger: Trigger, event: TriggerEvent): Promise<string | undefined> {
    const params = trigger.actionParams as Record<string, unknown>
    const deviceId = (params.deviceId as string) || ('deviceId' in event ? event.deviceId : '')

    switch (trigger.action) {
      case 'run_workflow': {
        const workflowId = params.workflowId as string
        const workflow = await this.store.getWorkflow(workflowId)
        if (!workflow) {
          console.error(`[triggers] Workflow ${workflowId} not found`)
          return undefined
        }
        const run = await this.store.createWorkflowRun(workflow.id)
        this.workflowRunner.run(run.id, workflow.steps)
        return run.id
      }

      case 'run_template': {
        const templateId = params.templateId as string
        const template = await this.store.getTemplate(templateId)
        if (!template) {
          console.error(`[triggers] Template ${templateId} not found`)
          return undefined
        }
        const targetDevice = deviceId || template.deviceId
        if (!targetDevice) {
          console.error(`[triggers] No device for template ${templateId}`)
          return undefined
        }
        const task = await this.store.createTask({
          targetDevice,
          instruction: template.instruction
        })
        this.dispatchTaskToDevice(targetDevice, task.id, template.instruction)
        return task.id
      }

      case 'exec_command': {
        if (!deviceId) {
          console.error(`[triggers] No deviceId for exec_command`)
          return undefined
        }
        const command = params.command as string
        const instruction = { type: 'exec', command }
        const task = await this.store.createTask({
          targetDevice: deviceId,
          instruction
        })
        this.dispatchTaskToDevice(deviceId, task.id, instruction)
        return task.id
      }

      case 'send_telegram': {
        let message = params.message as string
        if ('deviceName' in event) message = message.replace(/\$\{deviceName\}/g, event.deviceName)
        if ('metric' in event) message = message.replace(/\$\{metric\}/g, event.metric)
        if ('value' in event) message = message.replace(/\$\{value\}/g, String(event.value))
        await this.sendTelegram(message)
        return undefined
      }

      default:
        console.error(`[triggers] Unknown action: ${trigger.action}`)
        return undefined
    }
  }

  private compare(actual: number, op: string, threshold: number): boolean {
    switch (op) {
      case '>':
        return actual > threshold
      case '>=':
        return actual >= threshold
      case '<':
        return actual < threshold
      case '<=':
        return actual <= threshold
      case '==':
        return actual === threshold
      case '!=':
        return actual !== threshold
      default:
        return actual > threshold // default to > for backwards compat
    }
  }
}
