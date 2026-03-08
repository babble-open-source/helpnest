export const styles = `
  #helpnest-launcher {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 999998;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
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
    background: #1A1814;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
    transition: transform 0.2s, box-shadow 0.2s;
    color: #F7F4EE;
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
    background: #F7F4EE;
    border-radius: 16px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.18);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: helpnest-slide-up 0.2s ease;
    border: 1px solid #E2DDD5;
  }

  @keyframes helpnest-slide-up {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  #helpnest-panel.hidden {
    display: none;
  }

  .hn-panel-header {
    background: #1A1814;
    color: #F7F4EE;
    padding: 16px;
  }

  .hn-panel-header h3 {
    margin: 0 0 10px;
    font-size: 15px;
    font-weight: 600;
  }

  .hn-search-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255,255,255,0.1);
    border-radius: 8px;
    padding: 8px 12px;
  }

  .hn-search-wrap svg {
    width: 14px;
    height: 14px;
    color: rgba(247,244,238,0.5);
    flex-shrink: 0;
  }

  .hn-search-input {
    background: transparent;
    border: none;
    outline: none;
    color: #F7F4EE;
    font-size: 13px;
    width: 100%;
  }

  .hn-search-input::placeholder { color: rgba(247,244,238,0.4); }

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
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.1s;
    border: 1px solid transparent;
  }

  .hn-result-item:hover {
    background: #fff;
    border-color: #E2DDD5;
  }

  .hn-result-title {
    font-size: 13px;
    font-weight: 500;
    color: #1A1814;
    margin: 0 0 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .hn-result-meta {
    font-size: 11px;
    color: #7A756C;
    margin: 0;
  }

  .hn-empty {
    text-align: center;
    padding: 24px 12px;
    color: #7A756C;
    font-size: 13px;
  }

  .hn-skeleton {
    height: 12px;
    background: #E2DDD5;
    border-radius: 4px;
    margin: 8px 0;
    animation: hn-pulse 1.2s ease-in-out infinite;
  }

  @keyframes hn-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .hn-panel-footer {
    border-top: 1px solid #E2DDD5;
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
    border-radius: 6px;
    border: 1px solid #E2DDD5;
    background: #fff;
    color: #1A1814;
    cursor: pointer;
    text-decoration: none;
    transition: border-color 0.1s;
  }

  .hn-footer-btn:hover { border-color: #1A1814; }

  .hn-ai-btn {
    background: #2D6A4F;
    color: #fff;
    border-color: transparent;
    font-size: 11px;
  }

  .hn-ai-btn:hover { border-color: transparent; opacity: 0.9; }

  .hn-powered {
    font-size: 10px;
    color: #7A756C;
    text-align: center;
    padding: 6px;
  }

  .hn-powered a { color: #7A756C; text-decoration: none; }
  .hn-powered a:hover { color: #1A1814; }
`
