// src/constants/theme.ts
// Centralized theme tokens for the CTIP Admin Dashboard.
// Import this anywhere instead of hardcoding colors, so the whole app stays consistent.

export type RiskLevel = 'TRUSTED' | 'LOW' | 'SUSPICIOUS' | 'HIGH' | 'CRITICAL'

// ---------- Base App Theme (Clean Light Consumer Theme) ----------
export const theme = {
  bg: {
    base: 'bg-slate-50',        // page background
    panel: 'bg-white',          // cards, sidebar, modals
    hover: 'hover:bg-slate-50',
    input: 'bg-white',
  },
  border: {
    default: 'border-slate-200',
    input: 'border-slate-300',
  },
  text: {
    primary: 'text-slate-900',
    secondary: 'text-slate-600',
    muted: 'text-slate-400',
  },
  accent: {
    text: 'text-blue-600',
    bg: 'bg-blue-600',
    bgHover: 'hover:bg-blue-700',
    bgSoft: 'bg-blue-50',
    ring: 'focus:border-blue-500',
  },
}

// ---------- Risk Level Colors ----------
// Use these consistently across RiskBadge, ThreatCard, ThreatTable, Charts, etc.
export const riskConfig: Record<
  RiskLevel,
  { label: string; badge: string; dot: string; text: string }
> = {
  TRUSTED: {
    label: 'Trusted',
    badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
  },
  LOW: {
    label: 'Low Risk',
    badge: 'bg-amber-50 text-amber-700 border border-amber-200',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
  },
  SUSPICIOUS: {
    label: 'Suspicious',
    badge: 'bg-orange-50 text-orange-700 border border-orange-200',
    dot: 'bg-orange-500',
    text: 'text-orange-700',
  },
  HIGH: {
    label: 'High Risk',
    badge: 'bg-red-50 text-red-700 border border-red-200',
    dot: 'bg-red-500',
    text: 'text-red-700',
  },
  CRITICAL: {
    label: 'Critical',
    badge: 'bg-rose-100 text-rose-800 border border-rose-300',
    dot: 'bg-rose-600',
    text: 'text-rose-800',
  },
}

// Helper: map a numeric risk score (0-100) to a RiskLevel
// Matches Chapter 8.6 of the CTIP spec:
// 0-25 Trusted | 26-50 Low | 51-70 Suspicious | 71-90 High | 91-100 Critical
export function getRiskLevel(score: number): RiskLevel {
  if (score <= 25) return 'TRUSTED'
  if (score <= 50) return 'LOW'
  if (score <= 70) return 'SUSPICIOUS'
  if (score <= 90) return 'HIGH'
  return 'CRITICAL'
}