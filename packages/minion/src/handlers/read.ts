import { readFile } from 'node:fs/promises'
import type { ReadInstruction, ReadResult } from '../types.js'

export async function handleRead(
  instruction: ReadInstruction,
  maxOutputBytes: number
): Promise<ReadResult> {
  const maxBytes = instruction.maxBytes ?? maxOutputBytes
  const encoding = instruction.encoding ?? 'utf-8'

  const buffer = await readFile(instruction.path)
  const truncated = buffer.length > maxBytes ? buffer.subarray(0, maxBytes) : buffer

  return {
    content: truncated.toString(encoding)
  }
}
