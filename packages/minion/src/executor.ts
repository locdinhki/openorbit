import type {
  Instruction,
  InstructionResult,
  InstructionType,
  SelfUpdateInstruction
} from './types.js'
import { handleExec } from './handlers/exec.js'
import { handleRead } from './handlers/read.js'
import { handleWrite } from './handlers/write.js'
import { handleHttp } from './handlers/http.js'
import { handleSelfUpdate } from './handlers/self-update.js'

export class Executor {
  private allowedOps: Set<InstructionType>
  private maxOutputBytes: number

  constructor(allowedOps: InstructionType[], maxOutputBytes: number) {
    this.allowedOps = new Set(allowedOps)
    this.maxOutputBytes = maxOutputBytes
  }

  async execute(instruction: Instruction): Promise<InstructionResult> {
    // self-update is always allowed — it's dispatched by the hive, not user tasks
    if (instruction.type === 'self-update') {
      return handleSelfUpdate(instruction as SelfUpdateInstruction)
    }

    if (!this.allowedOps.has(instruction.type)) {
      throw new Error(`Operation not allowed: ${instruction.type}`)
    }

    switch (instruction.type) {
      case 'exec':
        return handleExec(instruction, this.maxOutputBytes)
      case 'read':
        return handleRead(instruction, this.maxOutputBytes)
      case 'write':
        return handleWrite(instruction)
      case 'http':
        return handleHttp(instruction)
      case 'upload':
        throw new Error('upload handler not implemented yet')
      case 'download':
        throw new Error('download handler not implemented yet')
      default:
        throw new Error(`Unknown instruction type: ${(instruction as Instruction).type}`)
    }
  }
}
