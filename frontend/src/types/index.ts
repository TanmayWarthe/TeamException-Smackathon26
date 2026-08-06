// src/types/index.ts
// Domain interface definitions for CTIP SOC Dashboard.

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export interface Threat {
  id: string;
  url: string;
  domain: string;
  targeted_portal: string;
  risk_score: number;
  confidence: number;
  threat_status: 'ACTIVE' | 'BLOCKED' | 'RESOLVED' | 'IGNORED';
  detected_at: string;
  screenshot_path: string;
}

export interface SimilarityReport {
  visual_similarity?: number;
  dom_similarity?: number;
  css_similarity?: number;
  logo_similarity?: number;
  form_similarity?: number;
  ssl_similarity?: number;
  javascript_similarity?: number;
  url_similarity?: number;
  overall_similarity?: number;
}

export interface RiskBreakdownItem {
  feature: string;
  score: number;
  weight: number;
  contribution: number;
}

export interface ThreatExplanation {
  risk_score: number;
  reasons: string[];
  recommendation: string;
}

export interface ThreatEvidence {
  html_path?: string;
  dom_path?: string;
  css_path?: string;
  javascript_path?: string;
}

export interface TimelineItem {
  time: string;
  event?: string;
  label: string;
  website?: string;
}

export interface ThreatDetail {
  id: string;
  url: string;
  domain: string;
  ip_address: string;
  registrar: string;
  ssl_status: string;
  risk_score: number;
  confidence: number;
  threat_status: 'ACTIVE' | 'BLOCKED' | 'RESOLVED' | 'IGNORED';
  targeted_portal: string;
  detected_at: string;
  screenshot_path: string;
  official_screenshot_path: string;
  similarity_report: SimilarityReport;
  risk_breakdown: RiskBreakdownItem[];
  explanation: ThreatExplanation;
  evidence: ThreatEvidence;
  timeline: TimelineItem[];
  admin_notes: string;
  matched_twin?: {
    website_name?: string;
    domain?: string;
    official_url?: string;
  };
}

export interface DigitalTwin {
  id: string;
  website_name: string;
  official_url: string;
  fingerprint_version: number;
  screenshot_path: string;
  created_at: string;
  updated_at: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  read_status: boolean;
  created_at: string;
  threat_id?: string;
}

export interface DashboardStats {
  total_threats: number;
  critical: number;
  high: number;
  suspicious: number;
  low: number;
  trusted: number;
  students_protected: number;
  credential_blocks: number;
  digital_twins: number;
  average_risk_score: number;
}

export interface StatisticsData {
  risk_distribution: { name: string; value: number }[];
  threats_over_time: { date: string; count: number }[];
  most_targeted_portals: { portal: string; count: number }[];
}

export interface ProtectionEventStats {
  warning_displayed: number;
  login_blocked: number;
  login_allowed: number;
  threat_ignored: number;
  by_browser: { browser: string; count: number }[];
}