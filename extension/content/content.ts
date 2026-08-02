// content/content.ts
// CTIP Content Script — runs inside every webpage at document_idle.
// Detects login pages, collects metadata (NEVER credentials), and can inject
// a warning banner when instructed by the background worker.

import { CandidateWebsite, AnalysisResult, ExtensionMessage, getRiskLevel, RISK_THEME, COLORS } from '../shared/types';
import { isLoginPage, collectFormMetadata } from '../utils/domHelpers';

// ── State ────────────────────────────────────────────────────
let warningBannerInjected = false;

// ── Main Detection ───────────────────────────────────────────
function detectAndReport(): void {
  if (!isLoginPage()) return;

  const meta = collectFormMetadata();

  const payload: CandidateWebsite = {
    url: window.location.href,
    domain: window.location.hostname,
    title: document.title,
    domSnapshot: meta.domSnapshot,
    inputFieldCount: meta.inputFieldCount,
    buttonLabels: meta.buttonLabels,
    logoSrc: meta.logoSrc,
    timestamp: new Date().toISOString(),
  };

  // Send to background worker for analysis
  chrome.runtime.sendMessage(
    { type: 'CONTENT_DETECTED_LOGIN', payload } as ExtensionMessage,
    (response) => {
      if (chrome.runtime.lastError) {
        console.debug('[CTIP] Could not reach background:', chrome.runtime.lastError.message);
      }
    }
  );
}

// ── Warning Banner Injection ─────────────────────────────────
function injectWarningBanner(result: AnalysisResult): void {
  if (warningBannerInjected) return;
  warningBannerInjected = true;

  const level = getRiskLevel(result.risk_score);
  const theme = RISK_THEME[level];

  // Create shadow host so page styles can't interfere
  const host = document.createElement('div');
  host.id = 'ctip-warning-host';
  host.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;';
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'closed' });

  const reasons = result.reasons
    .slice(0, 3)
    .map((r) => `<li style="margin:2px 0;">⚠ ${r}</li>`)
    .join('');

  shadow.innerHTML = `
    <style>
      @keyframes ctip-slide-down {
        from { transform: translateY(-100%); opacity: 0; }
        to   { transform: translateY(0);     opacity: 1; }
      }
      @keyframes ctip-pulse-border {
        0%, 100% { border-color: ${theme.border}; }
        50%      { border-color: ${theme.fg}; }
      }
      .ctip-banner {
        all: initial;
        display: flex;
        align-items: flex-start;
        gap: 16px;
        padding: 16px 24px;
        background: ${COLORS.bgPanel};
        border-bottom: 3px solid ${theme.fg};
        color: ${COLORS.textPrimary};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        animation: ctip-slide-down 0.35s ease-out;
        box-shadow: 0 4px 24px rgba(0,0,0,0.5);
        ${level === 'CRITICAL' ? 'animation: ctip-slide-down 0.35s ease-out, ctip-pulse-border 2s ease-in-out infinite;' : ''}
      }
      .ctip-shield {
        flex-shrink: 0;
        width: 40px;
        height: 40px;
      }
      .ctip-body { flex: 1; }
      .ctip-title {
        margin: 0 0 4px;
        font-size: 16px;
        font-weight: 700;
        color: ${theme.fg};
      }
      .ctip-score-badge {
        display: inline-block;
        padding: 2px 10px;
        border-radius: 9999px;
        background: ${theme.bg};
        border: 1px solid ${theme.border};
        color: ${theme.fg};
        font-weight: 600;
        font-size: 13px;
        margin-left: 8px;
      }
      .ctip-reasons {
        list-style: none;
        padding: 0;
        margin: 8px 0;
        color: ${COLORS.textSecondary};
        font-size: 13px;
      }
      .ctip-actions {
        display: flex;
        gap: 10px;
        margin-top: 10px;
      }
      .ctip-btn {
        all: initial;
        display: inline-flex;
        align-items: center;
        padding: 8px 18px;
        border-radius: 8px;
        font-family: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.15s;
      }
      .ctip-btn:hover { opacity: 0.85; }
      .ctip-btn-leave {
        background: ${theme.fg};
        color: ${COLORS.bgBase};
      }
      .ctip-btn-continue {
        background: transparent;
        color: ${COLORS.textSecondary};
        border: 1px solid ${COLORS.border};
      }
    </style>

    <div class="ctip-banner" role="alert">
      <svg class="ctip-shield" viewBox="0 0 24 24" fill="none" stroke="${theme.fg}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2l7 4v5c0 5.25-3.5 9.74-7 11-3.5-1.26-7-5.75-7-11V6l7-4z"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <circle cx="12" cy="15" r="0.5" fill="${theme.fg}"/>
      </svg>

      <div class="ctip-body">
        <p class="ctip-title">
          CTIP Security Warning
          <span class="ctip-score-badge">${theme.label} · ${result.risk_score}%</span>
        </p>
        <ul class="ctip-reasons">${reasons}</ul>
        <div class="ctip-actions">
          <button class="ctip-btn ctip-btn-leave" id="ctip-leave">Leave This Site</button>
          <button class="ctip-btn ctip-btn-continue" id="ctip-continue">I Understand the Risk, Continue</button>
        </div>
      </div>
    </div>
  `;

  // ── Button Handlers ──
  shadow.getElementById('ctip-leave')?.addEventListener('click', () => {
    // Try to go back; if no history, close the tab
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.close();
    }
  });

  shadow.getElementById('ctip-continue')?.addEventListener('click', () => {
    host.remove();
    warningBannerInjected = false;
  });

  // ── Interceptor Placeholder ──
  // TODO: Add form submission interception here for a future "block submission" mode.
  // Example hook point:
  //   document.querySelectorAll('form').forEach(form => {
  //     form.addEventListener('submit', (e) => {
  //       if (shouldBlock) { e.preventDefault(); showBlockModal(); }
  //     });
  //   });
}

// ── Message Listener (from background worker) ────────────────
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === 'INJECT_WARNING' && message.payload) {
    injectWarningBanner(message.payload as AnalysisResult);
    sendResponse({ ok: true });
  }
  if (message.type === 'ANALYSIS_RESULT' && message.payload) {
    // Background is broadcasting the result — check if we need to warn
    const result = message.payload as AnalysisResult;
    if (result.risk_score > 70) {
      injectWarningBanner(result);
    }
    sendResponse({ ok: true });
  }
  return true; // keep message channel open for async
});

// ── Run Detection ────────────────────────────────────────────
detectAndReport();
