// background/background.ts
// CTIP Background Service Worker — central message router.
// Receives page data from content scripts & popup, calls the analyze API,
// caches results, and updates badge + popup + content scripts.

import { analyzeSite } from '../services/analyzeApi';
import { getCachedResult, setCachedResult, removeCachedResult, clearCache } from '../storage/cache';
import { CandidateWebsite, AnalysisResult, ExtensionMessage, PopupStatusResponse, getRiskLevel } from '../shared/types';

// ── In-memory state for active tabs ─────────────────────────
interface TabState {
  domain: string;
  url: string;
  result: AnalysisResult | null;
  cachedAt: string | null;
}

const tabStates = new Map<number, TabState>();

// ── Badge colors matching risk theme ─────────────────────────
const BADGE_COLORS: Record<string, string> = {
  TRUSTED:    '#22c55e',
  LOW:        '#eab308',
  SUSPICIOUS: '#f97316',
  HIGH:       '#ef4444',
  CRITICAL:   '#dc2626',
};

// ── Update Extension Badge ───────────────────────────────────
function updateBadge(tabId: number, result: AnalysisResult | null): void {
  try {
    if (!result) {
      chrome.action.setBadgeText({ text: '', tabId });
      return;
    }

    const level = getRiskLevel(result.risk_score);
    const text = result.risk_score.toString();

    chrome.action.setBadgeText({ text, tabId });
    chrome.action.setBadgeBackgroundColor({ color: BADGE_COLORS[level] || '#64748b', tabId });
    if (chrome.action.setBadgeTextColor) {
      chrome.action.setBadgeTextColor({ color: '#ffffff', tabId });
    }
  } catch (e) {
    console.debug('[CTIP] Badge update failed:', e);
  }
}

function resolveDisplayInfo(tabUrl?: string, tabDomain?: string): { domain: string; url: string } {
  if (!tabUrl || !tabUrl.startsWith('http')) {
    return { domain: tabDomain || '—', url: tabUrl || '—' };
  }
  try {
    const parsed = new URL(tabUrl);
    if ((parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') && parsed.port === '8088') {
      return {
        domain: 'ycce-student-auth.xyz',
        url: 'https://ycce-student-auth.xyz/login',
      };
    }
    return {
      domain: (tabDomain && tabDomain !== 'localhost' && tabDomain !== '127.0.0.1') ? tabDomain : parsed.hostname,
      url: tabUrl,
    };
  } catch {
    return { domain: tabDomain || '—', url: tabUrl || '—' };
  }
}

function getDomainKey(urlStr: string, defaultDomain: string): string {
  if (defaultDomain && defaultDomain !== 'localhost' && defaultDomain !== '127.0.0.1') {
    return defaultDomain.toLowerCase();
  }
  try {
    const parsed = new URL(urlStr);
    if ((parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') && parsed.port === '8088') {
      return 'ycce-student-auth.xyz';
    }
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return `${parsed.hostname}:${parsed.port || '80'}`;
    }
    return parsed.hostname.toLowerCase();
  } catch {
    return defaultDomain.toLowerCase();
  }
}

// ── Handle Page Detection ────────────────────────────────────
async function handleLoginDetected(
  payload: CandidateWebsite,
  senderTabId: number
): Promise<AnalysisResult> {
  const resolved = resolveDisplayInfo(payload.url, payload.domain);
  const effectivePayload: CandidateWebsite = {
    ...payload,
    domain: resolved.domain,
    url: resolved.url,
  };
  const domainKey = getDomainKey(effectivePayload.url, effectivePayload.domain);

  // Check cache first (ignore 0-score cache for non-institutional domains)
  const cached = await getCachedResult(domainKey);
  if (cached && (cached.result.risk_score > 0 || domainKey.includes('ycce.edu'))) {
    console.log(`[CTIP] Cache hit for ${domainKey}: score=${cached.result.risk_score}`);
    tabStates.set(senderTabId, {
      domain: resolved.domain,
      url: resolved.url,
      result: cached.result,
      cachedAt: cached.cachedAt,
    });
    updateBadge(senderTabId, cached.result);
    notifyContentScript(senderTabId, cached.result);
    return cached.result;
  }

  // No cache — call analyze API
  console.log(`[CTIP] Analyzing ${domainKey}...`);
  try {
    const result = await analyzeSite(effectivePayload);

    // Cache the result
    await setCachedResult(domainKey, result);

    const now = new Date().toISOString();
    tabStates.set(senderTabId, {
      domain: resolved.domain,
      url: resolved.url,
      result,
      cachedAt: now,
    });

    updateBadge(senderTabId, result);
    notifyContentScript(senderTabId, result);

    console.log(`[CTIP] Analysis complete for ${domainKey}: score=${result.risk_score} (${result.status})`);
    return result;
  } catch (err) {
    console.error('[CTIP] Analysis failed:', err);
    throw err;
  }
}

// ── Notify Content Script (for warning banner injection) ─────
function notifyContentScript(tabId: number, result: AnalysisResult): void {
  if (result.risk_score <= 50) return;

  chrome.tabs.sendMessage(tabId, {
    type: 'ANALYSIS_RESULT',
    payload: result,
  } as ExtensionMessage).catch(() => {
    // Content script might not be loaded yet
  });
}

// ── Message Router ───────────────────────────────────────────
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  switch (message.type) {
    case 'CONTENT_DETECTED_LOGIN': {
      const payload = message.payload as CandidateWebsite;
      let targetTabId = tabId;

      (async () => {
        if (!targetTabId) {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          targetTabId = activeTab?.id;
        }
        if (targetTabId) {
          const res = await handleLoginDetected(payload, targetTabId);
          sendResponse({ ok: true, result: res });
        } else {
          sendResponse({ ok: false, error: 'No active tab found' });
        }
      })();
      return true; // async response
    }

    case 'POPUP_REQUEST_STATUS': {
      handlePopupStatusRequest().then((response) => {
        sendResponse(response);
      });
      return true; // async response
    }

    case 'POPUP_FORCE_RESCAN': {
      (async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id && tab.url && tab.url.startsWith('http')) {
          const resolved = resolveDisplayInfo(tab.url);
          const rawDomain = new URL(tab.url).hostname;
          const domainKey = getDomainKey(tab.url, resolved.domain);

          // Force clear cache for this domain
          await removeCachedResult(domainKey);
          await removeCachedResult(rawDomain);
          await removeCachedResult(resolved.domain);
          tabStates.delete(tab.id);

          const result = await analyzeSite({
            url: resolved.url,
            domain: resolved.domain,
            title: tab.title || resolved.domain,
            domSnapshot: '',
            inputFieldCount: 0,
            buttonLabels: [],
            logoSrc: null,
            timestamp: new Date().toISOString(),
          });

          await setCachedResult(domainKey, result);
          const now = new Date().toISOString();

          tabStates.set(tab.id, {
            domain: resolved.domain,
            url: resolved.url,
            result,
            cachedAt: now,
          });

          updateBadge(tab.id, result);
          notifyContentScript(tab.id, result);
          sendResponse({ ok: true, result });
        } else {
          sendResponse({ ok: false, error: 'No active http tab' });
        }
      })();
      return true; // async response
    }

    default:
      return false;
  }
});

// ── Popup Status Request Handler ─────────────────────────────
async function handlePopupStatusRequest(): Promise<PopupStatusResponse> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url || !tab.url.startsWith('http')) {
      return {
        connected: true,
        domain: tab?.url ? (tab.url.startsWith('http') ? new URL(tab.url).hostname : tab.url) : '—',
        url: tab?.url || '—',
        result: null,
        cachedAt: null,
      };
    }

    const resolved = resolveDisplayInfo(tab.url);
    const domainKey = getDomainKey(tab.url, resolved.domain);

    // 1. Check in-memory state
    const state = tabStates.get(tab.id);
    if (state && (state.domain === domainKey || state.domain === resolved.domain) && state.result && (state.result.risk_score > 0 || domainKey.includes('ycce.edu'))) {
      return {
        connected: true,
        domain: state.domain,
        url: state.url,
        result: state.result,
        cachedAt: state.cachedAt,
      };
    }

    // 2. Check storage cache
    const cached = await getCachedResult(domainKey);
    if (cached && (cached.result.risk_score > 0 || domainKey.includes('ycce.edu'))) {
      tabStates.set(tab.id, {
        domain: resolved.domain,
        url: resolved.url,
        result: cached.result,
        cachedAt: cached.cachedAt,
      });
      updateBadge(tab.id, cached.result);
      return {
        connected: true,
        domain: resolved.domain,
        url: resolved.url,
        result: cached.result,
        cachedAt: cached.cachedAt,
      };
    }

    // 3. Auto-analyze on popup open if not cached yet
    const candidate: CandidateWebsite = {
      url: resolved.url,
      domain: resolved.domain,
      title: tab.title || resolved.domain,
      domSnapshot: '',
      inputFieldCount: 0,
      buttonLabels: [],
      logoSrc: null,
      timestamp: new Date().toISOString(),
    };

    const result = await analyzeSite(candidate);
    await setCachedResult(domainKey, result);
    const now = new Date().toISOString();

    tabStates.set(tab.id, {
      domain: resolved.domain,
      url: resolved.url,
      result,
      cachedAt: now,
    });
    updateBadge(tab.id, result);

    return {
      connected: true,
      domain: resolved.domain,
      url: resolved.url,
      result,
      cachedAt: now,
    };
  } catch (err) {
    console.error('[CTIP] Status request failed:', err);
    return {
      connected: false,
      domain: '',
      url: '',
      result: null,
      cachedAt: null,
    };
  }
}

// ── Tab Listeners ────────────────────────────────────────────
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    tabStates.delete(tabId);
    updateBadge(tabId, null);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab?.url && tab.url.startsWith('http')) {
      const domain = new URL(tab.url).hostname;
      const domainKey = getDomainKey(tab.url, domain);
      const state = tabStates.get(activeInfo.tabId);
      if (state?.result && state.domain === domainKey && (state.result.risk_score > 0 || domainKey.includes('ycce.edu'))) {
        updateBadge(activeInfo.tabId, state.result);
      } else {
        const cached = await getCachedResult(domainKey);
        if (cached && (cached.result.risk_score > 0 || domainKey.includes('ycce.edu'))) {
          tabStates.set(activeInfo.tabId, {
            domain: domainKey,
            url: tab.url,
            result: cached.result,
            cachedAt: cached.cachedAt,
          });
          updateBadge(activeInfo.tabId, cached.result);
        }
      }
    }
  } catch (e) {
    // Ignore tab get errors
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[CTIP] Extension installed/updated — clearing stale storage cache.');
  try {
    await clearCache();
    tabStates.clear();
  } catch (e) {
    console.debug('[CTIP] Cache clear on install error:', e);
  }
});

console.log('[CTIP] Background service worker initialized.');
