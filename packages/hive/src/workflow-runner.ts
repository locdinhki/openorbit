// ============================================================================
// Open Hive — Workflow Runner
//
// Executes a workflow run step-by-step, sequentially. Each step creates a
// task on the target device, waits for it to complete, then passes stdout
// to the next step via variable substitution (${VAR_NAME}).
// ============================================================================

import type { Store } from './store.js'
import type { WorkflowStep } from './db/schema.js'

const POLL_INTERVAL_MS = 2_000
const STEP_TIMEOUT_MS = 10 * 60 * 1000 // 10 min per step

export class WorkflowRunner {
  constructor(
    private store: Store,
    private dispatchTaskToDevice: (
      deviceId: string,
      taskId: string,
      instruction: Record<string, unknown>
    ) => boolean
  ) {}

  /** Start executing a workflow run asynchronously (fire-and-forget). */
  run(runId: string, steps: WorkflowStep[]): void {
    this.execute(runId, steps).catch((err) => {
      console.error(`[workflow] Run ${runId} crashed:`, err)
      this.store
        .updateWorkflowRun(runId, { status: 'failed', completedAt: new Date() })
        .catch(() => {})
    })
  }

  private async execute(runId: string, steps: WorkflowStep[]): Promise<void> {
    await this.store.updateWorkflowRun(runId, { status: 'running' })

    const context: Record<string, string> = {}
    let stepIndex = 0

    while (stepIndex >= 0 && stepIndex < steps.length) {
      const step = steps[stepIndex]

      // Create step run record
      const stepRun = await this.store.createStepRun({ runId, stepIndex })
      await this.store.updateStepRun(stepRun.id, { status: 'running', startedAt: new Date() })
      await this.store.updateWorkflowRun(runId, { currentStep: stepIndex, context })

      try {
        // Substitute variables in instruction values
        const instruction = substituteVars(step.instruction, context)

        // Dispatch task to device
        const task = await this.store.createTask({
          targetDevice: step.deviceId,
          instruction
        })
        this.dispatchTaskToDevice(step.deviceId, task.id, instruction)
        await this.store.updateStepRun(stepRun.id, { taskId: task.id })

        // Poll until complete
        const result = await this.pollUntilDone(task.id)

        if (result.status === 'completed') {
          // Extract stdout from result
          const stdout = extractStdout(result.output)
          if (step.passOutputAs && stdout !== null) {
            context[step.passOutputAs] = stdout
          }

          await this.store.updateStepRun(stepRun.id, {
            status: 'completed',
            output: result.output ?? {},
            completedAt: new Date()
          })

          // Determine next step
          stepIndex =
            step.onSuccess !== undefined && step.onSuccess !== null ? step.onSuccess : stepIndex + 1
        } else {
          // Step failed
          const errMsg = result.error ?? `Step failed with status: ${result.status}`
          await this.store.updateStepRun(stepRun.id, {
            status: 'failed',
            error: errMsg,
            completedAt: new Date()
          })

          if (step.onFailure !== undefined && step.onFailure !== null) {
            stepIndex = step.onFailure
          } else {
            // Abort run
            await this.store.updateWorkflowRun(runId, {
              status: 'failed',
              completedAt: new Date(),
              context
            })
            return
          }
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        await this.store.updateStepRun(stepRun.id, {
          status: 'failed',
          error: errMsg,
          completedAt: new Date()
        })
        await this.store.updateWorkflowRun(runId, {
          status: 'failed',
          completedAt: new Date(),
          context
        })
        return
      }
    }

    await this.store.updateWorkflowRun(runId, {
      status: 'completed',
      completedAt: new Date(),
      context
    })
  }

  private async pollUntilDone(
    taskId: string
  ): Promise<{ status: string; output?: Record<string, unknown>; error?: string }> {
    const deadline = Date.now() + STEP_TIMEOUT_MS

    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS)

      const task = await this.store.getTask(taskId)
      if (!task) throw new Error(`Task ${taskId} not found`)

      if (task.status === 'completed' || task.status === 'failed' || task.status === 'timeout') {
        const results = await this.store.getResults(taskId)
        const first = results[0]
        return {
          status: task.status,
          output: first?.result ?? undefined,
          error: first?.error ?? undefined
        }
      }
    }

    throw new Error(`Step timed out after ${STEP_TIMEOUT_MS / 1000}s`)
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function substituteVars(
  instruction: Record<string, unknown>,
  context: Record<string, string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(instruction)) {
    if (typeof val === 'string') {
      result[key] = val.replace(/\$\{(\w+)\}/g, (_, name) => context[name] ?? `\${${name}}`)
    } else {
      result[key] = val
    }
  }
  return result
}

function extractStdout(output?: Record<string, unknown> | null): string | null {
  if (!output) return null
  if (typeof output.stdout === 'string') return output.stdout
  if (typeof output.content === 'string') return output.content
  return null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
