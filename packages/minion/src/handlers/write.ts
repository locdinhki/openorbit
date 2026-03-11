import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { WriteInstruction, WriteResult } from '../types.js'

export async function handleWrite(instruction: WriteInstruction): Promise<WriteResult> {
  // Ensure parent directory exists
  await mkdir(dirname(instruction.path), { recursive: true })

  const buffer = Buffer.from(instruction.content, 'utf-8')
  await writeFile(instruction.path, buffer, {
    mode: instruction.mode ? parseInt(instruction.mode, 8) : undefined
  })

  return {
    bytesWritten: buffer.length
  }
}
