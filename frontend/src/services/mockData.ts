// src/services/mockData.ts
// Mock data matching the exact API response shapes from Chapter 15 (API Design).
// Use this to build every page NOW. Once backend is ready, replace these
// with real axios calls — keep the same shape so components don't break.

// ==========================================================
// 1. DASHBOARD OVERVIEW  →  GET /api/dashboard
// ==========================================================
export const mockDashboardStats = {
  total_threats: 125,
  critical: 8,
  high: 12,
  suspicious: 21,
  low: 34,
  trusted: 50,
  students_protected: 842,
  credential_blocks: 43,
  digital_twins: 5,
  average_risk_score: 62.4,
}

// ==========================================================
// 2. DASHBOARD TIMELINE  →  GET /api/dashboard/timeline
// ==========================================================
export const mockTimeline = [
  { time: '2026-08-02T09:15:00Z', event: 'NEW_DOMAIN_DETECTED', label: 'New Domain Detected', website: 'ycce-erp-login.xyz' },
  { time: '2026-08-02T09:16:00Z', event: 'WEBSITE_CRAWLED', label: 'Website Crawled', website: 'ycce-erp-login.xyz' },
  { time: '2026-08-02T09:17:00Z', event: 'SIMILARITY_COMPLETED', label: 'Similarity Analysis Completed', website: 'ycce-erp-login.xyz' },
  { time: '2026-08-02T09:18:00Z', event: 'RISK_SCORED', label: 'Risk Score: 96%', website: 'ycce-erp-login.xyz' },
  { time: '2026-08-02T09:18:30Z', event: 'ADMIN_ALERT', label: 'Administrator Alert Generated', website: 'ycce-erp-login.xyz' },
  { time: '2026-08-02T09:21:00Z', event: 'STUDENT_BLOCKED', label: 'Student Attempt Blocked', website: 'ycce-erp-login.xyz' },
]

// ==========================================================
// 3. DASHBOARD ANALYTICS  →  GET /api/dashboard/statistics
// ==========================================================
export const mockAnalytics = {
  risk_distribution: [
    { name: 'Trusted', value: 50 },
    { name: 'Low', value: 34 },
    { name: 'Suspicious', value: 21 },
    { name: 'High', value: 12 },
    { name: 'Critical', value: 8 },
  ],
  threats_over_time: [
    { date: '2026-07-27', count: 4 },
    { date: '2026-07-28', count: 7 },
    { date: '2026-07-29', count: 3 },
    { date: '2026-07-30', count: 9 },
    { date: '2026-07-31', count: 12 },
    { date: '2026-08-01', count: 6 },
    { date: '2026-08-02', count: 10 },
  ],
  most_targeted_portals: [
    { portal: 'ERP', count: 62 },
    { portal: 'Webmail', count: 28 },
    { portal: 'Scholarship', count: 19 },
    { portal: 'Exam Portal', count: 16 },
  ],
}

// ==========================================================
// 4. THREAT LIST  →  GET /api/threats
// ==========================================================
export interface Threat {
  id: string
  url: string
  domain: string
  targeted_portal: string
  risk_score: number
  confidence: number
  threat_status: 'ACTIVE' | 'BLOCKED' | 'RESOLVED' | 'IGNORED'
  detected_at: string
  screenshot_path: string
}

export const mockThreats: Threat[] = [
  {
    id: 'thr_001',
    url: 'https://ycce-erp-login.xyz',
    domain: 'ycce-erp-login.xyz',
    targeted_portal: 'ERP',
    risk_score: 96,
    confidence: 98,
    threat_status: 'ACTIVE',
    detected_at: '2026-08-02T09:18:00Z',
    screenshot_path: '/mock/screenshots/threat_001.png',
  },
  {
    id: 'thr_002',
    url: 'https://ycceportal.site',
    domain: 'ycceportal.site',
    targeted_portal: 'Student Portal',
    risk_score: 82,
    confidence: 91,
    threat_status: 'ACTIVE',
    detected_at: '2026-08-01T14:02:00Z',
    screenshot_path: '/mock/screenshots/threat_002.png',
  },
  {
    id: 'thr_003',
    url: 'https://ycce-webmail-secure.net',
    domain: 'ycce-webmail-secure.net',
    targeted_portal: 'Webmail',
    risk_score: 58,
    confidence: 74,
    threat_status: 'ACTIVE',
    detected_at: '2026-08-01T10:45:00Z',
    screenshot_path: '/mock/screenshots/threat_003.png',
  },
  {
    id: 'thr_004',
    url: 'https://ycce-scholarship-apply.com',
    domain: 'ycce-scholarship-apply.com',
    targeted_portal: 'Scholarship',
    risk_score: 34,
    confidence: 65,
    threat_status: 'RESOLVED',
    detected_at: '2026-07-30T08:12:00Z',
    screenshot_path: '/mock/screenshots/threat_004.png',
  },
  {
    id: 'thr_005',
    url: 'https://dev.erp.ycce.edu.in',
    domain: 'dev.erp.ycce.edu.in',
    targeted_portal: 'ERP',
    risk_score: 12,
    confidence: 88,
    threat_status: 'IGNORED',
    detected_at: '2026-07-29T16:30:00Z',
    screenshot_path: '/mock/screenshots/threat_005.png',
  },
]

// ==========================================================
// 5. THREAT DETAILS  →  GET /api/threats/{id}
// ==========================================================
export const mockThreatDetail = {
  id: 'thr_001',
  url: 'https://ycce-erp-login.xyz',
  domain: 'ycce-erp-login.xyz',
  ip_address: '185.220.101.4',
  registrar: 'NameCheap Inc.',
  ssl_status: 'Valid (Recently Issued)',
  risk_score: 96,
  confidence: 98,
  threat_status: 'ACTIVE',
  targeted_portal: 'ERP',
  detected_at: '2026-08-02T09:18:00Z',
  screenshot_path: '/mock/screenshots/threat_001.png',
  official_screenshot_path: '/mock/screenshots/official_erp.png',

  similarity_report: {
    visual_similarity: 97.4,
    dom_similarity: 95.8,
    css_similarity: 94.1,
    logo_similarity: 100,
    form_similarity: 99.0,
    ssl_similarity: 70.0,
    javascript_similarity: 92.3,
    url_similarity: 18.0,
    overall_similarity: 91.2,
  },

  risk_breakdown: [
    { feature: 'Visual Similarity', score: 98, weight: 25, contribution: 24.5 },
    { feature: 'DOM Similarity', score: 96, weight: 20, contribution: 19.2 },
    { feature: 'Form Similarity', score: 97, weight: 20, contribution: 19.4 },
    { feature: 'JavaScript Behaviour', score: 92, weight: 15, contribution: 13.8 },
    { feature: 'Logo Similarity', score: 100, weight: 10, contribution: 10.0 },
    { feature: 'URL Intelligence', score: 18, weight: 5, contribution: 0.9 },
    { feature: 'SSL Trust', score: 70, weight: 5, contribution: 3.5 },
  ],

  explanation: {
    risk_score: 96,
    reasons: [
      'Copied Institutional Logo',
      'Highly Similar DOM Structure',
      'Credential Submission Redirected to Unknown Server',
      'Suspicious Domain (Recently Registered)',
      'Recently Issued SSL Certificate',
    ],
    recommendation: 'Do Not Enter Credentials',
  },

  evidence: {
    html_path: '/mock/evidence/thr_001.html',
    dom_path: '/mock/evidence/thr_001_dom.json',
    css_path: '/mock/evidence/thr_001.css',
    javascript_path: '/mock/evidence/thr_001.js',
  },

  timeline: [
    { time: '09:15 AM', label: 'New Domain Detected' },
    { time: '09:16 AM', label: 'Website Crawled' },
    { time: '09:17 AM', label: 'Similarity Analysis Completed' },
    { time: '09:18 AM', label: 'Risk Score: 96%' },
    { time: '09:18 AM', label: 'Administrator Alert Generated' },
    { time: '09:21 AM', label: 'Student Attempt Blocked' },
  ],

  admin_notes: '',
}

// ==========================================================
// 6. DIGITAL TWINS LIST  →  GET /api/digital-twins
// ==========================================================
export interface DigitalTwin {
  id: string
  website_name: string
  official_url: string
  fingerprint_version: number
  screenshot_path: string
  created_at: string
  updated_at: string
}

export const mockDigitalTwins: DigitalTwin[] = [
  {
    id: 'dt_001',
    website_name: 'YCCE ERP',
    official_url: 'https://erp.ycce.edu.in',
    fingerprint_version: 3,
    screenshot_path: '/mock/screenshots/official_erp.png',
    created_at: '2026-05-10T10:00:00Z',
    updated_at: '2026-07-15T10:00:00Z',
  },
  {
    id: 'dt_002',
    website_name: 'YCCE Webmail',
    official_url: 'https://mail.ycce.edu.in',
    fingerprint_version: 1,
    screenshot_path: '/mock/screenshots/official_webmail.png',
    created_at: '2026-05-12T10:00:00Z',
    updated_at: '2026-05-12T10:00:00Z',
  },
  {
    id: 'dt_003',
    website_name: 'YCCE Student Portal',
    official_url: 'https://student.ycce.edu.in',
    fingerprint_version: 2,
    screenshot_path: '/mock/screenshots/official_portal.png',
    created_at: '2026-05-14T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
  },
]

// ==========================================================
// 7. NOTIFICATIONS  →  GET /api/notifications
// ==========================================================
export interface AppNotification {
  id: string
  title: string
  message: string
  read_status: boolean
  created_at: string
  threat_id?: string
}

export const mockNotifications: AppNotification[] = [
  {
    id: 'ntf_001',
    title: 'Critical Threat Detected',
    message: 'ycce-erp-login.xyz scored 96% risk. Immediate review recommended.',
    read_status: false,
    created_at: '2026-08-02T09:18:30Z',
    threat_id: 'thr_001',
  },
  {
    id: 'ntf_002',
    title: 'High Risk Threat Detected',
    message: 'ycceportal.site scored 82% risk.',
    read_status: false,
    created_at: '2026-08-01T14:03:00Z',
    threat_id: 'thr_002',
  },
  {
    id: 'ntf_003',
    title: 'Digital Twin Updated',
    message: 'YCCE ERP fingerprint regenerated (version 3).',
    read_status: true,
    created_at: '2026-07-15T10:00:00Z',
  },
]

// ==========================================================
// 8. STUDENT PROTECTION ANALYTICS  →  GET /api/events
// ==========================================================
export const mockStudentEvents = {
  warning_displayed: 312,
  login_blocked: 43,
  login_allowed: 891,
  threat_ignored: 27,
  by_browser: [
    { browser: 'Chrome', count: 610 },
    { browser: 'Edge', count: 180 },
    { browser: 'Firefox', count: 90 },
  ],
}

// ==========================================================
// 9. LOGIN  →  POST /api/auth/login  (response shape)
// ==========================================================
export const mockLoginResponse = {
  token: 'mock-jwt-token',
  expires_in: 3600,
  user: {
    id: 'usr_001',
    name: 'Administrator',
    email: 'admin@ycce.edu.in',
    role: 'ADMIN',
  },
}