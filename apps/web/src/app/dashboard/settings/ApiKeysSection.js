'use client';
import { useState, useEffect, useCallback } from 'react';
function formatDate(iso) {
    if (!iso)
        return 'Never';
    return new Date(iso).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}
export function ApiKeysSection({ demoMode = false }) {
    const [keys, setKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [newRawKey, setNewRawKey] = useState(null);
    const [copied, setCopied] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [error, setError] = useState(null);
    const fetchKeys = useCallback(async () => {
        try {
            const res = await fetch('/api/api-keys');
            if (!res.ok)
                throw new Error('Failed to load API keys');
            const data = await res.json();
            setKeys(data.keys);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        void fetchKeys();
    }, [fetchKeys]);
    async function handleCreate(e) {
        e.preventDefault();
        const name = newKeyName.trim();
        if (!name)
            return;
        setCreating(true);
        setError(null);
        try {
            const res = await fetch('/api/api-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            if (!res.ok) {
                const body = await res.json();
                throw new Error(body.error ?? 'Failed to create key');
            }
            const created = await res.json();
            setNewRawKey(created.key);
            setNewKeyName('');
            await fetchKeys();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        }
        finally {
            setCreating(false);
        }
    }
    async function handleDelete(id, name) {
        if (!confirm(`Delete API key "${name}"? This cannot be undone.`))
            return;
        setDeletingId(id);
        setError(null);
        try {
            const res = await fetch(`/api/api-keys/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const body = await res.json();
                throw new Error(body.error ?? 'Failed to delete key');
            }
            setKeys((prev) => prev.filter((k) => k.id !== id));
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        }
        finally {
            setDeletingId(null);
        }
    }
    async function handleCopy() {
        if (!newRawKey)
            return;
        await navigator.clipboard.writeText(newRawKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
    return (<div className="bg-white rounded-xl border border-border p-6">
      <h2 className="font-medium text-ink mb-1">API Keys</h2>
      <p className="text-sm text-muted mb-4">
        API keys allow external tools and the CLI to authenticate with your workspace.
        Only Owners and Admins can create or revoke keys.
      </p>

      {demoMode && (<p className="text-xs text-muted border border-border rounded-lg px-3 py-2 bg-cream mb-4">
          API key management is disabled in demo mode.
        </p>)}

      {error && (<div className="mb-4 rounded-lg bg-cream border border-border px-4 py-3 text-sm text-red-500">
          {error}
        </div>)}

      {/* New raw key reveal — shown once immediately after creation */}
      {newRawKey && (<div className="mb-6 rounded-lg border border-accent/30 bg-accent/5 p-4">
          <p className="text-sm font-medium text-ink mb-2">
            Store this key — it will not be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 block rounded bg-white border border-border px-3 py-2 text-sm font-mono text-ink break-all">
              {newRawKey}
            </code>
            <button type="button" onClick={() => void handleCopy()} className="shrink-0 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-cream transition-colors">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button type="button" onClick={() => setNewRawKey(null)} className="mt-3 text-xs text-muted underline hover:no-underline">
            I have saved this key, dismiss
          </button>
        </div>)}

      {/* Create form */}
      {!demoMode && (<form onSubmit={(e) => void handleCreate(e)} className="flex gap-2 mb-6">
          <input type="text" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Key name, e.g. CI deploy" maxLength={100} className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40" disabled={creating}/>
          <button type="submit" disabled={creating || !newKeyName.trim()} className="rounded-lg bg-ink text-cream px-4 py-2 text-sm font-medium hover:bg-ink/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {creating ? 'Creating…' : 'Create'}
          </button>
        </form>)}

      {/* Key list */}
      {loading ? (<p className="text-sm text-muted">Loading…</p>) : keys.length === 0 ? (<p className="text-sm text-muted">No API keys yet.</p>) : (<ul className="divide-y divide-border">
          {keys.map((key) => (<li key={key.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-ink">{key.name}</p>
                <p className="text-xs text-muted mt-0.5">
                  Created {formatDate(key.createdAt)}
                  {' · '}
                  Last used {formatDate(key.lastUsedAt)}
                </p>
              </div>
              {!demoMode && (<button type="button" disabled={deletingId === key.id} onClick={() => void handleDelete(key.id, key.name)} className="ml-4 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-cream disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {deletingId === key.id ? 'Revoking…' : 'Revoke'}
                </button>)}
            </li>))}
        </ul>)}
    </div>);
}
