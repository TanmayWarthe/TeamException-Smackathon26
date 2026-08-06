// services/analyzeApi.ts
// CTIP extension client for live backend threat analysis.

import { CandidateWebsite, AnalysisResult, RecommendationAction } from '../shared/types';

// ── Known-safe domains & Institutional official domains ─────
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
  // Official Campus Domains
  'ycce.edu', 'www.ycce.edu',
  'ycce.edu.in', 'www.ycce.edu.in',
  'portal.ycce.edu', 'student.ycce.edu',
  'exam.ycce.edu.in', 'moodle.ycce.edu.in',
  'meghegroup.org', 'www.meghegroup.org',
  'nagpuruniversity.ac.in', 'www.nagpuruniversity.ac.in',
]);

const INSTITUTIONAL_ROOTS = [
  'ycce.edu',
  'ycce.edu.in',
  'meghegroup.org',
  'nagpuruniversity.ac.in',
];

function isKnownSafeOrInstitutionalDomain(domain: string): boolean {
  const d = domain.toLowerCase().trim();
  if (SAFE_DOMAINS.has(d)) return true;
  for (const root of INSTITUTIONAL_ROOTS) {
    if (d === root || d.endsWith('.' + root)) return true;
  }
  return false;
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

const BACKEND_URL = 'http://localhost:8000/api/analyze';

/**
 * Analyze a candidate website for phishing risk via real CTIP backend.
 */
export async function analyzeSite(payload: CandidateWebsite): Promise<AnalysisResult> {
  const domain = payload.domain.toLowerCase();
  const url = (payload.url || '').toLowerCase();

  // 1. Check management console ports (SOC dashboard 5173, backend 8000, dev 3000)
  try {
    const parsedUrl = new URL(payload.url);
    const host = parsedUrl.hostname;
    const port = parsedUrl.port;
    if ((host === 'localhost' || host === '127.0.0.1') && (port === '5173' || port === '8000' || port === '3000')) {
      return {
        status: 'TRUSTED',
        risk_score: 0,
        confidence: 100,
        recommendation: 'ALLOW',
        source: 'backend' as const,
        reasons: ['CTIP SOC Management Console / Internal Service'],
      };
    }
  } catch {
    // Continue if URL parsing fails
  }

  // 2. Safe / Institutional official domain shortcut
  if (isKnownSafeOrInstitutionalDomain(domain)) {
    return {
      status: 'TRUSTED',
      risk_score: 0,
      confidence: 99,
      recommendation: 'ALLOW',
      source: 'backend' as const,
      reasons: ['Official verified institutional campus domain'],
    };
  }

  // 3. Dispatch to live CTIP AI analysis backend
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const res = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: payload.url,
        html: payload.domSnapshot || undefined,
        dom_snapshot: payload.domSnapshot || undefined,
        domSnapshot: payload.domSnapshot || undefined,
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const score = data.risk_score ?? 0;
      return {
        status: data.status || statusLabel(score),
        risk_score: score,
        confidence: data.confidence ?? 85,
        recommendation: data.recommendation || recommendationFromScore(score),
        reasons: Array.isArray(data.reasons) && data.reasons.length > 0 ? data.reasons : [
          data.matched_twin ? `Compared against twin: ${data.matched_twin}` : 'Live DOM & visual risk analysis completed'
        ],
        matched_twin: data.matched_twin || undefined,
        source: 'backend' as const,
      };
    }
  } catch (e) {
    console.warn('[CTIP] Live backend /api/analyze unavailable:', e);
  }

  // 4. Truthful fallback state if backend is offline/unreachable
  return {
    status: 'UNKNOWN',
    risk_score: 0,
    confidence: 0,
    recommendation: 'ALLOW',
    reasons: ['Backend threat analysis engine unavailable'],
    source: 'fallback' as const,
  };
}
