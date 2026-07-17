import React, { useState } from 'react';
import { GlassCard as Card } from '@kongila/ui';
import { Notification } from '@kongila/shared-types';

interface ClientNotificationsPanelProps {
  notifications: Notification[];
  onMarkAllAsRead: () => void;
  onNavigate: (category: string, sourceRecordId?: string) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  Requests: '📄',
  Matches: '✨',
  Interviews: '📅',
  Contracts: '🤝',
  Billing: '💳',
  Messages: '💬',
  Marketing: '📣',
  System: '⚙️'
};

const CATEGORIES = ['All', 'Unread', 'Requests', 'Matches', 'Interviews', 'Contracts', 'Billing', 'Messages'];

export default function ClientNotificationsPanel({ notifications, onMarkAllAsRead, onNavigate }: ClientNotificationsPanelProps) {
  const [activeFilter, setActiveFilter] = useState('All');

  // Filter logic
  const filteredNotifications = notifications.filter(n => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Unread') return !n.read;
    return n.category === activeFilter;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', margin: '0 0 4px 0' }}>Notifications Centre</h2>
          <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>Review updates, alerts, and required actions.</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={onMarkAllAsRead} style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 600, color: '#0F172A', border: '1px solid #E2E8F0', borderRadius: '6px', background: 'white', cursor: 'pointer' }}>
            Mark all as read
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', borderBottom: '1px solid #E2E8F0' }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveFilter(cat)}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '20px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              border: 'none',
              background: activeFilter === cat ? '#0F172A' : '#F1F5F9',
              color: activeFilter === cat ? '#FFF' : '#475569',
              transition: 'all 0.2s ease'
            }}
          >
            {cat} {cat === 'Unread' && unreadCount > 0 ? `(${unreadCount})` : ''}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
        {filteredNotifications.length === 0 ? (
          <Card style={{ padding: '40px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>No notifications found for this filter.</p>
          </Card>
        ) : (
          filteredNotifications.map(n => (
            <Card 
              key={n.id} 
              style={{ 
                padding: '16px', 
                borderLeft: n.read ? '4px solid transparent' : '4px solid #2563EB',
                cursor: 'pointer',
                transition: 'transform 0.1s ease',
                background: n.read ? '#FFF' : '#F8FAFC'
              }}
              onClick={() => onNavigate(n.category || 'System', n.sourceRecordId)}
            >
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '24px', background: '#F1F5F9', width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {CATEGORY_ICONS[n.category || 'System'] || '🔔'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: n.read ? 500 : 700, color: '#0F172A', margin: 0 }}>{n.title}</h4>
                    <span style={{ fontSize: '12px', color: '#94A3B8', whiteSpace: 'nowrap' }}>
                      {new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: 1.4 }}>{n.message}</p>
                </div>
                {!n.read && (
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563EB', marginTop: '6px' }} />
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      <div style={{ textAlign: 'center', paddingTop: '16px' }}>
        <button style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 500, color: '#64748B', background: 'none', border: '1px solid #E2E8F0', borderRadius: '6px', cursor: 'pointer' }}>
          Load Older Notifications
        </button>
      </div>
    </div>
  );
}
