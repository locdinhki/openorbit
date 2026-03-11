// ============================================================================
// ext-hive — Task polling helper (shared by all dispatch skills)
// ============================================================================

import type { HiveClient } from '../hive-client'
import type { TaskWithResults } from '../types'

const POLL_INTERVAL_MS = 2_000
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1_000 // 5 minutes

/**
 * Dispatch a task and poll until it completes, fails, or times out.
 */
export async function dispatchAndPoll(
  client: HiveClient,
  targetDevice: string,
  instruction: Record<string, unknown>,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<TaskWithResults> {
  const task = await client.createTask({
    targetDevice,
    instruction: instruction as Parameters<typeof client.createTask>[0]['instruction']
  })

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS)
    const updated = await client.getTask(task.id)
    if (
      updated.status === 'completed' ||
      updated.status === 'failed' ||
      updated.status === 'timeout'
    ) {
      return updated
    }
  }

  throw new Error(`Task ${task.id} timed out after ${Math.round(timeoutMs / 1000)}s`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
