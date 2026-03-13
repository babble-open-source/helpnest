'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
export function KnowledgeGapsList({ unresolved, resolved, workspaceSlug }) {
    const [activeTab, setActiveTab] = useState('unresolved');
    const [resolving, setResolving] = useState(null);
    const router = useRouter();
    // workspaceSlug is available for future use (e.g. linking to the help center)
    void workspaceSlug;
    const gaps = activeTab === 'unresolved' ? unresolved : resolved;
    async function handleResolve(gapId) {
        setResolving(gapId);
        try {
            await fetch('/api/knowledge-gaps', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: gapId }),
            });
            router.refresh();
        }
        finally {
            setResolving(null);
        }
    }
    function timeAgo(dateStr) {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1)
            return 'just now';
        if (mins < 60)
            return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24)
            return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }
    return (<div>
      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-border">
        <button onClick={() => setActiveTab('unresolved')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'unresolved'
            ? 'border-ink text-ink'
            : 'border-transparent text-muted hover:text-ink'}`}>
          Unresolved
          {unresolved.length > 0 && (<span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
              {unresolved.length}
            </span>)}
        </button>
        <button onClick={() => setActiveTab('resolved')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'resolved'
            ? 'border-ink text-ink'
            : 'border-transparent text-muted hover:text-ink'}`}>
          Resolved
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {gaps.length === 0 ? (<div className="p-8 text-center">
            <p className="text-muted text-sm">
              {activeTab === 'unresolved'
                ? 'No knowledge gaps detected yet. AI is answering everything confidently!'
                : 'No resolved gaps yet.'}
            </p>
          </div>) : (<div className="divide-y divide-border">
            {gaps.map((gap) => (<div key={gap.id} className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink text-sm">{gap.query}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted">
                      Asked {gap.occurrences} {gap.occurrences === 1 ? 'time' : 'times'}
                    </span>
                    <span className="text-xs text-muted">
                      Last seen {timeAgo(gap.lastSeenAt)}
                    </span>
                    {gap.resolvedArticle && (<span className="text-xs text-green">
                        Resolved with: {gap.resolvedArticle.title}
                      </span>)}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {activeTab === 'unresolved' && (<>
                      <Link href={`/dashboard/articles/new?title=${encodeURIComponent(gap.query)}`} className="px-3 py-1.5 text-xs font-medium bg-green text-white rounded-lg hover:bg-green/90">
                        Write Article
                      </Link>
                      <button onClick={() => handleResolve(gap.id)} disabled={resolving === gap.id} className="px-3 py-1.5 text-xs font-medium border border-border text-muted rounded-lg hover:bg-border/30 disabled:opacity-50">
                        {resolving === gap.id ? 'Resolving...' : 'Mark Resolved'}
                      </button>
                    </>)}
                  {activeTab === 'resolved' && gap.resolvedBy && (<span className="text-xs text-muted">by {gap.resolvedBy}</span>)}
                </div>
              </div>))}
          </div>)}
      </div>
    </div>);
}
