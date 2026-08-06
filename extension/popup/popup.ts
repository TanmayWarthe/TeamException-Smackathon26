// popup/popup.ts — Elegant refined UI

const RISK_LEVELS = {
  TRUSTED:    { label: 'Trusted',    fg: '#16a34a', bg: '#f0fdf4', border: '#d1fae5', rec: 'Safe to proceed',           recBg: '#f0fdf4', recColor: '#166534' },
  LOW:        { label: 'Low Risk',   fg: '#d97706', bg: '#fffbeb', border: '#fde68a', rec: 'Be cautious',               recBg: '#fffbeb', recColor: '#92400e' },
  SUSPICIOUS: { label: 'Suspicious', fg: '#ea580c', bg: '#fff7ed', border: '#fed7aa', rec: 'Verify before proceeding',  recBg: '#fff7ed', recColor: '#9a3412' },
  HIGH:       { label: 'High Risk',  fg: '#dc2626', bg: '#fef2f2', border: '#fecaca', rec: 'Do not enter credentials',  recBg: '#fef2f2', recColor: '#991b1b' },
  CRITICAL:   { label: 'Critical',   fg: '#b91c1c', bg: '#fff1f2', border: '#fecdd3', rec: 'Leave this site now',       recBg: '#fff1f2', recColor: '#881337' },
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
  matched_twin?: string;
}

interface PopupStatusResponse {
  connected: boolean;
  domain: string;
  url: string;
  result: AnalysisResult | null;
  cachedAt: string | null;
}

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
      <div class="ctip-spinner" style="margin-bottom:6px;"></div>
      <p class="ctip-neutral-text">Analyzing site…</p>
      <p class="ctip-neutral-hint">Inspecting page structure &amp; domain</p>
    </div>
  `;
  lastAnalEl.textContent = 'Please wait';
}

function renderNeutral(domain?: string, url?: string): void {
  const canScan = url && (url.startsWith('http://') || url.startsWith('https://'));
  riskSection.innerHTML = `
    <div class="ctip-neutral">
      <div class="ctip-neutral-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2l7 4v5c0 5.25-3.5 9.74-7 11-3.5-1.26-7-5.75-7-11V6l7-4z"/>
        </svg>
      </div>
      <p class="ctip-neutral-text">No analysis yet</p>
      <p class="ctip-neutral-hint">${canScan ? 'Scan this site to check for threats' : 'Visit any website to begin'}</p>
      ${canScan ? `
        <div class="ctip-actions" style="margin-top:13px;">
          <button id="btn-scan-now" class="ctip-btn ctip-btn-primary">Scan This Site</button>
        </div>` : ''}
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
    () => { setTimeout(() => { init(); }, 400); }
  );
}

function renderRisk(result: AnalysisResult, cachedAt: string | null, domain?: string, url?: string): void {
  const level = getRiskLevel(result.risk_score);
  const t = RISK_LEVELS[level];

  const reasonDots = result.reasons
    .slice(0, 3)
    .map(r => `
      <li>
        <span class="risk-reason-dot"></span>
        ${r}
      </li>`)
    .join('');

  riskSection.innerHTML = `
    <div class="risk-score-pill" style="background:${t.bg};border-color:${t.border};color:${t.fg}">
      ${result.risk_score}<span class="risk-score-unit">%</span>
    </div>

    <p class="risk-label-text">${t.label}</p>

    <div class="risk-recommendation-tag" style="background:${t.recBg};color:${t.recColor}">
      ${t.rec}
    </div>

    ${result.matched_twin ? `
      <div style="margin-top:10px;padding:5px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:11px;color:#475569;display:flex;align-items:center;gap:6px;width:100%;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M3 10h18M5 10v11M19 10v11M9 10v11M15 10v11M12 2l9 8H3l9-8z"/></svg>
        <span style="font-weight:600;color:#1e293b;">Twin:</span>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${result.matched_twin}</span>
      </div>
    ` : ''}

    ${reasonDots ? `
      <div class="ctip-divider"></div>
      <ul class="risk-reasons">${reasonDots}</ul>
    ` : ''}

    <div class="ctip-actions">
      <button id="btn-rescan" class="ctip-btn ctip-btn-secondary">Re-scan Page</button>
    </div>
  `;

  document.getElementById('btn-rescan')?.addEventListener('click', () => {
    triggerScan(domain || '', url || '');
  });

  if (cachedAt) {
    const d = new Date(cachedAt);
    lastAnalEl.textContent = `Analyzed at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
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
