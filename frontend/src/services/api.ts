// src/services/api.ts
import axios from 'axios';
import type {
  Threat,
  ThreatDetail,
  DigitalTwin,
  AppNotification,
  DashboardStats,
  TimelineItem,
  StatisticsData
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  }
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('ctip_token') || localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const api = {
  // Dashboard
  async getDashboardStats(): Promise<DashboardStats> {
    const res = await client.get('/dashboard');
    return res.data;
  },

  async getTimeline(): Promise<TimelineItem[]> {
    const res = await client.get('/dashboard/timeline');
    return res.data;
  },

  async getStatistics(): Promise<StatisticsData> {
    const res = await client.get('/dashboard/statistics');
    return res.data;
  },

  // Threats
  async getThreats(): Promise<Threat[]> {
    const res = await client.get('/threats');
    return res.data;
  },

  async getThreatDetail(id: string): Promise<ThreatDetail> {
    const res = await client.get(`/threats/${id}`);
    return res.data;
  },

  async updateThreatStatus(id: string, status: string, notes?: string) {
    const res = await client.post(`/threats/${id}/status`, { status, notes });
    return res.data;
  },

  // Digital Twins
  async getDigitalTwins(): Promise<DigitalTwin[]> {
    const res = await client.get('/digital-twins');
    return res.data;
  },

  async createDigitalTwin(website_name: string, official_url: string): Promise<DigitalTwin> {
    const res = await client.post('/digital-twins', { website_name, official_url });
    return res.data;
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
    const res = await client.get('/notifications');
    return res.data;
  },

  async markNotificationRead(id: string) {
    const res = await client.patch(`/notifications/${id}/read`);
    return res.data;
  },

  async markAllNotificationsRead() {
    const res = await client.post('/notifications/read-all');
    return res.data;
  },

  // Live Analysis
  async analyzeUrl(url: string, html?: string) {
    const payload: { url: string; html?: string } = { url };
    if (html) payload.html = html;
    const res = await client.post('/analyze', payload);
    return res.data;
  },

  // Auth
  async login(email: string, password: string) {
    const res = await client.post('/auth/login', { email, password });
    return res.data;
  }
};
