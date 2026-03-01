// ============================================================================
// OpenOrbit — Chart Render Skill
//
// Skill wrapper for chart-renderer library. Generates chart images
// from structured data. Supports bar, line, pie, and doughnut charts.
// ============================================================================

import type { Skill, SkillResult } from '../skill-types'
import {
  renderChart,
  CHART_COLOR_PALETTE,
  type ChartType,
  type ChartDataset
} from './chart-renderer'

const CHART_TYPES: ChartType[] = ['bar', 'line', 'pie', 'doughnut']

export function createChartRenderSkill(extensionId: string): Skill {
  return {
    id: 'chart-render',
    displayName: 'Chart Renderer',
    icon: 'bar-chart-2',
    description: `Generate chart images from data. Supports chart types: ${CHART_TYPES.join(', ')}. Returns a PNG image as base64.`,
    category: 'media',
    extensionId,
    capabilities: {
      aiTool: true,
      offlineCapable: true,
      streaming: false
    },
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: `Chart type: ${CHART_TYPES.join(', ')}`,
          enum: CHART_TYPES
        },
        title: {
          type: 'string',
          description: 'Chart title (displayed at top)'
        },
        labels: {
          type: 'array',
          description:
            'X-axis labels (categories) for bar/line charts, or segment labels for pie/doughnut',
          items: { type: 'string' }
        },
        datasets: {
          type: 'array',
          description: 'Data series to plot. Each dataset has a label and data array.',
          items: {
            type: 'object',
            properties: {
              label: {
                type: 'string',
                description: 'Dataset label (shown in legend)'
              },
              data: {
                type: 'array',
                description: 'Numeric data values',
                items: { type: 'number' }
              },
              backgroundColor: {
                type: 'string',
                description: 'Fill color (hex or rgba). Auto-assigned if not provided.'
              },
              borderColor: {
                type: 'string',
                description: 'Border/line color (hex or rgba). Auto-assigned if not provided.'
              },
              fill: {
                type: 'boolean',
                description: 'Fill area under line (for line charts)'
              }
            }
          }
        },
        width: {
          type: 'number',
          description: 'Image width in pixels (default: 800)'
        },
        height: {
          type: 'number',
          description: 'Image height in pixels (default: 600)'
        }
      },
      required: ['type', 'labels', 'datasets']
    },
    outputSchema: {
      type: 'object',
      description: 'Generated chart image',
      properties: {
        base64: { type: 'string', description: 'Base64-encoded PNG image' },
        width: { type: 'number', description: 'Image width in pixels' },
        height: { type: 'number', description: 'Image height in pixels' },
        mimeType: { type: 'string', description: 'Always image/png' }
      }
    },

    validate(input: Record<string, unknown>) {
      const errors: string[] = []

      if (!input.type || typeof input.type !== 'string') {
        errors.push('Missing or invalid chart type')
      } else if (!CHART_TYPES.includes(input.type as ChartType)) {
        errors.push(`Invalid chart type: ${input.type}. Valid types: ${CHART_TYPES.join(', ')}`)
      }

      if (!input.labels || !Array.isArray(input.labels)) {
        errors.push('Missing or invalid labels array')
      }

      if (!input.datasets || !Array.isArray(input.datasets)) {
        errors.push('Missing or invalid datasets array')
      } else {
        for (let i = 0; i < input.datasets.length; i++) {
          const ds = input.datasets[i] as ChartDataset
          if (!ds.data || !Array.isArray(ds.data)) {
            errors.push(`Dataset ${i}: missing or invalid data array`)
          }
        }
      }

      return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined }
    },

    async execute(input: Record<string, unknown>): Promise<SkillResult> {
      const type = input.type as ChartType
      const title = input.title as string | undefined
      const labels = input.labels as string[]
      const datasets = input.datasets as ChartDataset[]
      const width = input.width as number | undefined
      const height = input.height as number | undefined

      if (!type || !CHART_TYPES.includes(type)) {
        return { success: false, error: `Invalid chart type: ${type}` }
      }

      if (!labels || !Array.isArray(labels) || labels.length === 0) {
        return { success: false, error: 'Labels array is required and must not be empty' }
      }

      if (!datasets || !Array.isArray(datasets) || datasets.length === 0) {
        return { success: false, error: 'Datasets array is required and must not be empty' }
      }

      try {
        const result = await renderChart({
          type,
          title,
          labels,
          datasets,
          width,
          height
        })

        return {
          success: true,
          data: result,
          summary: `Generated ${type} chart (${result.width}x${result.height}px)`
        }
      } catch (err) {
        return {
          success: false,
          error: `Chart rendering failed: ${err instanceof Error ? err.message : String(err)}`
        }
      }
    }
  }
}

// Export color palette for external use
export { CHART_COLOR_PALETTE }
