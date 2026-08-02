// background/background.ts
// CTIP Background Service Worker — central message router.
// Receives login-page data from content scripts, calls the analyze API,
// caches results, and notifies popup + content scripts of findings.

import { analyzeSite } from '../services/analyzeApi';
import { getCachedResult, setCachedResult } from '../storage/cache';
import { CandidateWebsite, AnalysisResult, ExtensionMessage, PopupStatusResponse, getRiskLevel } from '../shared/types';

// ── In-memory state for the current active tab ───────────────
// Service workers can be terminated, so we persist via chrome.storage too.
// This in-memory map is just for fast access while the worker is alive.
interface TabState {
  domain: string;
  url: string;
  result: AnalysisResult | null;
  cachedAt: string | null;
}

const tabStates = new Map<number, TabState>();

// ── Badge colors matching risk theme ─────────────────────────
const BADGE_COLORS: Record<string, string> = {
  TRUSTED:    '#4ade80',
  LOW:        '#facc15',
  SUSPICIOUS: '#fb923c',
  HIGH:       '#f87171',
  CRITICAL:   '#ef4444',
};

// ── Update Extension Badge ───────────────────────────────────
function updateBadge(tabId: number, result: AnalysisResult | null): void {
  if (!result) {
    chrome.action.setBadgeText({ text: '', tabId });
    return;
  }

  const level = getRiskLevel(result.risk_score);
  const text = result.risk_score.toString();

  chrome.action.setBadgeText({ text, tabId });
  chrome.action.setBadgeBackgroundColor({ color: BADGE_COLORS[level] || '#64748b', tabId });
  chrome.action.setBadgeTextColor({ color: '#000000', tabId });
}

// ── Handle Login Page Detection from Content Script ──────────
async function handleLoginDetected(
  payload: CandidateWebsite,
  senderTabId: number
): Promise<void> {
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
    return;
  }

  // No cache — call analyze API
  console.log(`[CTIP] Analyzing ${domain}...`);
  try {
    // TODO: Replace analyzeSite mock with real backend call
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
  } catch (err) {
    console.error('[CTIP] Analysis failed:', err);
  }
}

// ── Notify Content Script (for warning banner injection) ─────
function notifyContentScript(tabId: number, result: AnalysisResult): void {
  // Only send warning injection for HIGH or CRITICAL
  if (result.risk_score <= 70) return;

  chrome.tabs.sendMessage(tabId, {
    type: 'ANALYSIS_RESULT',
    payload: result,
  } as ExtensionMessage).catch(() => {
    // Content script may not be ready yet — that's fine
  });
}

// ── Message Router ───────────────────────────────────────────
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  switch (message.type) {
    case 'CONTENT_DETECTED_LOGIN': {
      if (!tabId) {
        sendResponse({ ok: false, error: 'No tab id' });
        return true;
      }
      const payload = message.payload as CandidateWebsite;
      handleLoginDetected(payload, tabId).then(() => {
        sendResponse({ ok: true });
      });
      return true; // async response
    }

    case 'POPUP_REQUEST_STATUS': {
      // Popup is asking for current tab status
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
    if (!tab?.id || !tab.url) {
      return {
        connected: true,
        domain: '',
        url: '',
        result: null,
        cachedAt: null,
      };
    }

    const domain = new URL(tab.url).hostname;

    // Check in-memory state first
    const state = tabStates.get(tab.id);
    if (state && state.domain === domain) {
      return {
        connected: true,
        domain: state.domain,
        url: state.url,
        result: state.result,
        cachedAt: state.cachedAt,
      };
    }

    // Check cache
    const cached = await getCachedResult(domain);
    if (cached) {
      return {
        connected: true,
        domain,
        url: tab.url,
        result: cached.result,
        cachedAt: cached.cachedAt,
      };
    }

    return {
      connected: true,
      domain,
      url: tab.url,
      result: null,
      cachedAt: null,
    };
  } catch (err) {
    return {
      connected: false,
      domain: '',
      url: '',
      result: null,
      cachedAt: null,
    };
  }
}

// ── Tab Navigation Listener — clear stale state ──────────────
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    // Clear previous state for this tab when navigation starts
    tabStates.delete(tabId);
    updateBadge(tabId, null);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
});

// ── Startup Log ──────────────────────────────────────────────
console.log('[CTIP] Background service worker initialized.');
