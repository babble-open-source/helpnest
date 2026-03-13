import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HelpNest } from '../index';
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
function mockResponse(data, status = 200) {
    return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? 'OK' : 'Error',
        json: () => Promise.resolve(data),
    });
}
describe('HelpNest SDK — Articles', () => {
    let client;
    beforeEach(() => {
        mockFetch.mockReset();
        client = new HelpNest({
            apiKey: 'test-key',
            workspace: 'test-workspace',
            baseUrl: 'http://localhost:3000',
        });
    });
    it('lists articles', async () => {
        const articles = [{ id: '1', title: 'Hello', slug: 'hello' }];
        mockFetch.mockReturnValueOnce(mockResponse(articles));
        const result = await client.articles.list();
        expect(result).toEqual(articles);
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/articles'), expect.objectContaining({ method: 'GET' }));
    });
    it('lists articles with status filter', async () => {
        mockFetch.mockReturnValueOnce(mockResponse([]));
        await client.articles.list({ status: 'PUBLISHED' });
        const url = mockFetch.mock.calls[0][0];
        expect(url).toContain('status=PUBLISHED');
    });
    it('gets an article by slug', async () => {
        const article = { id: '1', title: 'Hello', slug: 'hello' };
        mockFetch.mockReturnValueOnce(mockResponse(article));
        const result = await client.articles.get('hello');
        expect(result).toEqual(article);
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/articles/hello'), expect.anything());
    });
    it('creates an article', async () => {
        const created = { id: '2', title: 'New Article', slug: 'new-article', status: 'DRAFT' };
        mockFetch.mockReturnValueOnce(mockResponse(created));
        const result = await client.articles.create({
            title: 'New Article',
            content: '# Hello',
            collectionId: 'col-1',
        });
        expect(result).toEqual(created);
        expect(mockFetch).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ title: 'New Article', content: '# Hello', collectionId: 'col-1' }),
        }));
    });
    it('updates an article', async () => {
        const updated = { id: '1', status: 'PUBLISHED' };
        mockFetch.mockReturnValueOnce(mockResponse(updated));
        const result = await client.articles.update('1', { status: 'PUBLISHED' });
        expect(result).toEqual(updated);
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/articles/1'), expect.objectContaining({ method: 'PATCH' }));
    });
    it('deletes an article', async () => {
        mockFetch.mockReturnValueOnce(mockResponse({ success: true }));
        const result = await client.articles.delete('1');
        expect(result).toEqual({ success: true });
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/articles/1'), expect.objectContaining({ method: 'DELETE' }));
    });
    it('searches articles', async () => {
        const results = [{ id: '1', title: 'Hello', slug: 'hello', snippet: '...', collection: { title: 'General', slug: 'general' }, readTime: 2 }];
        mockFetch.mockReturnValueOnce(mockResponse({ results }));
        const result = await client.articles.search('hello');
        expect(result).toEqual(results);
        const url = mockFetch.mock.calls[0][0];
        expect(url).toContain('/api/search');
        expect(url).toContain('q=hello');
    });
    it('throws HelpNestError on API error', async () => {
        mockFetch.mockReturnValueOnce(mockResponse({ error: 'Not found' }, 404));
        const { HelpNestError } = await import('../index');
        await expect(client.articles.get('nonexistent')).rejects.toThrow(HelpNestError);
    });
    it('sends auth header', async () => {
        mockFetch.mockReturnValueOnce(mockResponse([]));
        await client.articles.list();
        expect(mockFetch).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            headers: expect.objectContaining({
                Authorization: 'Bearer test-key',
            }),
        }));
    });
});
