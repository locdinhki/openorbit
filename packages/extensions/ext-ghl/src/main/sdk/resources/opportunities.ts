import type { GHLClient } from '../client'
import type {
  CreateOpportunityInput,
  OpportunityListResponse,
  OpportunityResponse,
  Pipeline,
  SearchParams,
  UpdateOpportunityInput
} from '../types'

export class Opportunities {
  constructor(private client: GHLClient) {}

  list(
    locationId: string,
    params?: { limit?: number; skip?: number; pipelineId?: string }
  ): Promise<OpportunityListResponse> {
    const query: Record<string, string> = { locationId }
    if (params?.limit) query.limit = String(params.limit)
    if (params?.skip) query.skip = String(params.skip)
    if (params?.pipelineId) query.pipelineId = params.pipelineId
    return this.client.get<OpportunityListResponse>('/opportunities/search', query)
  }

  get(opportunityId: string): Promise<OpportunityResponse> {
    return this.client.get<OpportunityResponse>(`/opportunities/${opportunityId}`)
  }

  create(data: CreateOpportunityInput): Promise<OpportunityResponse> {
    return this.client.post<OpportunityResponse>('/opportunities/', data)
  }

  update(opportunityId: string, data: UpdateOpportunityInput): Promise<OpportunityResponse> {
    return this.client.put<OpportunityResponse>(`/opportunities/${opportunityId}`, data)
  }

  delete(opportunityId: string): Promise<void> {
    return this.client.delete<void>(`/opportunities/${opportunityId}`)
  }

  updateStatus(
    opportunityId: string,
    status: 'open' | 'won' | 'lost' | 'abandoned'
  ): Promise<OpportunityResponse> {
    return this.client.put<OpportunityResponse>(`/opportunities/${opportunityId}/status`, {
      status
    })
  }

  upsert(data: CreateOpportunityInput): Promise<OpportunityResponse> {
    return this.client.post<OpportunityResponse>('/opportunities/upsert', data)
  }

  search(params: SearchParams): Promise<OpportunityListResponse> {
    const query: Record<string, string> = {}
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined) query[key] = String(val)
    }
    return this.client.get<OpportunityListResponse>('/opportunities/search', query)
  }

  getPipelines(locationId: string): Promise<{ pipelines: Pipeline[] }> {
    return this.client.get<{ pipelines: Pipeline[] }>('/opportunities/pipelines', { locationId })
  }
}
