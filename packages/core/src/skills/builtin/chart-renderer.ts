// ============================================================================
// OpenOrbit — Chart Renderer Library
//
// Wrapper around ChartJSNodeCanvas for generating chart images.
// Supports bar, line, pie, and doughnut charts with a professional color palette.
// ============================================================================

// Note: canvas is a native module that requires electron-rebuild
// We use dynamic imports to handle cases where canvas isn't available

export type ChartType = 'bar' | 'line' | 'pie' | 'doughnut'

export interface ChartDataset {
  label?: string
  data: number[]
  backgroundColor?: string | string[]
  borderColor?: string | string[]
  borderWidth?: number
  fill?: boolean
}

export interface ChartInput {
  type: ChartType
  title?: string
  labels: string[]
  datasets: ChartDataset[]
  width?: number
  height?: number
}

export interface ChartOutput {
  base64: string
  width: number
  height: number
  mimeType: 'image/png'
}

// ---------------------------------------------------------------------------
// Professional color palette (6 colors)
// ---------------------------------------------------------------------------

export const CHART_COLORS = {
  blue: '#3B82F6',
  green: '#10B981',
  yellow: '#F59E0B',
  red: '#EF4444',
  purple: '#8B5CF6',
  pink: '#EC4899'
} as const

export const CHART_COLOR_PALETTE = Object.values(CHART_COLORS)

// Semi-transparent versions for backgrounds
export const CHART_BG_PALETTE = CHART_COLOR_PALETTE.map((c) => `${c}80`) // 50% opacity

// ---------------------------------------------------------------------------
// Lazy singleton for ChartJSNodeCanvas
// ---------------------------------------------------------------------------

let chartServicePromise: Promise<ChartService | null> | null = null

interface ChartService {
  renderToBuffer(config: unknown): Promise<Buffer>
}

async function getChartService(): Promise<ChartService | null> {
  if (!chartServicePromise) {
    chartServicePromise = initChartService()
  }
  return chartServicePromise
}

async function initChartService(): Promise<ChartService | null> {
  try {
    // Dynamic import to handle cases where canvas isn't installed
    const { ChartJSNodeCanvas } = await import('chartjs-node-canvas')

    const chartJSNodeCanvas = new ChartJSNodeCanvas({
      width: 800,
      height: 600,
      backgroundColour: 'white'
    })

    return {
      renderToBuffer: (config: unknown) =>
        chartJSNodeCanvas.renderToBuffer(
          config as Parameters<typeof chartJSNodeCanvas.renderToBuffer>[0]
        )
    }
  } catch (err) {
    console.error('Failed to initialize chart service:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Chart rendering
// ---------------------------------------------------------------------------

function applyDefaultColors(datasets: ChartDataset[], chartType: ChartType): ChartDataset[] {
  return datasets.map((dataset, index) => {
    const color = CHART_COLOR_PALETTE[index % CHART_COLOR_PALETTE.length]
    const bgColor = CHART_BG_PALETTE[index % CHART_BG_PALETTE.length]

    // For pie/doughnut, use array of colors for each segment
    if (chartType === 'pie' || chartType === 'doughnut') {
      const segmentColors = dataset.data.map(
        (_, i) => CHART_COLOR_PALETTE[i % CHART_COLOR_PALETTE.length]
      )
      const segmentBgColors = dataset.data.map(
        (_, i) => CHART_BG_PALETTE[i % CHART_BG_PALETTE.length]
      )
      return {
        ...dataset,
        backgroundColor: dataset.backgroundColor ?? segmentBgColors,
        borderColor: dataset.borderColor ?? segmentColors,
        borderWidth: dataset.borderWidth ?? 2
      }
    }

    // For bar/line charts
    return {
      ...dataset,
      backgroundColor: dataset.backgroundColor ?? (chartType === 'bar' ? bgColor : color),
      borderColor: dataset.borderColor ?? color,
      borderWidth: dataset.borderWidth ?? 2,
      fill: dataset.fill ?? (chartType === 'line' ? false : undefined)
    }
  })
}

export async function renderChart(input: ChartInput): Promise<ChartOutput> {
  const service = await getChartService()
  if (!service) {
    throw new Error(
      'Chart service not available. Make sure canvas is installed and rebuilt for Electron.'
    )
  }

  const width = input.width ?? 800
  const height = input.height ?? 600

  // Apply default colors to datasets
  const datasets = applyDefaultColors(input.datasets, input.type)

  const configuration = {
    type: input.type,
    data: {
      labels: input.labels,
      datasets
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: !!input.title,
          text: input.title ?? '',
          font: {
            size: 18,
            weight: 'bold' as const
          },
          padding: {
            top: 10,
            bottom: 20
          }
        },
        legend: {
          display: datasets.length > 1 || input.type === 'pie' || input.type === 'doughnut',
          position: 'bottom' as const,
          labels: {
            padding: 20,
            font: {
              size: 12
            }
          }
        }
      },
      scales:
        input.type === 'pie' || input.type === 'doughnut'
          ? undefined
          : {
              x: {
                grid: {
                  display: false
                },
                ticks: {
                  font: {
                    size: 11
                  }
                }
              },
              y: {
                beginAtZero: true,
                grid: {
                  color: '#E5E7EB'
                },
                ticks: {
                  font: {
                    size: 11
                  }
                }
              }
            }
    }
  }

  // Create a custom-sized canvas for this render
  const { ChartJSNodeCanvas } = await import('chartjs-node-canvas')
  const customCanvas = new ChartJSNodeCanvas({
    width,
    height,
    backgroundColour: 'white'
  })

  const buffer = await customCanvas.renderToBuffer(
    configuration as Parameters<typeof customCanvas.renderToBuffer>[0]
  )
  const base64 = buffer.toString('base64')

  return {
    base64,
    width,
    height,
    mimeType: 'image/png'
  }
}

// ---------------------------------------------------------------------------
// Pre-warm the chart service (call during app startup)
// ---------------------------------------------------------------------------

export async function warmupChartService(): Promise<boolean> {
  const service = await getChartService()
  return service !== null
}
