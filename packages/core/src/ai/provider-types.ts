// ============================================================================
// OpenOrbit — AI Provider Types
//
// Unified interfaces for the AI Provider Registry. Any AI provider extension
// (Claude, OpenAI, Ollama, etc.) implements `AIProvider` to plug into the
// shell's provider system.
// ============================================================================

// ---------------------------------------------------------------------------
// Model tiers — abstract over provider-specific model names
// ---------------------------------------------------------------------------

/** Model capability tier used for routing instead of provider-specific task enums. */
export type ModelTier = 'fast' | 'standard' | 'premium'

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** Unified chat message format across all providers. */
export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/** Single-turn completion request. */
export interface AICompletionRequest {
  systemPrompt: string
  userMessage: string
  /** Model tier — defaults to 'standard' if omitted. */
  tier?: ModelTier
  /** Max tokens for the response. Defaults to 2048. */
  maxTokens?: number
  /** Task identifier for usage tracking (e.g. 'score_job', 'chat'). */
  task?: string
}

/** Multi-turn chat request. */
export interface AIChatRequest {
  systemPrompt: string
  messages: AIMessage[]
  /** Model tier — defaults to 'standard' if omitted. */
  tier?: ModelTier
  /** Max tokens for the response. Defaults to 2048. */
  maxTokens?: number
  /** Task identifier for usage tracking. */
  task?: string
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

/** Response from a completion or chat request. */
export interface AICompletionResponse {
  /** The generated text content. */
  content: string
  /** The actual model ID used (e.g. 'claude-sonnet-4-5-20250929'). */
  model: string
  /** Token usage for the request. */
  usage: {
    inputTokens: number
    outputTokens: number
  }
}

/** A single chunk emitted during streaming. */
export interface AIStreamChunk {
  /** Incremental text content (empty on final chunk). */
  delta: string
  /** True when this is the final chunk. */
  done: boolean
  /** Populated only on the final chunk. */
  model?: string
  /** Populated only on the final chunk. */
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

// ---------------------------------------------------------------------------
// Tool / Function calling
// ---------------------------------------------------------------------------

/** JSON Schema definition for a tool parameter. */
export interface AIToolParameterSchema {
  type: string
  description?: string
  properties?: Record<string, AIToolParameterSchema>
  required?: string[]
  items?: AIToolParameterSchema
  enum?: string[]
}

/** Tool definition passed to the model. */
export interface AIToolDefinition {
  /** Unique name for this tool (e.g. 'get_weather'). */
  name: string
  /** Description of what the tool does. */
  description: string
  /** JSON Schema describing the tool's input parameters. */
  inputSchema: AIToolParameterSchema
}

/** A tool use request returned by the model. */
export interface AIToolCall {
  /** Tool call ID for correlating with tool results. */
  id: string
  /** Name of the tool to call. */
  name: string
  /** Parsed input arguments. */
  input: Record<string, unknown>
}

/** Result of a tool execution, sent back to the model. */
export interface AIToolResult {
  /** Matches the tool call ID. */
  toolCallId: string
  /** Stringified result. */
  content: string
  /** Whether the tool errored. */
  isError?: boolean
}

/** Request with tool definitions. */
export interface AIToolRequest extends AICompletionRequest {
  /** Available tools for the model to use. */
  tools: AIToolDefinition[]
}

/** Response that may include tool calls. */
export interface AIToolResponse extends AICompletionResponse {
  /** Tool calls the model wants to make (empty if none). */
  toolCalls: AIToolCall[]
  /** Whether the model wants to use tools ('tool_use') or just respond ('end_turn'). */
  stopReason: 'end_turn' | 'tool_use'
}

// ---------------------------------------------------------------------------
// Vision
// ---------------------------------------------------------------------------

/** Image content for vision requests. */
export interface AIImageContent {
  type: 'image'
  /** Base64-encoded image data. */
  data: string
  /** MIME type (e.g. 'image/png', 'image/jpeg'). */
  mediaType: string
}

/** A message that can contain text and/or images. */
export interface AIMultimodalMessage {
  role: 'user' | 'assistant'
  content: (string | AIImageContent)[]
}

// ---------------------------------------------------------------------------
// Provider capabilities
// ---------------------------------------------------------------------------

/** Describes what a provider supports. */
export interface AIProviderCapabilities {
  streaming: boolean
  toolCalling: boolean
  vision: boolean
  /** Available model IDs for this provider. */
  models: string[]
}

// ---------------------------------------------------------------------------
// Provider info (safe to expose to renderer)
// ---------------------------------------------------------------------------

/** Summary of a registered provider — no secrets, safe for IPC/renderer. */
export interface AIProviderInfo {
  id: string
  displayName: string
  configured: boolean
  capabilities: AIProviderCapabilities
}

// ---------------------------------------------------------------------------
// AIProvider — the interface every provider extension must implement
// ---------------------------------------------------------------------------

export interface AIProvider {
  /** Unique provider identifier, e.g. 'claude', 'openai', 'ollama'. */
  readonly id: string
  /** Human-readable name, e.g. 'Claude (Anthropic)'. */
  readonly displayName: string
  /** What this provider supports. */
  readonly capabilities: AIProviderCapabilities

  /** Single-turn completion. */
  complete(request: AICompletionRequest): Promise<AICompletionResponse>

  /** Multi-turn chat. */
  chat(request: AIChatRequest): Promise<AICompletionResponse>

  /** Streaming completion — yields chunks. Only required if capabilities.streaming is true. */
  stream?(
    request: AICompletionRequest,
    onChunk: (chunk: AIStreamChunk) => void
  ): Promise<AICompletionResponse>

  /** Tool-calling completion. Only required if capabilities.toolCalling is true. */
  completeWithTools?(request: AIToolRequest): Promise<AIToolResponse>

  /** Whether the provider has valid configuration (API keys, connection, etc.). */
  isConfigured(): boolean

  /** Reset cached clients (e.g. after API key change). Optional. */
  resetClient?(): void
}

// ---------------------------------------------------------------------------
// AI Service facade — exposed to extensions via SharedServices.ai
// ---------------------------------------------------------------------------

/** The AI service interface available to extensions via `ctx.services.ai`. */
export interface AIService {
  /** Register a new AI provider (called by provider extensions). */
  registerProvider(provider: AIProvider): void
  /** Get a provider by ID, or the default provider if no ID given. */
  getProvider(id?: string): AIProvider | undefined
  /** List all registered providers (safe for renderer). */
  listProviders(): AIProviderInfo[]
  /** Set the default provider by ID. */
  setDefault(id: string): void
  /** Single-turn completion via the default (or specified) provider. */
  complete(request: AICompletionRequest, providerId?: string): Promise<AICompletionResponse>
  /** Multi-turn chat via the default (or specified) provider. */
  chat(request: AIChatRequest, providerId?: string): Promise<AICompletionResponse>
  /** Streaming completion via the default (or specified) provider. */
  stream?(
    request: AICompletionRequest,
    onChunk: (chunk: AIStreamChunk) => void,
    providerId?: string
  ): Promise<AICompletionResponse>
}
