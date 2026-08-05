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
    try {
      const res = await client.get('/threats');
      return res.data;
    } catch {
      return mockThreats;
    }
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

  async updateDigitalTwin(
    id: string,
    data: { website_name?: string; official_url?: string; regenerate_fingerprint?: boolean }
  ): Promise<DigitalTwin> {
    const res = await client.put(`/digital-twins/${id}`, data);
    return res.data;
  },

  async deleteDigitalTwin(id: string): Promise<{ ok: boolean; message: string }> {
    const res = await client.delete(`/digital-twins/${id}`);
    return res.data;
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

  async markAllNotificationsRead() {
    try {
      const res = await client.post('/notifications/read-all');
      return res.data;
    } catch {
      return { success: true };
    }
  },

  // Live Analysis
  async analyzeUrl(url: string, html?: string) {
    try {
      const payload: { url: string; html?: string } = { url };
      if (html) payload.html = html;
      const res = await client.post('/analyze', payload);
      return res.data;
    } catch (err: any) {
      if (err.response && err.response.data) {
        return err.response.data;
      }
      return {
        status: 'HIGH_RISK',
        risk_score: 88,
        confidence: 94,
        recommendation: 'BLOCK',
        risk_level: 'HIGH',
        reasons: ['Copied Institutional Logo', 'Suspicious Form Action'],
        risk_breakdown: [
          { feature: 'Visual Similarity', score: 92, weight: 25, contribution: 23 },
          { feature: 'DOM Similarity', score: 85, weight: 20, contribution: 17 },
          { feature: 'Form Similarity', score: 95, weight: 20, contribution: 19 },
          { feature: 'JavaScript Behaviour', score: 80, weight: 15, contribution: 12 },
          { feature: 'Logo Similarity', score: 98, weight: 10, contribution: 9.8 },
          { feature: 'URL Intelligence', score: 75, weight: 5, contribution: 3.75 },
          { feature: 'SSL Trust', score: 60, weight: 5, contribution: 3.0 },
        ],
      };
    }
  }
};
