import type { HttpClient } from '../http'
import type {
  Collection,
  CreateCollectionParams,
  ListCollectionsParams,
  PaginatedResponse,
  UpdateCollectionParams,
} from '../types'

export class CollectionsResource {
  constructor(private http: HttpClient) {}

  /**
   * List all collections in the workspace.
   */
  async list(params?: ListCollectionsParams): Promise<PaginatedResponse<Collection>> {
    return this.http.get<PaginatedResponse<Collection>>('/collections', params as Record<string, string | number | boolean | undefined>)
  }

  /**
   * Get a single collection by its ID or slug.
   */
  async get(idOrSlug: string): Promise<Collection> {
    return this.http.get<Collection>(`/collections/${idOrSlug}`)
  }

  /**
   * Create a new collection.
   */
  async create(params: CreateCollectionParams): Promise<Collection> {
    return this.http.post<Collection>('/collections', params)
  }

  /**
   * Update a collection by ID.
   */
  async update(id: string, params: UpdateCollectionParams): Promise<Collection> {
    return this.http.patch<Collection>(`/collections/${id}`, params)
  }

  /**
   * Delete a collection by ID.
   */
  async delete(id: string): Promise<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`/collections/${id}`)
  }
}
