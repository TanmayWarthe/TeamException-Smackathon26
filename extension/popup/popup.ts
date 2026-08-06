// popup/popup.ts — Clean white theme, no SOC link, no signal indicators

const RISK_LEVELS = {
  TRUSTED:    { label: 'Trusted',    fg: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  LOW:        { label: 'Low Risk',   fg: '#ca8a04', bg: '#fefce8', border: '#fde68a' },
  SUSPICIOUS: { label: 'Suspicious', fg: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
  HIGH:       { label: 'High Risk',  fg: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  CRITICAL:   { label: 'Critical',   fg: '#991b1b', bg: '#fef2f2', border: '#f87171' },
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

// ── DOM Refs ──
const domainEl    = document.getElementById('current-domain')!;
const urlEl       = document.getElementById('current-url')!;
const riskSection = document.getElementById('risk-section')!;
const lastAnalEl  = document.getElementById('last-analysis')!;

function renderDomain(domain: string, url: string): void {
  domainEl.textContent = domain || '—';
  urlEl.textContent = url.length > 55 ? url.substring(0, 52) + '…' : url || '—';
}

function renderScanning(): void {
  riskSection.innerHTML = `
    <div class="ctip-neutral">
      <div class="ctip-spinner"></div>
      <p class="ctip-neutral-text">Analyzing…</p>
      <p class="ctip-neutral-hint">Inspecting DOM, SSL &amp; digital twins</p>
    </div>
  `;
  lastAnalEl.textContent = 'Please wait…';
}

function renderNeutral(domain?: string, url?: string): void {
  const canScan = url && (url.startsWith('http://') || url.startsWith('https://'));

  riskSection.innerHTML = `
    <div class="ctip-neutral">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2l7 4v5c0 5.25-3.5 9.74-7 11-3.5-1.26-7-5.75-7-11V6l7-4z"/>
      </svg>
      <p class="ctip-neutral-text">No analysis yet</p>
      <p class="ctip-neutral-hint">${canScan ? 'Scan this site to check for threats' : 'Visit a website to analyze'}</p>
      ${canScan ? `<button id="btn-scan-now" class="ctip-scan-btn">Scan This Site</button>` : ''}
    </div>
  `;
  lastAnalEl.textContent = '—';

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
    () => {
      setTimeout(() => { init(); }, 400);
    }
  );
}

function renderRisk(result: AnalysisResult, cachedAt: string | null, domain?: string, url?: string): void {
  const level = getRiskLevel(result.risk_score);
  const theme = RISK_LEVELS[level];

  const recTag: Record<string, { bg: string; color: string; text: string }> = {
    ALLOW: { bg: '#f0fdf4', color: '#15803d', text: 'Safe to proceed' },
    WARN:  { bg: '#fff7ed', color: '#c2410c', text: 'Proceed with caution' },
    BLOCK: { bg: '#fef2f2', color: '#991b1b', text: 'Do not enter credentials' },
  };
  const rec = recTag[result.recommendation] || recTag['WARN'];

  const reasonsHtml = result.reasons
    .slice(0, 3)
    .map(r => `<li>${r}</li>`)
    .join('');

  riskSection.innerHTML = `
    <!-- Score pill -->
    <div class="risk-score-pill" style="background:${theme.bg};border-color:${theme.border};color:${theme.fg}">
      ${result.risk_score}<span style="font-size:13px;font-weight:500;margin-left:2px;">%</span>
    </div>

    <p class="risk-label">${theme.label}</p>

    <!-- Recommendation -->
    <div class="risk-recommendation-tag" style="background:${rec.bg};color:${rec.color}">
      ${rec.text}
    </div>

    <!-- Reasons -->
    ${reasonsHtml ? `<ul class="risk-reasons">${reasonsHtml}</ul>` : ''}

    <!-- Re-scan -->
    <button id="btn-rescan" class="ctip-scan-btn secondary" style="margin-top:14px;">Re-scan</button>
  `;

  document.getElementById('btn-rescan')?.addEventListener('click', () => {
    triggerScan(domain || '', url || '');
  });

  if (cachedAt) {
    const date = new Date(cachedAt);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    lastAnalEl.textContent = `Analyzed at ${timeStr}`;
  } else {
    lastAnalEl.textContent = 'Just analyzed';
  }
}

function init(): void {
  chrome.runtime.sendMessage(
    { type: 'POPUP_REQUEST_STATUS' },
    (response: PopupStatusResponse) => {
      if (chrome.runtime.lastError || !response) {
        renderDomain('—', '—');
        renderNeutral();
        lastAnalEl.textContent = '—';
        return;
      }

      renderDomain(response.domain, response.url);

      if (response.result) {
        renderRisk(response.result, response.cachedAt, response.domain, response.url);
      } else {
        renderNeutral(response.domain, response.url);
      }
    }
  );
}

document.addEventListener('DOMContentLoaded', init);
