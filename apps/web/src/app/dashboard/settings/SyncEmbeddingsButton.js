'use client';
import { useState } from 'react';
export function SyncEmbeddingsButton({ workspaceId }) {
    const [status, setStatus] = useState('idle');
    const [result, setResult] = useState(null);
    async function sync() {
        setStatus('syncing');
        setResult(null);
        try {
            const res = await fetch('/api/embeddings/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceId }),
            });
            const data = await res.json();
            setResult(data);
            setStatus('done');
        }
        catch {
            setStatus('error');
        }
    }
    return (<div>
      <div className="flex items-center gap-3">
        <button onClick={sync} disabled={status === 'syncing'} className="bg-green text-white px-4 py-2 rounded-lg text-sm hover:bg-green/90 transition-colors disabled:opacity-50">
          {status === 'syncing' ? 'Syncing...' : 'Sync AI embeddings'}
        </button>
        {status === 'done' && result && (<span className="text-sm text-green-700">
            ✓ {result.articles} articles, {result.points} chunks indexed
          </span>)}
        {status === 'error' && (<span className="text-sm text-red-600">Sync failed — check OPENAI_API_KEY and QDRANT_URL</span>)}
      </div>
      <p className="text-xs text-muted mt-1">
        Required for AI-powered search. Run after publishing or updating articles.
      </p>
    </div>);
}
