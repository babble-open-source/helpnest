export const widgetStyles = `
  :host {
    --hn-cream: #F7F4EE;
    --hn-ink: #1A1814;
    --hn-muted: #7A756C;
    --hn-border: #E2DDD5;
    --hn-accent: #C8622A;
    --hn-green: #2D6A4F;
    --hn-white: #FFFFFF;
    --hn-radius: 8px;
    --hn-font-heading: 'Instrument Serif', Georgia, serif;
    --hn-font-body: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

    display: block;
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 999998;
    font-family: var(--hn-font-body);
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  /* ─── Launcher ──────────────────────────────────────────────────────────── */

  .hn-launcher {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--hn-ink);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
    color: var(--hn-cream);
    opacity: 0;
    transition: opacity 0.3s ease, transform 0.2s ease, box-shadow 0.2s ease;
  }

  .hn-launcher:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 20px rgba(0,0,0,0.25);
  }

  .hn-launcher:active {
    transform: scale(0.95);
  }

  .hn-launcher-icon {
    position: absolute;
    transition: opacity 0.2s ease, transform 0.3s ease;
  }

  .hn-launcher-open {
    opacity: 1;
    transform: rotate(0deg) scale(1);
  }

  .hn-launcher-close {
    opacity: 0;
    transform: rotate(90deg) scale(0.5);
  }

  .hn-launcher-active .hn-launcher-open {
    opacity: 0;
    transform: rotate(-90deg) scale(0.5);
  }

  .hn-launcher-active .hn-launcher-close {
    opacity: 1;
    transform: rotate(0deg) scale(1);
  }

  .hn-launcher-logo {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    object-fit: cover;
  }

  .hn-launcher-left {
    right: auto;
    left: 0;
  }

  /* ─── Panel ─────────────────────────────────────────────────────────────── */

  .hn-panel {
    position: absolute;
    bottom: 68px;
    right: 0;
    width: 400px;
    height: min(600px, calc(100vh - 120px));
    background: var(--hn-cream);
    border-radius: var(--hn-radius);
    box-shadow: 0 8px 40px rgba(0,0,0,0.18);
    border: 1px solid var(--hn-border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    opacity: 1;
    transform: translateY(0) scale(1);
    transition: opacity 0.2s ease, transform 0.2s ease;
  }

  .hn-panel-enter {
    animation: hn-panel-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .hn-panel-exit {
    animation: hn-panel-out 0.2s ease forwards;
    pointer-events: none;
  }

  .hn-launcher-left ~ .hn-panel {
    right: auto;
    left: 0;
  }

  .hn-panel-hidden {
    display: none;
  }

  @keyframes hn-panel-in {
    from { opacity: 0; transform: translateY(16px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes hn-panel-out {
    from { opacity: 1; transform: translateY(0) scale(1); }
    to   { opacity: 0; transform: translateY(12px) scale(0.97); }
  }

  @media (max-width: 480px) {
    :host {
      bottom: 0;
      right: 0;
      left: 0;
      top: 0;
    }

    .hn-launcher {
      position: fixed;
      bottom: 16px;
      right: 16px;
    }

    .hn-launcher-left {
      right: auto;
      left: 16px;
    }

    .hn-panel {
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      border-radius: 0;
      bottom: 0;
      right: 0;
    }
  }

  /* ─── View stack ─────────────────────────────────────────────────────────── */

  .hn-view-stack {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
    position: relative;
  }

  .hn-view-layer {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    will-change: transform, opacity;
  }

  /* Push: new view enters from right */
  .hn-enter-right {
    position: absolute;
    inset: 0;
    transform: translateX(100%);
    opacity: 0.5;
  }
  .hn-enter-right.hn-view-active {
    transform: translateX(0);
    opacity: 1;
  }

  /* Push: old view exits to left */
  .hn-exit-left {
    transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .hn-exit-left.hn-view-leaving {
    transform: translateX(-30%);
    opacity: 0;
  }

  /* Pop: new view enters from left */
  .hn-enter-left {
    position: absolute;
    inset: 0;
    transform: translateX(-30%);
    opacity: 0;
  }
  .hn-enter-left.hn-view-active {
    transform: translateX(0);
    opacity: 1;
  }

  /* Pop: old view exits to right */
  .hn-exit-right {
    transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .hn-exit-right.hn-view-leaving {
    transform: translateX(100%);
    opacity: 0.5;
  }

  /* Tab switch: crossfade */
  .hn-enter-fade {
    position: absolute;
    inset: 0;
    opacity: 0;
  }
  .hn-enter-fade.hn-view-active {
    opacity: 1;
  }

  .hn-exit-fade {
    transition: opacity 0.15s ease;
  }
  .hn-exit-fade.hn-view-leaving {
    opacity: 0;
  }

  .hn-view {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .hn-view-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  .hn-view-body-flush {
    padding: 0;
  }

  /* ─── Header ─────────────────────────────────────────────────────────────── */

  .hn-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--hn-border);
    flex-shrink: 0;
    background: var(--hn-cream);
  }

  .hn-header-left {
    display: flex;
    align-items: center;
  }

  .hn-header-right {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
  }

  .hn-header-back {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--hn-ink);
    border-radius: calc(var(--hn-radius) - 2px);
    flex-shrink: 0;
    padding: 0;
  }

  .hn-header-back:hover {
    background: var(--hn-border);
  }

  .hn-header-title {
    flex: 1;
    font-size: 14px;
    font-weight: 600;
    color: var(--hn-ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin: 0;
  }

  .hn-header-expand {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--hn-muted);
    border-radius: calc(var(--hn-radius) - 2px);
    flex-shrink: 0;
    padding: 0;
    text-decoration: none;
  }

  .hn-header-expand:hover {
    color: var(--hn-ink);
    background: var(--hn-border);
  }

  .hn-header-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--hn-muted);
    border-radius: calc(var(--hn-radius) - 2px);
    flex-shrink: 0;
    padding: 0;
  }

  .hn-header-close:hover {
    color: var(--hn-ink);
    background: var(--hn-border);
  }

  /* ─── Tab bar ────────────────────────────────────────────────────────────── */

  .hn-tab-bar {
    display: flex;
    border-top: 1px solid var(--hn-border);
    background: var(--hn-cream);
    flex-shrink: 0;
  }

  .hn-tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 8px 4px;
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--hn-muted);
    font-size: 11px;
    font-family: inherit;
    transition: color 0.15s ease, transform 0.1s ease;
  }

  .hn-tab:hover {
    color: var(--hn-ink);
  }

  .hn-tab:active {
    transform: scale(0.9);
  }

  .hn-tab-active {
    color: var(--hn-ink);
  }

  .hn-tab-label {
    font-size: 10px;
    font-weight: 500;
  }

  /* ─── Home ───────────────────────────────────────────────────────────────── */

  .hn-view-home {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .hn-home-hero {
    background: linear-gradient(135deg, var(--hn-ink), var(--hn-accent));
    padding: 24px 20px 28px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex-shrink: 0;
    position: relative;
  }

  .hn-home-close {
    position: absolute;
    top: 12px;
    right: 12px;
    background: none;
    border: none;
    cursor: pointer;
    color: rgba(255,255,255,0.6);
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s ease;
  }

  .hn-home-close:hover {
    color: rgba(255,255,255,0.9);
  }

  .hn-home-logo {
    height: 36px;
    width: auto;
    max-width: 120px;
    object-fit: contain;
    object-position: left center;
    border-radius: 4px;
  }

  .hn-home-logo-fallback {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255,255,255,0.2);
    color: var(--hn-white);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 600;
  }

  .hn-home-greeting {
    margin: 0;
    font-family: var(--hn-font-heading);
    font-size: 22px;
    font-weight: 400;
    color: var(--hn-white);
    line-height: 1.25;
  }

  .hn-home-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .hn-home-cta {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: var(--hn-white);
    border: 1px solid var(--hn-border);
    border-radius: var(--hn-radius);
    cursor: pointer;
    text-align: left;
    width: 100%;
    font-family: inherit;
    transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
  }

  .hn-home-cta:hover {
    border-color: var(--hn-ink);
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }

  .hn-home-cta:active {
    transform: scale(0.98);
  }

  .hn-home-cta-icon {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--hn-ink);
    color: var(--hn-cream);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .hn-home-cta-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .hn-home-cta-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--hn-ink);
  }

  .hn-home-cta-subtitle {
    font-size: 11px;
    color: var(--hn-muted);
  }

  .hn-home-cta-chevron {
    color: var(--hn-muted);
    flex-shrink: 0;
  }

  .hn-home-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .hn-home-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .hn-home-section-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--hn-muted);
  }

  .hn-home-view-all {
    font-size: 12px;
    color: var(--hn-accent);
    background: none;
    border: none;
    cursor: pointer;
    font-family: inherit;
    padding: 0;
    font-weight: 500;
  }

  .hn-home-collections {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .hn-home-collection-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: var(--hn-white);
    border: 1px solid var(--hn-border);
    border-radius: var(--hn-radius);
    cursor: pointer;
    text-align: left;
    width: 100%;
    font-family: inherit;
    transition: border-color 0.15s ease, transform 0.1s ease, background 0.15s ease;
  }

  .hn-home-collection-card:hover {
    border-color: var(--hn-ink);
  }

  .hn-home-collection-card:active {
    transform: scale(0.98);
    background: var(--hn-cream);
  }

  .hn-home-collection-icon {
    color: var(--hn-muted);
    flex-shrink: 0;
  }

  .hn-home-collection-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .hn-home-collection-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--hn-ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hn-home-collection-count {
    font-size: 11px;
    color: var(--hn-muted);
  }

  .hn-home-collection-chevron {
    color: var(--hn-muted);
    flex-shrink: 0;
  }

  .hn-home-footer {
    padding: 10px;
    text-align: center;
    flex-shrink: 0;
  }

  .hn-powered-by {
    font-size: 10px;
    color: var(--hn-muted);
  }

  .hn-powered-by a {
    color: var(--hn-muted);
    text-decoration: none;
  }

  .hn-powered-by a:hover {
    color: var(--hn-ink);
  }

  /* ─── Messages ───────────────────────────────────────────────────────────── */

  .hn-view-messages {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .hn-conv-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .hn-conv-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px 20px;
    color: var(--hn-muted);
  }

  .hn-conv-empty-icon {
    color: var(--hn-border);
  }

  .hn-conv-empty-text {
    font-size: 13px;
    margin: 0;
  }

  .hn-conv-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 16px;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--hn-border);
    cursor: pointer;
    text-align: left;
    width: 100%;
    font-family: inherit;
    transition: background 0.15s ease, transform 0.1s ease;
  }

  .hn-conv-row:hover {
    background: var(--hn-white);
  }

  .hn-conv-row:active {
    transform: scale(0.99);
    background: var(--hn-border);
  }

  .hn-conv-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 4px;
  }

  .hn-conv-status-green { background: var(--hn-green); }
  .hn-conv-status-orange { background: var(--hn-accent); }
  .hn-conv-status-muted { background: var(--hn-border); }

  .hn-conv-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .hn-conv-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }

  .hn-conv-subject {
    font-size: 13px;
    font-weight: 600;
    color: var(--hn-ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .hn-conv-time {
    font-size: 11px;
    color: var(--hn-muted);
    flex-shrink: 0;
  }

  .hn-conv-preview {
    font-size: 12px;
    color: var(--hn-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hn-messages-cta-wrap {
    padding: 12px 16px;
    flex-shrink: 0;
  }

  .hn-messages-cta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 10px 16px;
    background: var(--hn-ink);
    color: var(--hn-cream);
    border: none;
    border-radius: var(--hn-radius);
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: opacity 0.15s ease, transform 0.1s ease;
  }

  .hn-messages-cta:hover {
    opacity: 0.9;
  }

  .hn-messages-cta:active {
    transform: scale(0.97);
  }

  /* ─── Help ───────────────────────────────────────────────────────────────── */

  .hn-view-help {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .hn-help-search-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--hn-border);
    flex-shrink: 0;
  }

  .hn-search-bar {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--hn-white);
    border: 1px solid var(--hn-border);
    border-radius: var(--hn-radius);
    padding: 7px 10px;
  }

  .hn-search-bar:focus-within {
    border-color: var(--hn-ink);
  }

  .hn-search-icon {
    color: var(--hn-muted);
    flex-shrink: 0;
  }

  .hn-search-input {
    flex: 1;
    border: none;
    background: transparent;
    outline: none;
    font-size: 13px;
    font-family: inherit;
    color: var(--hn-ink);
  }

  .hn-search-input::placeholder {
    color: var(--hn-muted);
  }

  .hn-search-clear {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--hn-muted);
    padding: 0;
    border-radius: calc(var(--hn-radius) - 2px);
    flex-shrink: 0;
  }

  .hn-search-clear:hover {
    color: var(--hn-ink);
    background: var(--hn-border);
  }

  .hn-help-count {
    font-size: 12px;
    color: var(--hn-muted);
    margin: 0;
    padding: 12px 16px 8px;
    font-weight: 600;
  }

  .hn-help-collections {
    display: flex;
    flex-direction: column;
  }

  .hn-help-results {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .hn-help-no-results {
    padding: 32px 16px;
    text-align: center;
    color: var(--hn-muted);
    font-size: 13px;
  }

  .hn-help-no-results strong {
    color: var(--hn-ink);
  }

  /* Collection card (shared by help + collection-detail) */
  .hn-col-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--hn-border);
    cursor: pointer;
    text-align: left;
    width: 100%;
    font-family: inherit;
    transition: background 0.15s ease, transform 0.1s ease;
  }

  .hn-col-card:first-child {
    border-top: 1px solid var(--hn-border);
  }

  .hn-col-card:hover {
    background: var(--hn-white);
  }

  .hn-col-card:active {
    transform: scale(0.99);
    background: var(--hn-border);
  }

  .hn-col-card-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .hn-col-card-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--hn-ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hn-col-card-desc {
    font-size: 11px;
    color: var(--hn-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hn-col-card-count {
    font-size: 11px;
    color: var(--hn-muted);
  }

  .hn-col-card-chevron {
    color: var(--hn-muted);
    flex-shrink: 0;
  }

  /* Article row (shared by help + collection-detail) */
  .hn-article-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--hn-border);
    cursor: pointer;
    text-align: left;
    width: 100%;
    font-family: inherit;
    transition: background 0.15s ease, transform 0.1s ease;
  }

  .hn-article-row:hover {
    background: var(--hn-white);
  }

  .hn-article-row:active {
    transform: scale(0.99);
    background: var(--hn-border);
  }

  .hn-article-row-title {
    flex: 1;
    font-size: 13px;
    color: var(--hn-ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ─── Collection detail ──────────────────────────────────────────────────── */

  .hn-view-collection-detail {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .hn-col-detail-header {
    padding: 16px 16px 12px;
    border-bottom: 1px solid var(--hn-border);
    flex-shrink: 0;
  }

  .hn-col-detail-title {
    font-family: var(--hn-font-heading);
    font-size: 18px;
    font-weight: 400;
    color: var(--hn-ink);
    margin: 0 0 4px;
    line-height: 1.25;
  }

  .hn-col-detail-desc {
    font-size: 13px;
    color: var(--hn-muted);
    margin: 0;
    line-height: 1.5;
  }

  .hn-col-detail-subcols {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    margin-bottom: 4px;
  }

  .hn-col-detail-articles {
    display: flex;
    flex-direction: column;
  }

  .hn-col-detail-empty {
    font-size: 13px;
    color: var(--hn-muted);
    text-align: center;
    padding: 32px 16px;
    margin: 0;
  }

  /* ─── Article ────────────────────────────────────────────────────────────── */

  .hn-view-article {
    display: flex;
    flex-direction: column;
  }

  .hn-article-body {
    padding: 16px;
  }

  .hn-article-title {
    font-family: var(--hn-font-heading);
    font-size: 20px;
    font-weight: 400;
    color: var(--hn-ink);
    margin: 0 0 12px;
    line-height: 1.3;
  }

  .hn-article-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--hn-border);
  }

  .hn-article-author-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .hn-article-author-avatar-fallback {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--hn-border);
    color: var(--hn-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .hn-article-meta-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .hn-article-author-name {
    font-size: 12px;
    font-weight: 500;
    color: var(--hn-ink);
  }

  .hn-article-updated {
    font-size: 11px;
    color: var(--hn-muted);
  }

  .hn-article-content {
    font-size: 14px;
    line-height: 1.65;
    color: var(--hn-ink);
    overflow-wrap: anywhere;
  }

  .hn-article-content p {
    margin: 0 0 12px;
  }

  .hn-article-content p:last-child {
    margin-bottom: 0;
  }

  .hn-article-content h1,
  .hn-article-content h2 {
    font-family: var(--hn-font-heading);
    font-weight: 400;
    margin: 20px 0 10px;
    line-height: 1.25;
    color: var(--hn-ink);
  }

  .hn-article-content h1 { font-size: 20px; }
  .hn-article-content h2 { font-size: 18px; }
  .hn-article-content h3 { font-size: 16px; font-weight: 600; margin: 16px 0 8px; }
  .hn-article-content h4 { font-size: 14px; font-weight: 600; margin: 14px 0 6px; }

  .hn-article-content ul,
  .hn-article-content ol {
    margin: 0 0 12px 20px;
    padding: 0;
  }

  .hn-article-content li {
    margin: 0 0 4px;
  }

  .hn-article-content a {
    color: var(--hn-accent);
    text-decoration: underline;
  }

  .hn-article-content a:hover {
    opacity: 0.85;
  }

  .hn-article-content img {
    max-width: 100%;
    border-radius: calc(var(--hn-radius) - 2px);
    margin: 8px 0;
  }

  .hn-article-content hr {
    border: none;
    border-top: 1px solid var(--hn-border);
    margin: 16px 0;
  }

  .hn-article-content pre {
    background: var(--hn-white);
    border: 1px solid var(--hn-border);
    border-radius: var(--hn-radius);
    padding: 10px 12px;
    overflow-x: auto;
    margin: 0 0 12px;
  }

  .hn-article-content code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
  }

  .hn-article-content pre code {
    background: transparent;
    border: none;
    padding: 0;
    white-space: pre;
    display: block;
  }

  .hn-article-content :not(pre) > code {
    background: var(--hn-white);
    border: 1px solid var(--hn-border);
    border-radius: 4px;
    padding: 0.1em 0.35em;
  }

  .hn-article-open-link {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-top: 20px;
    font-size: 12px;
    color: var(--hn-muted);
    text-decoration: none;
    border: 1px solid var(--hn-border);
    border-radius: calc(var(--hn-radius) - 2px);
    padding: 6px 10px;
    transition: color 0.1s, border-color 0.1s;
  }

  .hn-article-open-link:hover {
    color: var(--hn-ink);
    border-color: var(--hn-ink);
  }

  /* ─── Feedback ───────────────────────────────────────────────────────────── */

  .hn-feedback {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--hn-border);
  }

  .hn-feedback-label {
    font-size: 12px;
    color: var(--hn-muted);
  }

  .hn-feedback-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border: 1px solid var(--hn-border);
    border-radius: calc(var(--hn-radius) - 2px);
    background: var(--hn-white);
    color: var(--hn-ink);
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
    transition: border-color 0.15s ease, transform 0.1s ease;
  }

  .hn-feedback-btn:hover {
    border-color: var(--hn-ink);
  }

  .hn-feedback-btn:active {
    transform: scale(0.95);
  }

  .hn-feedback-thanks {
    font-size: 12px;
    color: var(--hn-green);
    font-weight: 500;
  }

  /* ─── Chat ───────────────────────────────────────────────────────────────── */

  .hn-view-chat {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  /* Chat header — Intercom style with logo + name + status */
  .hn-chat-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--hn-border);
    flex-shrink: 0;
    background: var(--hn-cream);
  }

  .hn-chat-header-logo {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .hn-chat-header-logo-fallback {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--hn-ink);
    color: var(--hn-cream);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .hn-chat-header-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .hn-chat-header-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--hn-ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hn-chat-header-status {
    font-size: 11px;
    color: var(--hn-muted);
  }

  .hn-chat-messages {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
  }

  .hn-chat-spacer {
    flex: 1;
  }

  .hn-chat-greeting {
    font-size: 13px;
    color: var(--hn-muted);
    text-align: center;
    padding: 16px 24px 8px;
  }

  /* Messages */
  .hn-msg {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-width: 85%;
  }

  .hn-msg-right {
    align-self: flex-end;
    align-items: flex-end;
    margin-right: 2px;
  }

  .hn-msg-left {
    align-self: flex-start;
    align-items: flex-start;
  }

  .hn-msg-center {
    align-self: center;
    align-items: center;
    max-width: 100%;
  }

  .hn-msg-bubble {
    padding: 8px 14px;
    border-radius: 16px;
    font-size: 13px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .hn-msg-bubble p {
    margin: 0;
  }

  .hn-msg-bubble p + p {
    margin-top: 4px;
  }

  .hn-msg-customer .hn-msg-bubble {
    background: var(--hn-ink);
    color: var(--hn-cream);
    border-bottom-right-radius: 4px;
  }

  .hn-msg-ai .hn-msg-bubble {
    background: var(--hn-white);
    color: var(--hn-ink);
    border: 1px solid var(--hn-border);
    border-bottom-left-radius: 4px;
  }

  .hn-msg-agent .hn-msg-bubble {
    background: rgba(45,106,79,0.08);
    color: var(--hn-ink);
    border: 1px solid rgba(45,106,79,0.25);
    border-bottom-left-radius: 4px;
  }

  .hn-msg-system .hn-msg-bubble {
    background: transparent;
    color: var(--hn-muted);
    font-size: 11px;
    font-style: italic;
    border: none;
    padding: 2px 8px;
    text-align: center;
  }

  /* Markdown inside AI/agent bubbles */
  .hn-msg-ai .hn-msg-bubble p,
  .hn-msg-agent .hn-msg-bubble p {
    margin: 0 0 8px;
  }

  .hn-msg-ai .hn-msg-bubble p:last-child,
  .hn-msg-agent .hn-msg-bubble p:last-child {
    margin-bottom: 0;
  }

  .hn-msg-ai .hn-msg-bubble ul,
  .hn-msg-ai .hn-msg-bubble ol,
  .hn-msg-agent .hn-msg-bubble ul,
  .hn-msg-agent .hn-msg-bubble ol {
    margin: 0 0 8px 16px;
    padding: 0;
  }

  .hn-msg-ai .hn-msg-bubble li,
  .hn-msg-agent .hn-msg-bubble li {
    margin: 0 0 3px;
  }

  .hn-msg-ai .hn-msg-bubble strong,
  .hn-msg-agent .hn-msg-bubble strong {
    font-weight: 700;
  }

  .hn-msg-ai .hn-msg-bubble em,
  .hn-msg-agent .hn-msg-bubble em {
    font-style: italic;
  }

  .hn-msg-ai .hn-msg-bubble code,
  .hn-msg-agent .hn-msg-bubble code {
    border: 1px solid var(--hn-border);
    border-radius: 4px;
    background: var(--hn-cream);
    padding: 0.1em 0.3em;
    font-size: 12px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  .hn-msg-ai .hn-msg-bubble a,
  .hn-msg-agent .hn-msg-bubble a {
    color: var(--hn-accent);
    text-decoration: underline;
  }

  /* Sources */
  .hn-msg-sources {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    max-width: 88%;
    align-self: flex-start;
  }

  .hn-msg-source-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border: 1px solid var(--hn-border);
    border-radius: 999px;
    background: var(--hn-white);
    color: var(--hn-ink);
    font-size: 11px;
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
    transition: border-color 0.1s, background 0.1s;
    white-space: nowrap;
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .hn-msg-source-chip:hover {
    border-color: var(--hn-accent);
    background: rgba(200,98,42,0.06);
    color: var(--hn-accent);
  }

  /* Feedback on messages */
  .hn-msg-feedback {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .hn-msg-feedback-label {
    font-size: 11px;
    color: var(--hn-muted);
    margin-right: 2px;
  }

  .hn-msg-fb-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: calc(var(--hn-radius) - 2px);
    border: 1px solid var(--hn-border);
    background: var(--hn-white);
    color: var(--hn-muted);
    cursor: pointer;
    font-size: 12px;
    padding: 0;
    transition: border-color 0.1s, color 0.1s, background 0.1s;
  }

  .hn-msg-fb-btn:hover {
    border-color: var(--hn-ink);
    color: var(--hn-ink);
  }

  .hn-msg-fb-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  /* Typing indicator */
  .hn-typing-indicator {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 10px 12px;
    background: var(--hn-white);
    border: 1px solid var(--hn-border);
    border-radius: var(--hn-radius);
    border-bottom-left-radius: calc(var(--hn-radius) - 4px);
    width: fit-content;
    align-self: flex-start;
  }

  .hn-typing-dot {
    display: block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--hn-muted);
    animation: hn-typing 1.2s ease-in-out infinite;
  }

  .hn-typing-dot:nth-child(2) { animation-delay: 0.2s; }
  .hn-typing-dot:nth-child(3) { animation-delay: 0.4s; }

  @keyframes hn-typing {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
    30% { transform: translateY(-4px); opacity: 1; }
  }

  /* Escalate */
  .hn-chat-escalate-wrap {
    padding: 0 14px 10px;
    flex-shrink: 0;
  }

  .hn-chat-escalate-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid var(--hn-border);
    border-radius: calc(var(--hn-radius) - 2px);
    background: var(--hn-white);
    color: var(--hn-ink);
    font-size: 12px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: border-color 0.15s ease, transform 0.1s ease;
  }

  .hn-chat-escalate-btn:hover {
    border-color: var(--hn-ink);
  }

  .hn-chat-escalate-btn:active {
    transform: scale(0.97);
  }

  /* Composer */
  .hn-chat-composer {
    flex-shrink: 0;
    display: flex;
    align-items: flex-end;
    gap: 0;
    padding: 10px 12px;
    background: var(--hn-cream);
  }

  .hn-chat-composer-card {
    display: flex;
    align-items: flex-end;
    flex: 1;
    border: 1px solid var(--hn-border);
    border-radius: 16px;
    background: var(--hn-white);
    padding: 4px 4px 4px 14px;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .hn-chat-composer-card:focus-within {
    border-color: var(--hn-muted);
    box-shadow: 0 0 0 2px rgba(0,0,0,0.04);
  }

  .hn-chat-input {
    flex: 1;
    resize: none;
    border: none;
    background: transparent;
    color: var(--hn-ink);
    font-family: inherit;
    font-size: 13px;
    line-height: 1.45;
    padding: 8px 0;
    outline: none;
    min-height: 36px;
    max-height: 96px;
    overflow-y: auto;
    box-sizing: border-box;
  }

  .hn-chat-input::placeholder {
    color: var(--hn-muted);
  }

  .hn-chat-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .hn-chat-send {
    flex-shrink: 0;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: none;
    background: var(--hn-muted);
    color: var(--hn-white);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.15s ease, transform 0.1s ease, background 0.15s ease;
    padding: 0;
  }

  .hn-chat-send:hover { background: var(--hn-ink); }
  .hn-chat-send:active { transform: scale(0.9); }

  .hn-chat-send:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    background: var(--hn-border);
  }

  /* ─── Markdown ───────────────────────────────────────────────────────────── */

  .hn-msg-bubble .hn-md-p,
  .hn-md-p { margin: 0 0 4px; }
  .hn-md-p:last-child { margin-bottom: 0; }

  .hn-msg-bubble .hn-md-ul,
  .hn-msg-bubble .hn-md-ol {
    margin-bottom: 4px;
  }

  .hn-md-h1 {
    font-family: var(--hn-font-heading);
    font-size: 18px;
    font-weight: 400;
    margin: 16px 0 8px;
  }

  .hn-md-h2 {
    font-family: var(--hn-font-heading);
    font-size: 16px;
    font-weight: 400;
    margin: 14px 0 7px;
  }

  .hn-md-h3 {
    font-size: 15px;
    font-weight: 600;
    margin: 12px 0 6px;
  }

  .hn-md-h4 {
    font-size: 14px;
    font-weight: 600;
    margin: 10px 0 5px;
  }

  .hn-md-ul,
  .hn-md-ol {
    margin: 0 0 6px 18px;
    padding: 0;
  }

  .hn-md-li { margin: 0 0 2px; }

  .hn-md-a {
    color: var(--hn-accent);
    text-decoration: underline;
  }

  .hn-md-a:hover { opacity: 0.85; }

  .hn-md-img {
    max-width: 100%;
    border-radius: calc(var(--hn-radius) - 2px);
    margin: 8px 0;
  }

  .hn-md-hr {
    border: none;
    border-top: 1px solid var(--hn-border);
    margin: 16px 0;
  }

  .hn-md-code-block {
    background: var(--hn-white);
    border: 1px solid var(--hn-border);
    border-radius: var(--hn-radius);
    padding: 10px 12px;
    overflow-x: auto;
    margin: 0 0 10px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    white-space: pre;
    display: block;
  }

  .hn-md-code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    background: var(--hn-white);
    border: 1px solid var(--hn-border);
    border-radius: 4px;
    padding: 0.1em 0.35em;
  }

  /* ─── Misc ───────────────────────────────────────────────────────────────── */

  .hn-error {
    padding: 24px 16px;
    text-align: center;
    color: var(--hn-muted);
    font-size: 13px;
  }

  .hn-loading {
    padding: 16px;
  }

  .hn-skeleton {
    background: var(--hn-border);
    border-radius: calc(var(--hn-radius) - 2px);
    animation: hn-pulse 1.2s ease-in-out infinite;
  }

  @keyframes hn-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.45; }
  }
`
