// popup/popup.ts
// CTIP Extension Popup Logic
// Requests current tab status from background worker and renders the risk UI.

// ── Risk Theme (inline to avoid module import issues in popup context) ──
const RISK_LEVELS = {
  TRUSTED:    { label: 'Trusted',    fg: '#4ade80', bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.3)'  },
  LOW:        { label: 'Low Risk',   fg: '#facc15', bg: 'rgba(250,204,21,0.1)',  border: 'rgba(250,204,21,0.3)'  },
  SUSPICIOUS: { label: 'Suspicious', fg: '#fb923c', bg: 'rgba(251,146,60,0.1)',  border: 'rgba(251,146,60,0.3)'  },
  HIGH:       { label: 'High Risk',  fg: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.3)' },
  CRITICAL:   { label: 'Critical',   fg: '#ef4444', bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.5)'   },
};

type RiskLevel = keyof typeof RISK_LEVELS;

function getRiskLevel(score: number): RiskLevel {
  if (score <= 25) return 'TRUSTED';
  if (score <= 50) return 'LOW';
  if (score <= 70) return 'SUSPICIOUS';
  if (score <= 90) return 'HIGH';
  return 'CRITICAL';
}

interface AnalysisResult {
  status: string;
  risk_score: number;
  confidence: number;
  recommendation: string;
  reasons: string[];
}

interface PopupStatusResponse {
  connected: boolean;
  domain: string;
  url: string;
  result: AnalysisResult | null;
  cachedAt: string | null;
}

// ── DOM Refs ─────────────────────────────────────────────────
const statusDot   = document.getElementById('status-dot')!;
const statusLabel = document.getElementById('status-label')!;
const domainEl    = document.getElementById('current-domain')!;
const urlEl       = document.getElementById('current-url')!;
const riskSection = document.getElementById('risk-section')!;
const lastAnalEl  = document.getElementById('last-analysis')!;

// ── Render Connection Status ─────────────────────────────────
function renderStatus(connected: boolean): void {
  statusDot.className = `ctip-status-dot ${connected ? 'connected' : 'offline'}`;
  statusLabel.textContent = connected ? 'Connected' : 'Offline';
}

// ── Render Domain Info ───────────────────────────────────────
function renderDomain(domain: string, url: string): void {
  domainEl.textContent = domain || '—';
  // Truncate display URL
  if (url.length > 60) {
    urlEl.textContent = url.substring(0, 57) + '…';
  } else {
    urlEl.textContent = url || '—';
  }
}

// ── Render Neutral / Scanning State ──────────────────────────
function renderScanning(): void {
  riskSection.innerHTML = `
    <div class="ctip-neutral">
      <div class="ctip-spinner"></div>
      <p class="ctip-neutral-text" style="color:#22d3ee;font-weight:600;margin-top:12px;">Analyzing in Real-Time...</p>
      <p class="ctip-neutral-hint">AI engine inspecting DOM, SSL & Institutional Twins</p>
    </div>
  `;
  lastAnalEl.textContent = 'Auditing site...';
}

function renderNeutral(domain?: string, url?: string): void {
  const canScan = url && (url.startsWith('http://') || url.startsWith('https://'));

  riskSection.innerHTML = `
    <div class="ctip-neutral">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2l7 4v5c0 5.25-3.5 9.74-7 11-3.5-1.26-7-5.75-7-11V6l7-4z"/>
      </svg>
      <p class="ctip-neutral-text">Ready to scan</p>
      <p class="ctip-neutral-hint">${canScan ? 'Click below to run real-time AI security audit' : 'Visit any website to analyze'}</p>
      ${canScan ? `<button id="btn-scan-now" class="ctip-scan-btn">🛡️ Scan This Site</button>` : ''}
    </div>
  `;
  lastAnalEl.textContent = 'No analysis performed yet';

  if (canScan) {
    document.getElementById('btn-scan-now')?.addEventListener('click', () => {
      triggerScan(domain || '', url);
    });
  }
}

function triggerScan(domain: string, url: string): void {
  renderScanning();

  chrome.runtime.sendMessage(
    {
      type: 'POPUP_FORCE_RESCAN',
      payload: {
        url,
        domain: domain || (url.startsWith('http') ? new URL(url).hostname : 'unknown'),
        title: '',
        domSnapshot: '',
        inputFieldCount: 0,
        buttonLabels: [],
        logoSrc: null,
        timestamp: new Date().toISOString()
      }
    },
    (res) => {
      setTimeout(() => {
        init();
      }, 400);
    }
  );
}

// ── Render Risk Result ───────────────────────────────────────
function renderRisk(result: AnalysisResult, cachedAt: string | null, domain?: string, url?: string): void {
  const level = getRiskLevel(result.risk_score);
  const theme = RISK_LEVELS[level];

  // SVG circle math
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progress = (result.risk_score / 100) * circumference;
  const dashoffset = circumference - progress;

  const isCritical = level === 'CRITICAL' || level === 'HIGH';

  // Recommendation styling
  const recColors: Record<string, { bg: string; fg: string }> = {
    ALLOW: { bg: 'rgba(74,222,128,0.15)', fg: '#4ade80' },
    WARN:  { bg: 'rgba(251,146,60,0.15)', fg: '#fb923c' },
    BLOCK: { bg: 'rgba(239,68,68,0.15)',  fg: '#ef4444' },
  };
  const rec = recColors[result.recommendation] || recColors['WARN'];

  const reasonsHtml = result.reasons
    .slice(0, 3)
    .map((r) => `<li>${r}</li>`)
    .join('');

  riskSection.innerHTML = `
    <!-- Risk Score Circle -->
    <div class="risk-circle ${isCritical ? 'risk-critical-pulse' : ''}">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle class="risk-circle-bg" cx="60" cy="60" r="${radius}" />
        <circle class="risk-circle-progress" cx="60" cy="60" r="${radius}"
          stroke="${theme.fg}"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${circumference}"
          data-target="${dashoffset}" />
      </svg>
      <div class="risk-score-text">
        <span class="risk-score-number" style="color:${theme.fg}">${result.risk_score}</span>
        <span class="risk-score-label" style="color:${theme.fg}">${theme.label}</span>
      </div>
    </div>

    <!-- Risk Badge -->
    <div class="risk-badge" style="background:${theme.bg};border-color:${theme.border};color:${theme.fg}">
      <span class="risk-badge-dot" style="background:${theme.fg}"></span>
      ${theme.label} · ${result.risk_score}% Risk
    </div>

    <!-- Recommendation -->
    <div class="risk-recommendation" style="background:${rec.bg};color:${rec.fg}">
      Action: ${result.recommendation}
    </div>

    <!-- Confidence Bar -->
    <div class="confidence-bar-wrap">
      <div class="confidence-bar-label">
        <span>Confidence</span>
        <span>${result.confidence}%</span>
      </div>
      <div class="confidence-bar">
        <div class="confidence-bar-fill" style="width:0%" data-target="${result.confidence}"></div>
      </div>
    </div>

    <!-- Reasons -->
    ${reasonsHtml ? `<ul class="risk-reasons">${reasonsHtml}</ul>` : ''}

    <!-- Quick Action Buttons -->
    <div style="display:flex;gap:8px;margin-top:14px;width:100%;">
      <button id="btn-rescan" class="ctip-scan-btn" style="flex:1;font-size:11px;padding:6px 10px;justify-content:center;">🔄 Re-Scan</button>
      <button id="btn-soc" class="ctip-scan-btn" style="flex:1;font-size:11px;padding:6px 10px;justify-content:center;background:#1e293b;border:1px solid #334155;">📊 SOC Portal</button>
    </div>
  `;

  // Animate the circle progress
  requestAnimationFrame(() => {
    const circle = riskSection.querySelector('.risk-circle-progress') as SVGCircleElement | null;
    if (circle) {
      const target = circle.getAttribute('data-target') || '0';
      circle.style.strokeDashoffset = target;
    }

    const bar = riskSection.querySelector('.confidence-bar-fill') as HTMLElement | null;
    if (bar) {
      const target = bar.getAttribute('data-target') || '0';
      bar.style.width = `${target}%`;
    }
  });

  // Re-scan listener
  document.getElementById('btn-rescan')?.addEventListener('click', () => {
    triggerScan(domain || '', url || '');
  });

  // SOC portal link
  document.getElementById('btn-soc')?.addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:5173' });
  });

  // Last analysis timestamp
  if (cachedAt) {
    const date = new Date(cachedAt);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    lastAnalEl.textContent = `Last analysis: ${timeStr}`;
  } else {
    lastAnalEl.textContent = 'Just analyzed in real-time';
  }
}

// ── Initialize ───────────────────────────────────────────────
function init(): void {
  chrome.runtime.sendMessage(
    { type: 'POPUP_REQUEST_STATUS' },
    (response: PopupStatusResponse) => {
      if (chrome.runtime.lastError || !response) {
        renderStatus(false);
        renderDomain('—', '—');
        renderNeutral();
        lastAnalEl.textContent = 'CTIP Background Service active';
        return;
      }

      renderStatus(response.connected);
      renderDomain(response.domain, response.url);

      if (response.result) {
        renderRisk(response.result, response.cachedAt, response.domain, response.url);
      } else {
        renderNeutral(response.domain, response.url);
      }
    }
  );
}

// Run on popup open
document.addEventListener('DOMContentLoaded', init);
