'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
const EMOJI_OPTIONS = ['📁', '📄', '🚀', '⚡', '🛠️', '💡', '🎯', '📚', '🔧', '✨', '🌟', '🔑'];
export function NewCollectionModal() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [emoji, setEmoji] = useState('📁');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    function reset() {
        setTitle('');
        setDescription('');
        setEmoji('📁');
        setError('');
    }
    function close() {
        reset();
        setOpen(false);
    }
    async function submit(e) {
        e.preventDefault();
        if (!title.trim())
            return;
        setSaving(true);
        setError('');
        try {
            const res = await fetch('/api/collections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: title.trim(), description: description.trim(), emoji }),
            });
            if (!res.ok) {
                const data = await res.json();
                setError(data.error ?? 'Something went wrong');
                return;
            }
            close();
            router.refresh();
        }
        catch {
            setError('Something went wrong');
        }
        finally {
            setSaving(false);
        }
    }
    return (<>
      <button onClick={() => setOpen(true)} className="bg-ink text-cream px-4 py-2 rounded-lg text-sm hover:bg-ink/90 transition-colors font-medium">
        + New Collection
      </button>

      {open && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40" onClick={close}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-medium text-ink">New Collection</h2>
              <button onClick={close} className="text-muted hover:text-ink transition-colors">
                &#x2715;
              </button>
            </div>

            <form onSubmit={submit} className="p-6 space-y-4">
              {/* Emoji picker */}
              <div>
                <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-2">
                  Icon
                </label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map((e) => (<button key={e} type="button" onClick={() => setEmoji(e)} className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-colors ${emoji === e
                    ? 'bg-ink text-cream'
                    : 'bg-cream hover:bg-border'}`}>
                      {e}
                    </button>))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1.5">
                  Title <span className="text-accent">*</span>
                </label>
                <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Getting Started" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-white text-ink" required/>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1.5">
                  Description
                </label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description shown under the collection title" rows={2} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none bg-white text-ink"/>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={close} className="px-4 py-2 text-sm text-muted hover:text-ink transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving || !title.trim()} className="bg-ink text-cream px-4 py-2 rounded-lg text-sm hover:bg-ink/90 transition-colors font-medium disabled:opacity-50">
                  {saving ? 'Creating…' : 'Create collection'}
                </button>
              </div>
            </form>
          </div>
        </div>)}
    </>);
}
