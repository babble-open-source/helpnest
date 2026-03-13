export class ArticlesResource {
    http;
    constructor(http) {
        this.http = http;
    }
    /**
     * List articles in the workspace.
     * Optionally filter by collection, status, or paginate.
     */
    async list(params) {
        return this.http.get('/articles', params);
    }
    /**
     * Get a single article by its ID or slug.
     */
    async get(idOrSlug) {
        return this.http.get(`/articles/${idOrSlug}`);
    }
    /**
     * Create a new article. Returns the created article.
     */
    async create(params) {
        return this.http.post('/articles', params);
    }
    /**
     * Update an article by ID. Only provided fields are updated.
     */
    async update(id, params) {
        return this.http.patch(`/articles/${id}`, params);
    }
    /**
     * Delete an article by ID.
     */
    async delete(id) {
        return this.http.delete(`/articles/${id}`);
    }
    /**
     * Search articles using full-text search.
     */
    async search(query) {
        const res = await this.http.get('/search', { q: query });
        return res.results;
    }
    /**
     * List version history for an article.
     */
    async listVersions(articleId) {
        return this.http.get(`/articles/${articleId}/versions`);
    }
    /**
     * Save a new version snapshot for an article.
     */
    async createVersion(articleId, params) {
        return this.http.post(`/articles/${articleId}/versions`, params);
    }
}
