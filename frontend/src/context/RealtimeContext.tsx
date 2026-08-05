import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../services/api';
import type { Threat, AppNotification } from '../services/mockData';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

export interface RealtimeContextType {
  isConnected: boolean;
  threats: Threat[];
  notifications: AppNotification[];
  unreadCount: number;
  latestThreat: Threat | null;
  activeToast: { title: string; message: string; severity: 'critical' | 'high' | 'info' } | null;
  dismissToast: () => void;
  refreshThreats: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  updateThreatStatusLocally: (id: string, status: Threat['threat_status']) => void;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/alerts';

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [threats, setThreats] = useState<Threat[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [latestThreat, setLatestThreat] = useState<Threat | null>(null);
  const [activeToast, setActiveToast] = useState<{ title: string; message: string; severity: 'critical' | 'high' | 'info' } | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);

  const fetchThreats = useCallback(async () => {
    try {
      const data = await api.getThreats();
      setThreats(data);
    } catch (err) {
      console.warn('Failed to load initial threats', err);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data);
    } catch (err) {
      console.warn('Failed to load notifications', err);
    }
  }, []);

  useEffect(() => {
    fetchThreats();
    fetchNotifications();
  }, [fetchThreats, fetchNotifications]);

  const dismissToast = useCallback(() => {
    setActiveToast(null);
  }, []);

  const showToast = useCallback((title: string, message: string, severity: 'critical' | 'high' | 'info') => {
    setActiveToast({ title, message, severity });
    setTimeout(() => {
      setActiveToast((current) => (current?.title === title ? null : current));
    }, 6000);
  }, []);

  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    try {
      const payload: WebSocketMessage = JSON.parse(event.data);
      const { type, data } = payload;

      switch (type) {
        case 'THREAT_DETECTED': {
          const incomingThreat: Threat = {
            id: data.id || `thr_${Date.now()}`,
            url: data.url,
            domain: data.domain,
            targeted_portal: data.targeted_portal || 'ERP',
            risk_score: data.risk_score,
            confidence: data.confidence,
            threat_status: (data.threat_status as Threat['threat_status']) || 'ACTIVE',
            detected_at: data.detected_at || new Date().toISOString(),
            screenshot_path: data.screenshot_path || '/mock/screenshots/threat_001.png',
          };

          setLatestThreat(incomingThreat);
          setThreats((prev) => {
            const exists = prev.some((t) => t.id === incomingThreat.id || t.domain === incomingThreat.domain);
            if (exists) {
              return prev.map((t) => (t.id === incomingThreat.id || t.domain === incomingThreat.domain ? incomingThreat : t));
            }
            return [incomingThreat, ...prev];
          });

          // Trigger Live Audio/Visual Toast
          const isCritical = incomingThreat.risk_score >= 90;
          showToast(
            isCritical ? '🚨 Critical Phishing Threat Detected!' : '⚠️ Suspicious Domain Detected',
            `${incomingThreat.domain} scored ${incomingThreat.risk_score}% risk targeting ${incomingThreat.targeted_portal}`,
            isCritical ? 'critical' : 'high'
          );
          break;
        }

        case 'THREAT_STATUS_CHANGED': {
          setThreats((prev) =>
            prev.map((t) => (t.id === data.threat_id ? { ...t, threat_status: data.status } : t))
          );
          break;
        }

        case 'NEW_NOTIFICATION': {
          const newNotif: AppNotification = {
            id: data.id || `notif_${Date.now()}`,
            title: data.title,
            message: data.message,
            read_status: data.read_status || false,
            created_at: data.created_at || new Date().toISOString(),
            threat_id: data.threat_id,
          };
          setNotifications((prev) => [newNotif, ...prev]);
          break;
        }

        case 'NOTIFICATIONS_UPDATED': {
          if (data.all_read) {
            setNotifications((prev) => prev.map((n) => ({ ...n, read_status: true })));
          } else if (data.notification_id) {
            setNotifications((prev) =>
              prev.map((n) => (n.id === data.notification_id ? { ...n, read_status: true } : n))
            );
          }
          break;
        }

        case 'DIGITAL_TWIN_CREATED': {
          showToast(
            '🛡️ Digital Twin Registered',
            `Baseline fingerprint created for ${data.website_name} (${data.official_url})`,
            'info'
          );
          break;
        }

        case 'PROTECTION_EVENT': {
          if (data.event_type === 'LOGIN_BLOCKED') {
            showToast(
              '🛡️ Credential Interception Blocked',
              `Student was protected from entering credentials on malicious domain: ${data.domain}`,
              'high'
            );
          }
          break;
        }

        case 'PONG':
        case 'CONNECTED':
          break;

        default:
          break;
      }
    } catch (e) {
      console.warn('Error parsing WebSocket payload:', e);
    }
  }, [showToast]);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const socket = new WebSocket(WS_URL);
      wsRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        // Start ping heartbeat
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, 20000);
      };

      socket.onmessage = handleWebSocketMessage;

      socket.onclose = () => {
        setIsConnected(false);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        // Reconnect after 3 seconds
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connectWebSocket();
        }, 3000);
      };

      socket.onerror = (err) => {
        console.warn('WebSocket connection error:', err);
        socket.close();
      };
    } catch (err) {
      console.warn('Failed to initialize WebSocket:', err);
      setIsConnected(false);
    }
  }, [handleWebSocketMessage]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  const markNotificationAsRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_status: true } : n)));
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read_status: true })));
    } catch (err) {
      console.error('Failed to mark all notifications as read', err);
    }
  };

  const updateThreatStatusLocally = (id: string, status: Threat['threat_status']) => {
    setThreats((prev) => prev.map((t) => (t.id === id ? { ...t, threat_status: status } : t)));
  };

  const unreadCount = notifications.filter((n) => !n.read_status).length;

  return (
    <RealtimeContext.Provider
      value={{
        isConnected,
        threats,
        notifications,
        unreadCount,
        latestThreat,
        activeToast,
        dismissToast,
        refreshThreats: fetchThreats,
        refreshNotifications: fetchNotifications,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        updateThreatStatusLocally,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
};
