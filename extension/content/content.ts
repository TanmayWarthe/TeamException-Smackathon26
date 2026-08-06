// content/content.ts
// CTIP Content Script — runs inside every webpage at document_idle.
// Detects login pages, collects metadata (NEVER credentials), and can inject
// a warning banner when instructed by the background worker.

import { CandidateWebsite, AnalysisResult, ExtensionMessage, getRiskLevel } from '../shared/types';
import { isLoginPage, collectFormMetadata } from '../utils/domHelpers';

// ── Risk colours (white/light theme) ────────────────────────
const BANNER_THEME: Record<string, { fg: string; bg: string; border: string; label: string }> = {
  TRUSTED:    { fg: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', label: 'Trusted' },
  LOW:        { fg: '#a16207', bg: '#fefce8', border: '#fde68a', label: 'Low Risk' },
  SUSPICIOUS: { fg: '#c2410c', bg: '#fff7ed', border: '#fed7aa', label: 'Suspicious' },
  HIGH:       { fg: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'High Risk' },
  CRITICAL:   { fg: '#991b1b', bg: '#fef2f2', border: '#f87171', label: 'Critical' },
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

  if (reported && !isLogin) return;
  reported = true;

  const payload: CandidateWebsite = {
    url: window.location.href,
    domain: window.location.hostname,
    title: document.title || window.location.hostname,
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

  const host = document.createElement('div');
  host.id = 'ctip-warning-host';
  host.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;';
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  const reasons = result.reasons
    .slice(0, 3)
    .map(r => `<li style="margin:3px 0;color:#6b7280;font-size:12px;">${r}</li>`)
    .join('');

  shadow.innerHTML = `
    <style>
      @keyframes ctip-slide-down {
        from { transform: translateY(-100%); opacity: 0; }
        to   { transform: translateY(0);     opacity: 1; }
      }
      .ctip-banner {
        all: initial;
        display: flex;
        align-items: flex-start;
        gap: 14px;
        padding: 14px 20px;
        background: #ffffff;
        border-bottom: 3px solid ${theme.border};
        border-top: 3px solid ${theme.fg};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        line-height: 1.5;
        animation: ctip-slide-down 0.3s ease-out;
        box-shadow: 0 2px 12px rgba(0,0,0,0.1);
      }
      .ctip-icon {
        flex-shrink: 0;
        width: 36px;
        height: 36px;
        background: ${theme.bg};
        border: 1.5px solid ${theme.border};
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .ctip-body { flex: 1; }
      .ctip-heading {
        margin: 0 0 2px;
        font-size: 13px;
        font-weight: 700;
        color: #111827;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .ctip-level-tag {
        display: inline-block;
        padding: 1px 8px;
        border-radius: 4px;
        background: ${theme.bg};
        color: ${theme.fg};
        font-size: 11px;
        font-weight: 700;
        border: 1px solid ${theme.border};
      }
      .ctip-domain {
        font-size: 11px;
        color: #9ca3af;
        margin-bottom: 4px;
      }
      .ctip-reasons { list-style:none; padding:0; margin:4px 0 10px; }
      .ctip-actions { display:flex; gap:8px; margin-top:2px; }
      .ctip-btn {
        all: initial;
        display: inline-flex;
        align-items: center;
        padding: 6px 14px;
        border-radius: 6px;
        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      .ctip-btn-leave {
        background: ${theme.fg};
        color: #ffffff;
      }
      .ctip-btn-leave:hover { opacity: 0.9; }
      .ctip-btn-continue {
        background: #f3f4f6;
        color: #4b5563;
        border: 1px solid #e5e7eb;
      }
      .ctip-btn-continue:hover { background: #e5e7eb; }
      #ctip-verifying {
        font-size: 11px;
        color: #9ca3af;
        font-weight: 400;
      }
    </style>

    <div class="ctip-banner" role="alert">
      <div class="ctip-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${theme.fg}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
        <p class="ctip-domain">${window.location.hostname}</p>
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
      .map(r => `<li style="margin:3px 0;color:#6b7280;font-size:12px;">${r}</li>`)
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
    if (result.risk_score > 70) {
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
