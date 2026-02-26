import type { GHLClient } from '../client'
import type {
  ConversationListResponse,
  ConversationResponse,
  CreateConversationInput,
  MessageListResponse,
  MessageResponse,
  SendMessageInput
} from '../types'

export class Conversations {
  constructor(private client: GHLClient) {}

  list(
    locationId: string,
    params?: { limit?: number; skip?: number; contactId?: string }
  ): Promise<ConversationListResponse> {
    const query: Record<string, string> = { locationId }
    if (params?.limit) query.limit = String(params.limit)
    if (params?.skip) query.skip = String(params.skip)
    if (params?.contactId) query.contactId = params.contactId
    return this.client.get<ConversationListResponse>('/conversations/search', query)
  }

  get(conversationId: string): Promise<ConversationResponse> {
    return this.client.get<ConversationResponse>(`/conversations/${conversationId}`)
  }

  create(data: CreateConversationInput): Promise<ConversationResponse> {
    return this.client.post<ConversationResponse>('/conversations/', data)
  }

  update(
    conversationId: string,
    data: Partial<{ assignedTo: string; starred: boolean; unreadCount: number }>
  ): Promise<ConversationResponse> {
    return this.client.put<ConversationResponse>(`/conversations/${conversationId}`, data)
  }

  delete(conversationId: string): Promise<void> {
    return this.client.delete<void>(`/conversations/${conversationId}`)
  }

  getMessages(
    conversationId: string,
    params?: { limit?: number; lastMessageId?: string }
  ): Promise<MessageListResponse> {
    const query: Record<string, string> = {}
    if (params?.limit) query.limit = String(params.limit)
    if (params?.lastMessageId) query.lastMessageId = params.lastMessageId
    return this.client.get<MessageListResponse>(`/conversations/${conversationId}/messages`, query)
  }

  sendMessage(data: SendMessageInput): Promise<MessageResponse> {
    return this.client.post<MessageResponse>('/conversations/messages', data)
  }
}
