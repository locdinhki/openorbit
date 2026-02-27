// ============================================================================
// ext-jobs — AI Tool Definitions for job search queries
// ============================================================================

import type { AIToolDefinition } from '@openorbit/core/ai/provider-types'

export const JOBS_TOOLS: AIToolDefinition[] = [
  {
    name: 'list_jobs',
    description: 'Search and list job listings with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['new', 'reviewed', 'approved', 'rejected', 'applied', 'skipped', 'error'],
          description: 'Filter by job status'
        },
        platform: {
          type: 'string',
          description: 'Filter by platform (linkedin, indeed, upwork)'
        },
        minScore: {
          type: 'number',
          description: 'Minimum match score (0-100)'
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default 10)'
        }
      }
    }
  },
  {
    name: 'get_job',
    description:
      'Get full details of a specific job listing including description, match score, and analysis',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: 'The job ID' }
      },
      required: ['jobId']
    }
  },
  {
    name: 'list_profiles',
    description:
      'List all search profiles (each defines platform, keywords, location, salary filters)',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_profile',
    description: 'Get details of a specific search profile by ID',
    inputSchema: {
      type: 'object',
      properties: {
        profileId: { type: 'string' }
      },
      required: ['profileId']
    }
  },
  {
    name: 'list_answer_templates',
    description: 'List saved answer templates for application questions',
    inputSchema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          description: 'Filter templates by platform (optional)'
        }
      }
    }
  },
  {
    name: 'find_answer',
    description: 'Find a matching saved answer for an application question pattern',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The application question to match against' }
      },
      required: ['question']
    }
  }
]

export const JOBS_SYSTEM_PROMPT = `You are a job search assistant in OpenOrbit. You help the user find, analyze, and strategize about job opportunities.

Use the available tools to query real data before answering questions about jobs, profiles, or applications. Do not guess — look up the data first.

When discussing jobs:
- Reference specific details (title, company, match score, red flags, highlights)
- Compare jobs objectively when asked
- Be direct about fit and potential issues

When discussing profiles:
- Explain what keywords, locations, and filters are configured
- Suggest improvements based on results

Format responses with markdown: use **bold** for emphasis, bullet lists for comparisons, and code blocks for data summaries when appropriate.`
