// background/background.ts
// CTIP Background Service Worker — central message router.
// Receives page data from content scripts & popup, calls the analyze API,
// caches results, and updates badge + popup + content scripts.

import { analyzeSite } from '../services/analyzeApi';
import { getCachedResult, setCachedResult } from '../storage/cache';
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

// ── Handle Page Detection ────────────────────────────────────
async function handleLoginDetected(
  payload: CandidateWebsite,
  senderTabId: number
): Promise<AnalysisResult> {
  const domain = payload.domain.toLowerCase();

  // Check cache first
  const cached = await getCachedResult(domain);
  if (cached) {
    console.log(`[CTIP] Cache hit for ${domain}: score=${cached.result.risk_score}`);
    tabStates.set(senderTabId, {
      domain,
      url: payload.url,
      result: cached.result,
      cachedAt: cached.cachedAt,
    });
    updateBadge(senderTabId, cached.result);
    notifyContentScript(senderTabId, cached.result);
    return cached.result;
  }

  // No cache — call analyze API
  console.log(`[CTIP] Analyzing ${domain}...`);
  try {
    const result = await analyzeSite(payload);

    // Cache the result
    await setCachedResult(domain, result);

    const now = new Date().toISOString();
    tabStates.set(senderTabId, {
      domain,
      url: payload.url,
      result,
      cachedAt: now,
    });

    updateBadge(senderTabId, result);
    notifyContentScript(senderTabId, result);

    console.log(`[CTIP] Analysis complete for ${domain}: score=${result.risk_score} (${result.status})`);
    return result;
  } catch (err) {
    console.error('[CTIP] Analysis failed:', err);
    throw err;
  }
}

// ── Notify Content Script (for warning banner injection) ─────
function notifyContentScript(tabId: number, result: AnalysisResult): void {
  if (result.risk_score <= 70) return;

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

    const domain = new URL(tab.url).hostname;

    // 1. Check in-memory state
    const state = tabStates.get(tab.id);
    if (state && state.domain === domain && state.result) {
      return {
        connected: true,
        domain: state.domain,
        url: state.url,
        result: state.result,
        cachedAt: state.cachedAt,
      };
    }

    // 2. Check storage cache
    const cached = await getCachedResult(domain);
    if (cached) {
      tabStates.set(tab.id, {
        domain,
        url: tab.url,
        result: cached.result,
        cachedAt: cached.cachedAt,
      });
      updateBadge(tab.id, cached.result);
      return {
        connected: true,
        domain,
        url: tab.url,
        result: cached.result,
        cachedAt: cached.cachedAt,
      };
    }

    // 3. Auto-analyze on popup open if not cached yet
    const candidate: CandidateWebsite = {
      url: tab.url,
      domain,
      title: tab.title || domain,
      domSnapshot: '',
      inputFieldCount: 0,
      buttonLabels: [],
      logoSrc: null,
      timestamp: new Date().toISOString(),
    };

    const result = await analyzeSite(candidate);
    await setCachedResult(domain, result);
    const now = new Date().toISOString();

    tabStates.set(tab.id, {
      domain,
      url: tab.url,
      result,
      cachedAt: now,
    });
    updateBadge(tab.id, result);

    return {
      connected: true,
      domain,
      url: tab.url,
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
      const state = tabStates.get(activeInfo.tabId);
      if (state?.result) {
        updateBadge(activeInfo.tabId, state.result);
      } else {
        const cached = await getCachedResult(domain);
        if (cached) {
          tabStates.set(activeInfo.tabId, {
            domain,
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

chrome.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
});

console.log('[CTIP] Background service worker initialized.');
