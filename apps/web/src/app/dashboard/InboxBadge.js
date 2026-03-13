'use client';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
export function InboxBadge({ workspaceId }) {
    const [count, setCount] = useState(0);
    const prevCount = useRef(null);
    useEffect(() => {
        async function fetchCount() {
            try {
                const res = await fetch('/api/conversations/count');
                if (!res.ok)
                    return;
                const data = (await res.json());
                const n = data.escalated;
                if (prevCount.current !== null && n > prevCount.current) {
                    toast('New escalation', {
                        description: 'A customer is waiting for human support.',
                        action: {
                            label: 'View',
                            onClick: () => { window.location.href = '/dashboard/inbox'; },
                        },
                        duration: 8000,
                    });
                }
                prevCount.current = n;
                setCount(n);
            }
            catch {
                // ignore network errors
            }
        }
        fetchCount();
        const interval = setInterval(fetchCount, 10_000);
        return () => clearInterval(interval);
    }, [workspaceId]);
    if (count === 0)
        return null;
    return (<span className="ml-auto text-xs font-semibold bg-accent text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
      {count > 99 ? '99+' : count}
    </span>);
}
