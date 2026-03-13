'use client';
import { useEffect, useState } from 'react';
export function EditorOutline({ editor }) {
    const [headings, setHeadings] = useState([]);
    useEffect(() => {
        function extract() {
            const h = [];
            editor.state.doc.descendants((node, pos) => {
                if (node.type.name === 'heading') {
                    h.push({ level: node.attrs.level, text: node.textContent, pos });
                }
            });
            setHeadings(h);
        }
        extract();
        editor.on('update', extract);
        return () => { editor.off('update', extract); };
    }, [editor]);
    return (<aside className="w-56 bg-white border-r border-border flex flex-col shrink-0 overflow-y-auto">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-xs font-medium text-muted uppercase tracking-wide">Outline</p>
      </div>
      {headings.length === 0 ? (<p className="p-4 text-xs text-muted/60 text-center leading-relaxed">
          Add headings to see an outline
        </p>) : (<nav className="p-2 space-y-0.5">
          {headings.map((h, i) => (<button key={i} onClick={() => editor.chain().focus().setTextSelection(h.pos + 1).run()} className={`w-full text-left rounded px-2 py-1 hover:bg-cream text-ink/70 hover:text-ink transition-colors truncate ${h.level === 1
                    ? 'text-sm font-medium'
                    : h.level === 2
                        ? 'text-xs pl-4'
                        : 'text-xs pl-6 text-muted'}`}>
              {h.text || <span className="italic text-muted/40">Empty heading</span>}
            </button>))}
        </nav>)}
    </aside>);
}
