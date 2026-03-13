export class HttpClient {
    baseUrl;
    workspace;
    apiKey;
    constructor(config) {
        this.baseUrl = (config.baseUrl ?? 'https://helpnest.cloud').replace(/\/$/, '');
        this.workspace = config.workspace;
        this.apiKey = config.apiKey;
    }
    buildUrl(path, params) {
        const url = new URL(`${this.baseUrl}/api${path}`);
        url.searchParams.set('workspace', this.workspace);
        if (params) {
            for (const [key, value] of Object.entries(params)) {
                if (value !== undefined) {
                    url.searchParams.set(key, String(value));
                }
            }
        }
        return url.toString();
    }
    get headers() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'X-HelpNest-Workspace': this.workspace,
        };
    }
    async get(path, params) {
        const res = await fetch(this.buildUrl(path, params), {
            method: 'GET',
            headers: this.headers,
        });
        return this.handleResponse(res);
    }
    async post(path, body) {
        const res = await fetch(this.buildUrl(path), {
            method: 'POST',
            headers: this.headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        return this.handleResponse(res);
    }
    async patch(path, body) {
        const res = await fetch(this.buildUrl(path), {
            method: 'PATCH',
            headers: this.headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        return this.handleResponse(res);
    }
    async delete(path) {
        const res = await fetch(this.buildUrl(path), {
            method: 'DELETE',
            headers: this.headers,
        });
        return this.handleResponse(res);
    }
    async handleResponse(res) {
        if (!res.ok) {
            let message = `HelpNest API error: ${res.status} ${res.statusText}`;
            try {
                const err = await res.json();
                if (err.error)
                    message = `HelpNest API error: ${err.error}`;
            }
            catch { }
            throw new HelpNestError(message, res.status);
        }
        return res.json();
    }
}
export class HelpNestError extends Error {
    statusCode;
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'HelpNestError';
    }
}
