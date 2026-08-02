// services/analyzeApi.ts
// Mock analysis API for CTIP extension.
// TODO: Replace the mock implementation with a real fetch() call to the CTIP backend
//       POST /api/analyze endpoint once it is deployed.

import { CandidateWebsite, AnalysisResult, RecommendationAction } from '../shared/types';

// ── Known-safe domains (always return low risk in mock) ─────
const SAFE_DOMAINS = new Set([
  'google.com', 'www.google.com',
  'github.com', 'www.github.com',
  'stackoverflow.com',
  'microsoft.com', 'www.microsoft.com',
  'apple.com', 'www.apple.com',
  'mozilla.org', 'www.mozilla.org',
  'wikipedia.org', 'en.wikipedia.org',
  'youtube.com', 'www.youtube.com',
  'amazon.com', 'www.amazon.com',
  'linkedin.com', 'www.linkedin.com',
  'reddit.com', 'www.reddit.com',
]);

// ── Deterministic hash: same domain → same score every time ─
function hashDomain(domain: string): number {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    const char = domain.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0; // force 32-bit int
  }
  return Math.abs(hash);
}

function scoreFromHash(hash: number): number {
  // Spread across 0-100 deterministically
  return hash % 101;
}

function statusLabel(score: number): string {
  if (score <= 25) return 'TRUSTED';
  if (score <= 50) return 'LOW_RISK';
  if (score <= 70) return 'SUSPICIOUS';
  if (score <= 90) return 'HIGH_RISK';
  return 'CRITICAL';
}

function recommendationFromScore(score: number): RecommendationAction {
  if (score <= 50) return 'ALLOW';
  if (score <= 70) return 'WARN';
  return 'BLOCK';
}

// Reason pool — picked deterministically based on hash
const REASON_POOL: string[] = [
  'Copied Institutional Logo',
  'Highly Similar DOM Structure',
  'Suspicious Form Action',
  'Recently Registered Domain',
  'Domain Mimics Known University',
  'Mismatched SSL Certificate',
  'Hidden Input Fields Detected',
  'External Form Action URL',
  'JavaScript Credential Exfiltration Pattern',
  'Unusual Number of Tracking Scripts',
  'Page Title Mimics Official Portal',
  'Known Phishing Kit Signature',
];

function pickReasons(hash: number, count: number): string[] {
  const reasons: string[] = [];
  for (let i = 0; i < count; i++) {
    reasons.push(REASON_POOL[(hash + i * 7) % REASON_POOL.length]);
  }
  return [...new Set(reasons)].slice(0, count); // deduplicate
}

/**
 * Analyze a candidate website for phishing risk.
 *
 * TODO: Replace this mock with:
 *   const res = await fetch(`${BACKEND_URL}/api/analyze`, {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify(payload),
 *   });
 *   return res.json() as Promise<AnalysisResult>;
 */
export async function analyzeSite(payload: CandidateWebsite): Promise<AnalysisResult> {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 400));

  const domain = payload.domain.toLowerCase();

  // Safe domain shortcut
  if (SAFE_DOMAINS.has(domain)) {
    const safeScore = 5 + (hashDomain(domain) % 16); // 5-20 range
    return {
      status: 'TRUSTED',
      risk_score: safeScore,
      confidence: 95 + (hashDomain(domain) % 6), // 95-100
      recommendation: 'ALLOW',
      reasons: ['Domain is in institutional allowlist'],
    };
  }

  // Deterministic mock for unknown domains
  const hash = hashDomain(domain);
  const risk_score = scoreFromHash(hash);
  const confidence = 60 + (hash % 35); // 60-94

  return {
    status: statusLabel(risk_score),
    risk_score,
    confidence,
    recommendation: recommendationFromScore(risk_score),
    reasons: pickReasons(hash, risk_score > 70 ? 3 : 2),
  };
}
