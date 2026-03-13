export class CollectionsResource {
    http;
    constructor(http) {
        this.http = http;
    }
    /**
     * List all collections in the workspace.
     */
    async list(params) {
        return this.http.get('/collections', params);
    }
    /**
     * Get a single collection by its ID or slug.
     */
    async get(idOrSlug) {
        return this.http.get(`/collections/${idOrSlug}`);
    }
    /**
     * Create a new collection.
     */
    async create(params) {
        return this.http.post('/collections', params);
    }
    /**
     * Update a collection by ID.
     */
    async update(id, params) {
        return this.http.patch(`/collections/${id}`, params);
    }
    /**
     * Delete a collection by ID.
     */
    async delete(id) {
        return this.http.delete(`/collections/${id}`);
    }
}
