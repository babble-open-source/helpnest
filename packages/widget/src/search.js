export async function searchArticles(query, workspace, baseUrl) {
    if (query.length < 2)
        return [];
    try {
        const url = `${baseUrl}/api/search?q=${encodeURIComponent(query)}&workspace=${workspace}`;
        const res = await fetch(url);
        if (!res.ok)
            return [];
        const data = await res.json();
        return data.results ?? [];
    }
    catch {
        return [];
    }
}
