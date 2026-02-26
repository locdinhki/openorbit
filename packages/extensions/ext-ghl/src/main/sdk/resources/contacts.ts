import type { GHLClient } from '../client'
import type {
  ContactListResponse,
  ContactResponse,
  CreateContactInput,
  SearchParams,
  UpdateContactInput
} from '../types'

export class Contacts {
  constructor(private client: GHLClient) {}

  list(
    locationId: string,
    params?: { limit?: number; skip?: number; query?: string }
  ): Promise<ContactListResponse> {
    const query: Record<string, string> = { locationId }
    if (params?.limit) query.limit = String(params.limit)
    if (params?.skip) query.skip = String(params.skip)
    if (params?.query) query.query = params.query
    return this.client.get<ContactListResponse>('/contacts/', query)
  }

  get(contactId: string): Promise<ContactResponse> {
    return this.client.get<ContactResponse>(`/contacts/${contactId}`)
  }

  create(data: CreateContactInput): Promise<ContactResponse> {
    return this.client.post<ContactResponse>('/contacts/', data)
  }

  update(contactId: string, data: UpdateContactInput): Promise<ContactResponse> {
    return this.client.put<ContactResponse>(`/contacts/${contactId}`, data)
  }

  delete(contactId: string): Promise<void> {
    return this.client.delete<void>(`/contacts/${contactId}`)
  }

  upsert(data: CreateContactInput): Promise<ContactResponse> {
    return this.client.post<ContactResponse>('/contacts/upsert', data)
  }

  search(params: SearchParams): Promise<ContactListResponse> {
    const query: Record<string, string> = {}
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined) query[key] = String(val)
    }
    return this.client.get<ContactListResponse>('/contacts/search', query)
  }
}
