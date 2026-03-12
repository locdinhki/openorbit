// ============================================================================
// ext-hive — AI Tool Definitions for fleet operations
// ============================================================================

import type { AIToolDefinition } from '@openorbit/core/ai/provider-types'

export const HIVE_TOOLS: AIToolDefinition[] = [
  {
    name: 'list_devices',
    description: 'List all devices in the fleet with their status, hardware info, and location',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_device',
    description: 'Get detailed info about a specific device by ID',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: { type: 'string', description: 'Device ID (e.g. "minion-01-pi4")' }
      },
      required: ['deviceId']
    }
  },
  {
    name: 'exec_command',
    description:
      'Execute a shell command on a remote device. Returns stdout, stderr, and exit code. The command runs on the device, not locally.',
    inputSchema: {
      type: 'object',
      properties: {
        device: { type: 'string', description: 'Target device ID' },
        command: { type: 'string', description: 'Shell command to execute' },
        cwd: { type: 'string', description: 'Working directory (optional)' },
        timeout: { type: 'number', description: 'Timeout in ms (default 60000)' }
      },
      required: ['device', 'command']
    }
  },
  {
    name: 'read_file',
    description: 'Read a file from a remote device',
    inputSchema: {
      type: 'object',
      properties: {
        device: { type: 'string', description: 'Target device ID' },
        path: { type: 'string', description: 'Absolute file path on the device' }
      },
      required: ['device', 'path']
    }
  },
  {
    name: 'write_file',
    description: 'Write content to a file on a remote device',
    inputSchema: {
      type: 'object',
      properties: {
        device: { type: 'string', description: 'Target device ID' },
        path: { type: 'string', description: 'Absolute file path on the device' },
        content: { type: 'string', description: 'File content to write' }
      },
      required: ['device', 'path', 'content']
    }
  },
  {
    name: 'http_request',
    description:
      'Make an HTTP request from a remote device (useful for testing connectivity or APIs from that device)',
    inputSchema: {
      type: 'object',
      properties: {
        device: { type: 'string', description: 'Target device ID' },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
        url: { type: 'string', description: 'Request URL' },
        headers: { type: 'object', description: 'Request headers (optional)' },
        body: { type: 'string', description: 'Request body (optional)' }
      },
      required: ['device', 'method', 'url']
    }
  },
  {
    name: 'list_tasks',
    description: 'List recent tasks, optionally filtered by device or status',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: { type: 'string', description: 'Filter by device ID (optional)' },
        status: {
          type: 'string',
          enum: ['queued', 'dispatched', 'running', 'completed', 'failed', 'timeout'],
          description: 'Filter by status (optional)'
        },
        limit: { type: 'number', description: 'Max results (default 20)' }
      }
    }
  },
  {
    name: 'get_task',
    description: 'Get task details and results by task ID',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID' }
      },
      required: ['taskId']
    }
  },
  {
    name: 'list_schedules',
    description: 'List all scheduled tasks, optionally filtered by device',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: { type: 'string', description: 'Filter by device ID (optional)' }
      }
    }
  },
  {
    name: 'create_schedule',
    description: 'Create a new scheduled task that runs on a cron expression',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: { type: 'string', description: 'Target device ID' },
        name: { type: 'string', description: 'Human-readable name for the schedule' },
        instruction: {
          type: 'object',
          description: 'Task instruction (same format as exec_command/read_file/etc)',
          properties: {
            type: { type: 'string', enum: ['exec', 'read', 'write', 'http'] },
            command: { type: 'string' },
            path: { type: 'string' },
            content: { type: 'string' },
            method: { type: 'string' },
            url: { type: 'string' }
          },
          required: ['type']
        },
        cronExpression: {
          type: 'string',
          description:
            'Cron expression (min hour dom month dow), e.g. "0 */6 * * *" for every 6 hours'
        }
      },
      required: ['deviceId', 'name', 'instruction', 'cronExpression']
    }
  },
  {
    name: 'delete_schedule',
    description: 'Delete a scheduled task by ID',
    inputSchema: {
      type: 'object',
      properties: {
        scheduleId: { type: 'string', description: 'Schedule ID to delete' }
      },
      required: ['scheduleId']
    }
  },
  {
    name: 'list_workflows',
    description: 'List all defined workflows',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'run_workflow',
    description: 'Trigger a workflow run by workflow ID. Returns a run ID you can poll for status.',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: 'Workflow ID to run' }
      },
      required: ['workflowId']
    }
  },
  {
    name: 'get_workflow_status',
    description: 'Get the current status and step-by-step progress of a workflow run',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: 'Workflow run ID' }
      },
      required: ['runId']
    }
  },
  {
    name: 'create_workflow',
    description:
      'Create a new multi-step workflow. Steps run sequentially; stdout can be passed between steps via variable substitution (${VAR}).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Workflow name' },
        description: { type: 'string', description: 'Description (optional)' },
        steps: {
          type: 'array',
          description: 'Ordered list of steps',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Step label' },
              deviceId: { type: 'string', description: 'Target device ID' },
              instruction: {
                type: 'object',
                description: 'Instruction (same format as exec_command etc)',
                properties: {
                  type: { type: 'string', enum: ['exec', 'read', 'write', 'http'] }
                },
                required: ['type']
              },
              passOutputAs: {
                type: 'string',
                description: 'Variable name to store stdout of this step'
              },
              onFailure: {
                type: 'number',
                description: 'Step index to jump to on failure (0-based), omit to abort'
              }
            },
            required: ['name', 'deviceId', 'instruction']
          }
        }
      },
      required: ['name', 'steps']
    }
  },
  {
    name: 'list_groups',
    description: 'List all device groups with member and online counts',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'create_group',
    description: 'Create a device group that targets devices by their location tag',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Group name' },
        description: { type: 'string', description: 'Description (optional)' },
        tagFilter: {
          type: 'string',
          description: 'Location tag value — devices with this tag belong to the group'
        }
      },
      required: ['name', 'tagFilter']
    }
  },
  {
    name: 'broadcast_command',
    description: 'Execute a shell command on all online devices in a group simultaneously',
    inputSchema: {
      type: 'object',
      properties: {
        groupId: { type: 'string', description: 'Device group ID' },
        command: { type: 'string', description: 'Shell command to execute on all online members' }
      },
      required: ['groupId', 'command']
    }
  },
  {
    name: 'check_minion_versions',
    description:
      'List all devices with their current minion version and whether they are up to date. Also shows what the latest available version is.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'update_minion',
    description:
      'Dispatch a self-update task to one or all online minions. The minion will download the new binary, verify its checksum, replace itself, and restart.',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: {
          type: 'string',
          description: 'Device ID to update. Omit to update ALL online minions.'
        }
      }
    }
  },
  {
    name: 'get_device_metrics',
    description:
      'Get recent CPU and RAM usage metrics for a device (last N readings, recorded every ~30s)',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: { type: 'string', description: 'Device ID' },
        limit: { type: 'number', description: 'Number of readings to return (default 20)' }
      },
      required: ['deviceId']
    }
  },
  {
    name: 'list_alerts',
    description:
      'List monitoring alerts, optionally filtered by device or showing only active ones',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: { type: 'string', description: 'Filter by device ID (optional)' },
        activeOnly: {
          type: 'boolean',
          description: 'Only return unresolved alerts (default false)'
        }
      }
    }
  },
  {
    name: 'open_terminal',
    description:
      'Open an interactive terminal session for a device. Returns the dashboard URL where the user can interact with the device shell (bash). The device must be online.',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: { type: 'string', description: 'Device ID to open terminal for' }
      },
      required: ['deviceId']
    }
  }
]

export const HIVE_SYSTEM_PROMPT = `You are a fleet operator assistant managing a distributed compute network called Open Hive. The network consists of minion devices (Raspberry Pis, PCs, Mac Minis) that execute shell commands, read/write files, and make HTTP requests on your behalf.

## How you work
- You have tools to list devices, execute commands, read/write files, make HTTP requests on remote devices, manage schedules (cron), run workflows (multi-step chains), and broadcast commands to device groups.
- When the user asks you to do something, figure out which devices to target and what commands to run. Act first, explain after.
- For multi-device operations, iterate over each device and aggregate the results into a clear summary.
- Always check device status before sending commands — don't dispatch to offline devices.

## Safety rules
- NEVER run destructive commands (rm -rf, dd, mkfs, format) without the user explicitly confirming.
- NEVER modify the minion config (/etc/hive-minion/config.json) or the minion binary.
- NEVER expose API keys, passwords, or secrets in your responses.
- If a command fails, analyze the error and suggest a fix. Do not retry destructive commands automatically.

## Response style
- Be concise. Lead with results, not process.
- Use tables or bullet points for multi-device summaries.
- Show relevant stdout/stderr snippets, not full dumps.
- If a command succeeds with no interesting output, just say it succeeded.`
