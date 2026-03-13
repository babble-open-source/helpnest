'use client';
import { useState } from 'react';
import Link from 'next/link';
const tabs = [
    { key: 'escalated', label: 'Escalated' },
    { key: 'active', label: 'Active' },
    { key: 'resolved', label: 'Resolved' },
];
export function InboxList({ escalated, active, resolved }) {
    const [activeTab, setActiveTab] = useState('escalated');
    const conversations = activeTab === 'escalated' ? escalated : activeTab === 'active' ? active : resolved;
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
    function tabCount(key) {
        return key === 'escalated' ? escalated.length : key === 'active' ? active.length : resolved.length;
    }
    return (<div>
      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-border">
        {tabs.map((tab) => {
            const count = tabCount(tab.key);
            return (<button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key
                    ? 'border-ink text-ink'
                    : 'border-transparent text-muted hover:text-ink'}`}>
              {tab.label}
              {count > 0 && (<span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${tab.key === 'escalated'
                        ? 'bg-accent/10 text-accent'
                        : 'bg-border text-muted'}`}>
                  {count}
                </span>)}
            </button>);
        })}
      </div>

      {/* Conversation list */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {conversations.length === 0 ? (<div className="p-8 text-center">
            <p className="text-muted text-sm">
              {activeTab === 'escalated'
                ? 'No escalated conversations. All clear!'
                : activeTab === 'active'
                    ? 'No active conversations right now.'
                    : 'No resolved conversations yet.'}
            </p>
          </div>) : (<div className="divide-y divide-border">
            {conversations.map((conv) => (<Link key={conv.id} href={`/dashboard/inbox/${conv.id}`} className="flex items-center gap-4 p-4 hover:bg-cream/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-ink truncate text-sm">
                      {conv.customerName ?? conv.customerEmail ?? 'Anonymous'}
                    </p>
                    {conv.aiConfidence !== null && (<span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${conv.aiConfidence >= 0.7
                        ? 'bg-green/10 text-green'
                        : conv.aiConfidence >= 0.3
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-accent/10 text-accent'}`}>
                        {Math.round(conv.aiConfidence * 100)}%
                      </span>)}
                  </div>
                  <p className="text-sm text-ink/80 truncate">
                    {conv.subject ?? conv.firstMessage ?? 'No messages yet'}
                  </p>
                  {conv.escalationReason && activeTab === 'escalated' && (<p className="text-xs text-accent mt-1 truncate">{conv.escalationReason}</p>)}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted">{timeAgo(conv.updatedAt)}</p>
                  <p className="text-xs text-muted mt-1">{conv.messageCount} msgs</p>
                  {conv.assignedTo && (<p className="text-xs text-green mt-1">{conv.assignedTo}</p>)}
                </div>
              </Link>))}
          </div>)}
      </div>
    </div>);
}
