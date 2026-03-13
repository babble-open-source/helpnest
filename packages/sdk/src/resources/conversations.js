export class ConversationsResource {
    http;
    constructor(http) {
        this.http = http;
    }
    /**
     * List conversations in the workspace.
     * Optionally filter by status or paginate.
     */
    async list(params) {
        const q = new URLSearchParams();
        if (params?.status)
            q.set('status', params.status);
        if (params?.page)
            q.set('page', String(params.page));
        if (params?.limit)
            q.set('limit', String(params.limit));
        const qs = q.toString();
        return this.http.get(`/conversations${qs ? `?${qs}` : ''}`);
    }
    /**
     * Get a single conversation by ID.
     */
    async get(id) {
        return this.http.get(`/conversations/${id}`);
    }
    /**
     * Start a new conversation.
     */
    async create(params) {
        return this.http.post('/conversations', params);
    }
    /**
     * Update the status of a conversation.
     * Optionally provide a resolution summary when closing or resolving.
     */
    async updateStatus(id, status, resolutionSummary) {
        return this.http.patch(`/conversations/${id}`, { status, resolutionSummary });
    }
    /**
     * Assign a conversation to a team member. Pass null to unassign.
     */
    async assign(id, memberId) {
        return this.http.post(`/conversations/${id}/assign`, { memberId });
    }
}
export class MessagesResource {
    http;
    constructor(http) {
        this.http = http;
    }
    /**
     * List messages in a conversation.
     * Optionally pass an ISO timestamp to fetch only messages since that point.
     */
    async list(conversationId, since) {
        const q = since ? `?since=${encodeURIComponent(since)}` : '';
        return this.http.get(`/conversations/${conversationId}/messages${q}`);
    }
    /**
     * Send a message in a conversation.
     */
    async send(conversationId, params) {
        return this.http.post(`/conversations/${conversationId}/messages`, params);
    }
}
