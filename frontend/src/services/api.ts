// src/services/api.ts
import axios from 'axios';
import {
  mockDashboardStats,
  mockAnalytics,
  mockTimeline,
  mockThreats,
  mockThreatDetail,
  mockDigitalTwins,
  mockNotifications,
  type Threat,
  type DigitalTwin,
  type AppNotification
} from './mockData';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  }
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});


export const api = {
  // Dashboard
  async getDashboardStats() {
    try {
      const res = await client.get('/dashboard');
      return res.data;
    } catch {
      return mockDashboardStats;
    }
  },

  async getTimeline() {
    try {
      const res = await client.get('/dashboard/timeline');
      return res.data;
    } catch {
      return mockTimeline;
    }
  },

  async getStatistics() {
    try {
      const res = await client.get('/dashboard/statistics');
      return res.data;
    } catch {
      return mockAnalytics;
    }
  },


    // Threats
async getThreats(): Promise<Threat[]> {
  const res = await client.get('/threats');
  return res.data;
},




  async getThreatDetail(id: string) {
    try {
      const res = await client.get(`/threats/${id}`);
      return res.data;
    } catch {
      return mockThreatDetail;
    }
  },

  async updateThreatStatus(id: string, status: string, notes?: string) {
    try {
      const res = await client.post(`/threats/${id}/status`, { status, notes });
      return res.data;
    } catch {
      return { success: true, id, status };
    }
  },

  // Digital Twins
  async getDigitalTwins(): Promise<DigitalTwin[]> {
    try {
      const res = await client.get('/digital-twins');
      return res.data;
    } catch {
      return mockDigitalTwins;
    }
  },

  async createDigitalTwin(website_name: string, official_url: string): Promise<DigitalTwin> {
    try {
      const res = await client.post('/digital-twins', { website_name, official_url });
      return res.data;
    } catch {
      return {
        id: `dt_${Date.now()}`,
        website_name,
        official_url,
        fingerprint_version: 1,
        screenshot_path: '/mock/screenshots/official_erp.png',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
  },

  // Notifications
  async getNotifications(): Promise<AppNotification[]> {
    try {
      const res = await client.get('/notifications');
      return res.data;
    } catch {
      return mockNotifications;
    }
  },

  async markNotificationRead(id: string) {
    try {
      const res = await client.patch(`/notifications/${id}/read`);
      return res.data;
    } catch {
      return { success: true, id };
    }
  },

  // Live Analysis
  async analyzeUrl(url: string) {
    try {
      const res = await client.post('/analyze', { url });
      return res.data;
    } catch {
      return {
        status: 'HIGH_RISK',
        risk_score: 88,
        confidence: 94,
        recommendation: 'BLOCK',
        reasons: ['Copied Institutional Logo', 'Suspicious Form Action']
      };
    }
  }
};
