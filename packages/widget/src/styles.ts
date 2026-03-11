export const styles = `
  #helpnest-launcher {
    --color-cream: 247 244 238;
    --color-ink: 26 24 20;
    --color-muted: 122 117 108;
    --color-border: 226 221 213;
    --color-accent: 200 98 42;
    --color-green: 45 106 79;
    --color-white: 255 255 255;
    --font-heading: Georgia, serif;
    --font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --radius: 8px;
    --radius-sm: max(calc(var(--radius) - 2px), 0px);
    --radius-lg: calc(var(--radius) + 4px);

    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 999998;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 12px;
    font-family: var(--font-body);
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  #helpnest-launcher.position-left {
    right: auto;
    left: 24px;
    align-items: flex-start;
  }

  #helpnest-btn {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: rgb(var(--color-ink));
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
    transition: transform 0.2s, box-shadow 0.2s;
    color: rgb(var(--color-cream));
  }

  #helpnest-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 20px rgba(0,0,0,0.25);
  }

  #helpnest-btn svg {
    width: 22px;
    height: 22px;
    transition: opacity 0.15s;
  }

  #helpnest-panel {
    width: 340px;
    max-height: 480px;
    background: rgb(var(--color-cream));
    border-radius: var(--radius-lg);
    box-shadow: 0 8px 40px rgba(0,0,0,0.18);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: helpnest-slide-up 0.2s ease;
    border: 1px solid rgb(var(--color-border));
  }

  @keyframes helpnest-slide-up {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  #helpnest-panel.hidden {
    display: none;
  }

  .hn-panel-header {
    background: rgb(var(--color-ink));
    color: rgb(var(--color-cream));
    padding: 16px;
  }

  .hn-panel-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
    min-width: 0;
  }

  .hn-panel-logo {
    display: none;
    height: 34px;
    min-width: 34px;
    max-width: 132px;
    width: auto;
    flex-shrink: 0;
    border-radius: var(--radius-sm);
    background: rgb(var(--color-white));
    object-fit: contain;
    object-position: left center;
    padding: 4px 8px;
  }

  .hn-panel-logo-text {
    display: none;
    max-width: 132px;
    flex-shrink: 1;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: rgb(var(--color-cream));
    font-family: var(--font-brand, var(--font-heading));
    font-size: 20px;
    line-height: 1;
  }

  .hn-panel-header h3 {
    margin: 0;
    min-width: 0;
    font-size: 15px;
    font-weight: 600;
    font-family: var(--font-heading);
  }

  .hn-ai-header-note {
    margin: -2px 0 0 0;
    font-size: 11px;
    line-height: 1.35;
    color: rgb(var(--color-cream) / 0.78);
  }

  .hn-search-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgb(var(--color-white) / 0.1);
    border-radius: var(--radius);
    padding: 8px 12px;
  }

  .hn-search-wrap svg {
    width: 14px;
    height: 14px;
    color: rgb(var(--color-cream) / 0.5);
    flex-shrink: 0;
  }

  .hn-search-input {
    background: transparent;
    border: none;
    outline: none;
    color: rgb(var(--color-cream));
    font-size: 13px;
    width: 100%;
  }

  .hn-search-input::placeholder { color: rgb(var(--color-cream) / 0.4); }

  .hn-panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  .hn-results-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .hn-result-item {
    padding: 10px 12px;
    border-radius: var(--radius);
    cursor: pointer;
    transition: background 0.1s;
    border: 1px solid transparent;
  }

  .hn-result-item:hover {
    background: rgb(var(--color-white));
    border-color: rgb(var(--color-border));
  }

  .hn-result-title {
    font-size: 13px;
    font-weight: 500;
    color: rgb(var(--color-ink));
    margin: 0 0 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .hn-result-meta {
    font-size: 11px;
    color: rgb(var(--color-muted));
    margin: 0;
  }

  .hn-empty {
    text-align: center;
    padding: 24px 12px;
    color: rgb(var(--color-muted));
    font-size: 13px;
  }

  .hn-ai-view {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  #helpnest-panel.hn-ai-mode .hn-panel-body {
    overflow: hidden;
    padding-bottom: 0;
    display: flex;
    flex-direction: column;
  }

  #helpnest-panel.hn-ai-mode .hn-ai-view {
    flex: 1;
    min-height: 0;
  }

  .hn-ai-composer {
    position: relative;
    z-index: 1;
    flex-shrink: 0;
    background: rgb(var(--color-cream));
    margin: 0;
    padding: 10px 0 0;
    border-top: 1px solid rgb(var(--color-border) / 0.8);
    box-shadow: none;
  }

  .hn-ai-head {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }

  .hn-ai-helper {
    margin: 0;
    font-size: 12px;
    color: rgb(var(--color-muted));
  }

  .hn-ai-back {
    border: 1px solid rgb(var(--color-border));
    border-radius: var(--radius-sm);
    background: rgb(var(--color-white));
    color: rgb(var(--color-ink));
    font-size: 11px;
    font-weight: 600;
    padding: 7px 10px;
    cursor: pointer;
  }

  .hn-ai-back:hover {
    border-color: rgb(var(--color-ink));
  }

  .hn-ai-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .hn-ai-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .hn-ai-input {
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
    min-height: 72px;
    border: 1px solid rgb(var(--color-border));
    border-radius: var(--radius);
    background: rgb(var(--color-white));
    color: rgb(var(--color-ink));
    font-family: inherit;
    font-size: 13px;
    line-height: 1.45;
    padding: 8px 10px;
    outline: none;
  }

  .hn-ai-input::placeholder {
    color: rgb(var(--color-muted));
  }

  .hn-ai-input:focus {
    border-color: rgb(var(--color-green));
    box-shadow: 0 0 0 2px rgb(var(--color-green) / 0.2);
  }

  .hn-ai-submit {
    border: none;
    border-radius: var(--radius-sm);
    background: rgb(var(--color-green));
    color: rgb(var(--color-white));
    font-size: 12px;
    font-weight: 600;
    padding: 7px 12px;
    cursor: pointer;
    transition: opacity 0.1s;
  }

  .hn-ai-submit:hover { opacity: 0.92; }
  .hn-ai-submit:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .hn-ai-status {
    margin: 2px 0 0;
    min-height: 16px;
    font-size: 12px;
    color: rgb(var(--color-muted));
  }

  .hn-ai-output {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 2px;
    padding-bottom: 10px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    min-height: 0;
    flex: 1;
  }

  .hn-ai-answer {
    overflow-wrap: anywhere;
    font-size: 13px;
    line-height: 1.55;
    color: rgb(var(--color-ink));
  }

  .hn-ai-answer p {
    margin: 0 0 10px;
  }

  .hn-ai-answer p:last-child {
    margin-bottom: 0;
  }

  .hn-ai-answer ul,
  .hn-ai-answer ol {
    margin: 0 0 10px 18px;
    padding: 0;
  }

  .hn-ai-answer li {
    margin: 0 0 4px;
  }

  .hn-ai-answer strong {
    font-weight: 700;
  }

  .hn-ai-answer em {
    font-style: italic;
  }

  .hn-ai-answer code {
    border: 1px solid rgb(var(--color-border));
    border-radius: var(--radius-sm);
    background: rgb(var(--color-white));
    padding: 0.12em 0.35em;
    font-size: 12px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  .hn-ai-answer pre {
    margin: 0 0 10px;
    border: 1px solid rgb(var(--color-border));
    border-radius: var(--radius);
    background: rgb(var(--color-white));
    padding: 8px 10px;
    overflow-x: auto;
  }

  .hn-ai-answer pre code {
    border: 0;
    border-radius: 0;
    background: transparent;
    padding: 0;
    white-space: pre;
    display: block;
  }

  .hn-ai-answer blockquote {
    margin: 0 0 10px;
    padding: 6px 10px;
    border-left: 3px solid rgb(var(--color-border));
    color: rgb(var(--color-muted));
    font-style: italic;
  }

  .hn-ai-answer a {
    color: rgb(var(--color-accent));
    text-decoration: underline;
  }

  .hn-ai-answer .hn-ai-h1,
  .hn-ai-answer .hn-ai-h2,
  .hn-ai-answer .hn-ai-h3 {
    font-weight: 700;
    margin: 0 0 8px;
  }

  .hn-ai-answer .hn-ai-h1 {
    font-size: 16px;
  }

  .hn-ai-answer .hn-ai-h2 {
    font-size: 15px;
  }

  .hn-ai-answer .hn-ai-h3 {
    font-size: 14px;
  }

  .hn-ai-sources-title {
    margin: 0 0 6px;
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: rgb(var(--color-muted));
    font-weight: 700;
  }

  .hn-ai-sources {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .hn-ai-source {
    border: 1px solid rgb(var(--color-border));
    border-radius: var(--radius-sm);
    background: rgb(var(--color-white));
    padding: 7px 9px;
  }

  .hn-ai-source a {
    display: block;
    color: rgb(var(--color-ink));
    text-decoration: none;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 2px;
  }

  .hn-ai-source a:hover {
    color: rgb(var(--color-accent));
  }

  .hn-ai-source span {
    font-size: 11px;
    color: rgb(var(--color-muted));
  }

  .hn-skeleton {
    height: 12px;
    background: rgb(var(--color-border));
    border-radius: var(--radius-sm);
    margin: 8px 0;
    animation: hn-pulse 1.2s ease-in-out infinite;
  }

  @keyframes hn-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .hn-panel-footer {
    border-top: 1px solid rgb(var(--color-border));
    padding: 10px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .hn-footer-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 500;
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid rgb(var(--color-border));
    background: rgb(var(--color-white));
    color: rgb(var(--color-ink));
    cursor: pointer;
    text-decoration: none;
    transition: border-color 0.1s;
  }

  .hn-footer-btn:hover { border-color: rgb(var(--color-ink)); }

  .hn-ai-btn {
    background: rgb(var(--color-green));
    color: rgb(var(--color-white));
    border-color: transparent;
    font-size: 11px;
  }

  .hn-ai-btn:hover { border-color: transparent; opacity: 0.9; }

  .hn-powered {
    font-size: 10px;
    color: rgb(var(--color-muted));
    text-align: center;
    padding: 6px;
  }

  .hn-powered a { color: rgb(var(--color-muted)); text-decoration: none; }
  .hn-powered a:hover { color: rgb(var(--color-ink)); }
`
