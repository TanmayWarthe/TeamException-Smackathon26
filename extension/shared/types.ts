// shared/types.ts
// Shared TypeScript interfaces for the CTIP Browser Extension.
// These mirror the backend API contract so swapping mock → real requires zero shape changes.

// ── Risk Levels ──────────────────────────────────────────────
export type RiskLevel = 'TRUSTED' | 'LOW' | 'SUSPICIOUS' | 'HIGH' | 'CRITICAL';

export type RecommendationAction = 'ALLOW' | 'WARN' | 'BLOCK';

// ── Candidate Website (collected by content script) ─────────
export interface CandidateWebsite {
  /** Full URL of the page being analyzed */
  url: string;
  /** Extracted domain (e.g. "login.example.com") */
  domain: string;
  /** Page <title> content */
  title: string;
  /** Lightweight DOM snapshot — outer HTML of <form> elements only */
  domSnapshot: string;
  /** Number of <input> fields on the page */
  inputFieldCount: number;
  /** Visible text of all <button> and input[type=submit] elements */
  buttonLabels: string[];
  /** src of the first <img> that looks like a logo (heuristic), or null */
  logoSrc: string | null;
  /** ISO timestamp of when the data was collected */
  timestamp: string;
}

// ── Analysis Result (returned by backend / mock API) ────────
export interface AnalysisResult {
  /** Human-readable status label, e.g. "HIGH_RISK" */
  status: string;
  /** Numeric risk score 0-100 */
  risk_score: number;
  /** Model confidence 0-100 */
  confidence: number;
  /** Recommended action for the SOC / extension */
  recommendation: RecommendationAction;
  /** Short human-readable reasons explaining the score */
  reasons: string[];
}

// ── Cached Entry (stored in chrome.storage.local) ───────────
export interface CachedAnalysis {
  domain: string;
  result: AnalysisResult;
  /** ISO timestamp of when the analysis was cached */
  cachedAt: string;
}

// ── Internal Message Types (chrome.runtime messaging) ───────
export type MessageType =
  | 'CONTENT_DETECTED_LOGIN'
  | 'ANALYSIS_RESULT'
  | 'POPUP_REQUEST_STATUS'
  | 'POPUP_STATUS_RESPONSE'
  | 'POPUP_FORCE_RESCAN'
  | 'INJECT_WARNING';

export interface ExtensionMessage {
  type: MessageType;
  payload?: CandidateWebsite | AnalysisResult | PopupStatusResponse | unknown;
}

export interface PopupStatusResponse {
  connected: boolean;
  domain: string;
  url: string;
  result: AnalysisResult | null;
  cachedAt: string | null;
}

// ── Risk Helpers (mirrors frontend/src/constants/theme.ts) ──
export function getRiskLevel(score: number): RiskLevel {
  if (score <= 25) return 'TRUSTED';
  if (score <= 50) return 'LOW';
  if (score <= 70) return 'SUSPICIOUS';
  if (score <= 90) return 'HIGH';
  return 'CRITICAL';
}

export interface RiskThemeConfig {
  label: string;
  fg: string;   // foreground hex
  bg: string;   // background hex (semi-transparent usage)
  border: string;
}

export const RISK_THEME: Record<RiskLevel, RiskThemeConfig> = {
  TRUSTED:    { label: 'Trusted',    fg: '#4ade80', bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.3)'  },
  LOW:        { label: 'Low Risk',   fg: '#facc15', bg: 'rgba(250,204,21,0.1)',  border: 'rgba(250,204,21,0.3)'  },
  SUSPICIOUS: { label: 'Suspicious', fg: '#fb923c', bg: 'rgba(251,146,60,0.1)',  border: 'rgba(251,146,60,0.3)'  },
  HIGH:       { label: 'High Risk',  fg: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.3)' },
  CRITICAL:   { label: 'Critical',   fg: '#ef4444', bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.5)'   },
};

// ── Design tokens (hex values matching frontend theme.ts) ───
export const COLORS = {
  bgBase:       '#020617',
  bgPanel:      '#0f172a',
  border:       '#1e293b',
  textPrimary:  '#ffffff',
  textSecondary:'#94a3b8',
  accent:       '#22d3ee',
  accentDark:   '#06b6d4',
} as const;
