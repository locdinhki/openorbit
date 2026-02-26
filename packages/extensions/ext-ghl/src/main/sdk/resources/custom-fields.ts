import type { GHLClient } from '../client'
import type {
  CreateCustomFieldInput,
  CustomFieldDef,
  CustomFieldListResponse,
  CustomFieldResponse
} from '../types'

export class CustomFields {
  constructor(private client: GHLClient) {}

  list(locationId: string): Promise<CustomFieldListResponse> {
    return this.client.get<CustomFieldListResponse>(`/locations/${locationId}/customFields`)
  }

  get(locationId: string, fieldId: string): Promise<CustomFieldResponse> {
    return this.client.get<CustomFieldResponse>(`/locations/${locationId}/customFields/${fieldId}`)
  }

  create(locationId: string, data: CreateCustomFieldInput): Promise<CustomFieldResponse> {
    return this.client.post<CustomFieldResponse>(`/locations/${locationId}/customFields`, data)
  }

  update(
    locationId: string,
    fieldId: string,
    data: Partial<CreateCustomFieldInput>
  ): Promise<CustomFieldResponse> {
    return this.client.put<CustomFieldResponse>(
      `/locations/${locationId}/customFields/${fieldId}`,
      data
    )
  }

  delete(locationId: string, fieldId: string): Promise<void> {
    return this.client.delete<void>(`/locations/${locationId}/customFields/${fieldId}`)
  }

  async findOrCreate(locationId: string, name: string, dataType: string): Promise<CustomFieldDef> {
    const { customFields } = await this.list(locationId)
    const existing = customFields.find((f) => f.name.toLowerCase() === name.toLowerCase())
    if (existing) return existing

    const { customField } = await this.create(locationId, { name, dataType })
    return customField
  }
}
