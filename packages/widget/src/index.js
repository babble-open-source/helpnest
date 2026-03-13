import { HelpPanel } from './panel';
function init() {
    const script = document.currentScript
        ?? document.querySelector('script[data-workspace]');
    if (!script)
        return;
    const workspace = script.dataset['workspace'];
    if (!workspace) {
        console.warn('[HelpNest] Missing data-workspace attribute');
        return;
    }
    const baseUrl = script.dataset['baseUrl']
        ?? (typeof window !== 'undefined' ? window.location.origin : '');
    const position = script.dataset['position'] ?? 'bottom-right';
    const title = script.dataset['title'] ?? 'How can we help?';
    const mode = script.dataset['mode'] ?? 'chat';
    const greeting = script.dataset['greeting'] ?? 'Hi! How can I help you today?';
    const panel = new HelpPanel({ workspace, baseUrl, position, title, mode, greeting });
    if ('requestIdleCallback' in window) {
        requestIdleCallback(() => panel.mount(), { timeout: 2000 });
    }
    else {
        setTimeout(() => panel.mount(), 0);
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
}
else {
    init();
}
