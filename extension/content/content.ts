// content/content.ts
// CTIP Content Script — runs inside every webpage at document_idle.
// Detects login pages, collects metadata (NEVER credentials), and can inject
// a warning banner when instructed by the background worker.

import { CandidateWebsite, AnalysisResult, ExtensionMessage, getRiskLevel } from '../shared/types';
import { isLoginPage, collectFormMetadata, getEffectivePageInfo } from '../utils/domHelpers';

// ── Risk colours (refined elegant theme) ────────────────────
const BANNER_THEME: Record<string, { fg: string; bg: string; border: string; accent: string; label: string }> = {
  TRUSTED:    { fg: '#16a34a', bg: '#f0fdf4', border: '#dcfce7', accent: '#16a34a', label: 'Trusted' },
  LOW:        { fg: '#d97706', bg: '#fffbeb', border: '#fef3c7', accent: '#d97706', label: 'Low Risk' },
  SUSPICIOUS: { fg: '#ea580c', bg: '#fff7ed', border: '#ffedd5', accent: '#ea580c', label: 'Suspicious' },
  HIGH:       { fg: '#dc2626', bg: '#fef2f2', border: '#fee2e2', accent: '#dc2626', label: 'High Risk' },
  CRITICAL:   { fg: '#b91c1c', bg: '#fff1f2', border: '#fce7f3', accent: '#b91c1c', label: 'Critical' },
};

// ── Banner State ─────────────────────────────────────────────
interface BannerState {
  injected: boolean;
  source: 'backend' | 'fallback' | null;
  shadowRoot: ShadowRoot | null;
  host: HTMLElement | null;
}
const bannerState: BannerState = {
  injected: false,
  source: null,
  shadowRoot: null,
  host: null,
};

// ── Main Detection ───────────────────────────────────────────
let reported = false;

function detectAndReport(): void {
  if (!window.location.protocol.startsWith('http')) return;

  const host = window.location.hostname;
  const port = window.location.port;
  if ((host === 'localhost' || host === '127.0.0.1') && (port === '5173' || port === '8000' || port === '3000')) {
    return;
  }

  const isLogin = isLoginPage();
  const meta = collectFormMetadata();
  const pageInfo = getEffectivePageInfo();

  if (reported && !isLogin) return;
  reported = true;

  const payload: CandidateWebsite = {
    url: pageInfo.url,
    domain: pageInfo.domain,
    title: document.title || pageInfo.domain,
    domSnapshot: meta.domSnapshot || (document.documentElement ? document.documentElement.outerHTML.slice(0, 40000) : ''),
    inputFieldCount: meta.inputFieldCount,
    buttonLabels: meta.buttonLabels,
    logoSrc: meta.logoSrc,
    timestamp: new Date().toISOString(),
  };

  try {
    chrome.runtime.sendMessage(
      { type: 'CONTENT_DETECTED_LOGIN', payload } as ExtensionMessage,
      (response) => {
        if (chrome.runtime.lastError) {
          console.debug('[CTIP] Worker status:', chrome.runtime.lastError.message);
        }
      }
    );
  } catch (err) {
    console.debug('[CTIP] Failed to send to background:', err);
  }
}

setTimeout(detectAndReport, 300);
setTimeout(detectAndReport, 1200);

// ── Warning Banner Injection ─────────────────────────────────
function injectWarningBanner(result: AnalysisResult): void {
  if (bannerState.injected) return;

  const level = getRiskLevel(result.risk_score);
  const theme = BANNER_THEME[level] ?? BANNER_THEME['HIGH'];
  const isFallback = result.source === 'fallback';
  const pageInfo = getEffectivePageInfo();
  const displayDomain = pageInfo.domain;

  const host = document.createElement('div');
  host.id = 'ctip-warning-host';
  host.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;';
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  const reasons = result.reasons
    .slice(0, 3)
    .map(r => `<li><span class="ctip-dot"></span>${r}</li>`)
    .join('');

  shadow.innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      @keyframes ctip-slide-down {
        from { transform: translateY(-100%); opacity: 0; }
        to   { transform: translateY(0);     opacity: 1; }
      }
      .ctip-banner {
        all: initial;
        display: flex;
        align-items: flex-start;
        gap: 13px;
        padding: 13px 18px;
        background: #ffffff;
        border-bottom: 1px solid #f4f4f5;
        border-left: 3px solid ${theme.accent};
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px;
        line-height: 1.5;
        animation: ctip-slide-down 0.28s ease-out;
        box-shadow: 0 1px 6px rgba(0,0,0,0.07);
      }
      .ctip-icon {
        flex-shrink: 0;
        width: 32px;
        height: 32px;
        background: ${theme.bg};
        border-radius: 7px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-top: 1px;
      }
      .ctip-body { flex: 1; min-width: 0; }
      .ctip-heading {
        margin: 0 0 1px;
        font-size: 12.5px;
        font-weight: 700;
        color: #18181b;
        display: flex;
        align-items: center;
        gap: 7px;
        flex-wrap: wrap;
      }
      .ctip-level-tag {
        display: inline-block;
        padding: 1px 7px;
        border-radius: 4px;
        background: ${theme.bg};
        color: ${theme.fg};
        font-size: 10.5px;
        font-weight: 700;
      }
      .ctip-domain-text {
        font-size: 10.5px;
        color: #a1a1aa;
        margin-bottom: 5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ctip-reasons {
        list-style: none;
        padding: 0;
        margin: 0 0 9px;
      }
      .ctip-reasons li {
        font-size: 11.5px;
        color: #71717a;
        display: flex;
        align-items: flex-start;
        gap: 7px;
        padding: 2px 0;
        line-height: 1.4;
      }
      .ctip-dot {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: #d4d4d8;
        flex-shrink: 0;
        margin-top: 5px;
      }
      .ctip-actions { display: flex; gap: 7px; }
      .ctip-btn {
        all: initial;
        display: inline-flex;
        align-items: center;
        padding: 6px 13px;
        border-radius: 6px;
        font-family: inherit;
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
        letter-spacing: -0.01em;
        transition: opacity 0.12s;
      }
      .ctip-btn:hover { opacity: 0.88; }
      .ctip-btn-leave {
        background: ${theme.fg};
        color: #ffffff;
      }
      .ctip-btn-continue {
        background: #f4f4f5;
        color: #52525b;
      }
      #ctip-verifying {
        font-size: 10px;
        color: #a1a1aa;
        font-weight: 400;
      }
    </style>

    <div class="ctip-banner" role="alert">
      <div class="ctip-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${theme.fg}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2l7 4v5c0 5.25-3.5 9.74-7 11-3.5-1.26-7-5.75-7-11V6l7-4z"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <circle cx="12" cy="15" r="0.8" fill="${theme.fg}"/>
        </svg>
      </div>

      <div class="ctip-body">
        <p class="ctip-heading">
          Security Warning
          <span id="ctip-score-badge" class="ctip-level-tag">${theme.label} · ${result.risk_score}%</span>
          ${isFallback ? '<span id="ctip-verifying">Verifying…</span>' : ''}
        </p>
        <p class="ctip-domain-text">${displayDomain}</p>
        <ul id="ctip-reasons" class="ctip-reasons">${reasons}</ul>
        <div class="ctip-actions">
          <button class="ctip-btn ctip-btn-leave" id="ctip-leave">Leave This Site</button>
          <button class="ctip-btn ctip-btn-continue" id="ctip-continue">Continue Anyway</button>
        </div>
      </div>
    </div>
  `;

  shadow.getElementById('ctip-leave')?.addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.close();
    }
  });

  shadow.getElementById('ctip-continue')?.addEventListener('click', () => {
    host.remove();
    bannerState.injected = false;
    bannerState.source = null;
    bannerState.shadowRoot = null;
    bannerState.host = null;
  });

  bannerState.injected = true;
  bannerState.source = result.source ?? 'backend';
  bannerState.shadowRoot = shadow;
  bannerState.host = host;
}

// ── In-place Banner Update ────────────────────────────────────
function updateWarningBanner(result: AnalysisResult): void {
  const shadow = bannerState.shadowRoot;
  if (!shadow) return;

  const level = getRiskLevel(result.risk_score);
  const theme = BANNER_THEME[level] ?? BANNER_THEME['HIGH'];

  const badge = shadow.getElementById('ctip-score-badge');
  if (badge) badge.textContent = `${theme.label} · ${result.risk_score}%`;

  const reasonsList = shadow.getElementById('ctip-reasons');
  if (reasonsList) {
    reasonsList.innerHTML = result.reasons
      .slice(0, 3)
      .map(r => `<li><span class="ctip-dot"></span>${r}</li>`)
      .join('');
  }

  shadow.getElementById('ctip-verifying')?.remove();
  bannerState.source = 'backend';
}

// ── Message Listener ─────────────────────────────────────────
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === 'INJECT_WARNING' && message.payload) {
    const result = message.payload as AnalysisResult;
    if (bannerState.injected && bannerState.source === 'fallback' && result.source === 'backend') {
      updateWarningBanner(result);
    } else if (!bannerState.injected) {
      injectWarningBanner(result);
    }
    sendResponse({ ok: true });
  }
  if (message.type === 'ANALYSIS_RESULT' && message.payload) {
    const result = message.payload as AnalysisResult;
    if (result.risk_score > 50) {
      if (bannerState.injected && bannerState.source === 'fallback' && result.source === 'backend') {
        updateWarningBanner(result);
      } else if (!bannerState.injected) {
        injectWarningBanner(result);
      }
    }
    sendResponse({ ok: true });
  }
  return true;
});

// ── Run Detection ─────────────────────────────────────────────
detectAndReport();
