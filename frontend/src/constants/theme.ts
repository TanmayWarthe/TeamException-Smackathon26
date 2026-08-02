// src/constants/theme.ts
// Centralized theme tokens for the CTIP Admin Dashboard.
// Import this anywhere instead of hardcoding colors, so the whole app stays consistent.

export type RiskLevel = 'TRUSTED' | 'LOW' | 'SUSPICIOUS' | 'HIGH' | 'CRITICAL'

// ---------- Base App Theme (Dark Cyber-Security Theme) ----------
export const theme = {
  bg: {
    base: 'bg-slate-950',       // page background
    panel: 'bg-slate-900',      // cards, sidebar, modals
    hover: 'hover:bg-slate-800',
    input: 'bg-slate-800',
  },
  border: {
    default: 'border-slate-800',
    input: 'border-slate-700',
  },
  text: {
    primary: 'text-white',
    secondary: 'text-slate-400',
    muted: 'text-slate-500',
  },
  accent: {
    text: 'text-cyan-400',
    bg: 'bg-cyan-500',
    bgHover: 'hover:bg-cyan-400',
    bgSoft: 'bg-cyan-500/10',
    ring: 'focus:border-cyan-500',
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
    badge: 'bg-green-500/10 text-green-400 border border-green-500/30',
    dot: 'bg-green-400',
    text: 'text-green-400',
  },
  LOW: {
    label: 'Low Risk',
    badge: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30',
    dot: 'bg-yellow-400',
    text: 'text-yellow-400',
  },
  SUSPICIOUS: {
    label: 'Suspicious',
    badge: 'bg-orange-500/10 text-orange-400 border border-orange-500/30',
    dot: 'bg-orange-400',
    text: 'text-orange-400',
  },
  HIGH: {
    label: 'High Risk',
    badge: 'bg-red-500/10 text-red-400 border border-red-500/30',
    dot: 'bg-red-400',
    text: 'text-red-400',
  },
  CRITICAL: {
    label: 'Critical',
    badge: 'bg-red-500/20 text-red-500 border border-red-500/50 animate-pulse',
    dot: 'bg-red-500',
    text: 'text-red-500',
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