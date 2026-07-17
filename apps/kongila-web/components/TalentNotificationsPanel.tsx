import React, { useState } from 'react';
import { GlassCard as Card, NeonButton as Button } from '@kongila/ui';
import { Notification } from '@kongila/shared-types';
import { supabase } from '../lib/supabaseClient';

interface TalentNotificationsPanelProps {
  notifications: Notification[];
  setNotifications: (notifications: Notification[]) => void;
  setActiveSection: (section: any) => void;
}

type FilterTab = 'All' | 'Unread' | 'Vetting' | 'Interviews' | 'Contracts' | 'Payments' | 'Messages';

export default function TalentNotificationsPanel({
  notifications,
  setNotifications,
  setActiveSection
}: TalentNotificationsPanelProps) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All');

  // Sort by reverse chronological
  const sortedNotifications = [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Filter Logic
  const filteredNotifications = sortedNotifications.filter(n => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Unread') return !n.read;

    // Map UI filters to DB categories
    const cat = n.category;
    if (activeFilter === 'Vetting' && (cat === 'Requests' || cat === 'Matches' || cat === 'System')) return true;
    if (activeFilter === 'Interviews' && cat === 'Interviews') return true;
    if (activeFilter === 'Contracts' && cat === 'Contracts') return true;
    if (activeFilter === 'Payments' && cat === 'Billing') return true;
    if (activeFilter === 'Messages' && cat === 'Messages') return true;
    
    return false;
  });

  const handleMarkAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;

    // Optimistic UI update
    setNotifications(
      notifications.map(n => ({ ...n, read: true }))
    );

    // Backend update
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', unreadIds);

    if (error) {
      console.error('Failed to mark all as read:', error.message);
    }
  };

  const handleNotificationClick = async (n: Notification) => {
    // 1. Mark as read if unread
    if (!n.read) {
      // Optimistic update
      setNotifications(
        notifications.map(notif => notif.id === n.id ? { ...notif, read: true } : notif)
      );

      // Backend update
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', n.id);
    }

    // 2. Click-Through Navigation (REQ-KT-1203)
    switch (n.category) {
      case 'Requests':
      case 'Matches':
      case 'System':
        setActiveSection('vetting_progress');
        break;
      case 'Interviews':
        setActiveSection('interviews');
        break;
      case 'Contracts':
        setActiveSection('contracts');
        break;
      case 'Billing':
        setActiveSection('earnings');
        break;
      case 'Messages':
        setActiveSection('messages');
        break;
      default:
        setActiveSection('dashboard');
        break;
    }
  };

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'Requests':
      case 'Matches': return '🔍';
      case 'Interviews': return '📅';
      case 'Contracts': return '📄';
      case 'Billing': return '💰';
      case 'Messages': return '✉️';
      case 'Marketing': return '📢';
      default: return '🔔';
    }
  };

  const tabs: FilterTab[] = ['All', 'Unread', 'Vetting', 'Interviews', 'Contracts', 'Payments', 'Messages'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', margin: '0 0 4px 0' }}>Notifications Centre</h2>
          <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>Your complete history of alerts and updates.</p>
        </div>
        <Button 
          onClick={handleMarkAllAsRead}
          disabled={notifications.every(n => n.read)}
          style={{ 
            background: notifications.every(n => n.read) ? '#E2E8F0' : '#F1F5F9', 
            color: notifications.every(n => n.read) ? '#94A3B8' : '#0F172A', 
            border: '1px solid #CBD5E1', 
            padding: '8px 16px', 
            borderRadius: '6px', 
            cursor: notifications.every(n => n.read) ? 'not-allowed' : 'pointer', 
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          ✓ Mark All as Read
        </Button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px', overflowX: 'auto' }}>
        {tabs.map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveFilter(tab)} 
            style={{ 
              background: activeFilter === tab ? '#2563EB' : '#F8FAFC', 
              border: activeFilter === tab ? '1px solid #2563EB' : '1px solid #E2E8F0', 
              padding: '6px 14px', 
              fontSize: '13px', 
              fontWeight: activeFilter === tab ? 600 : 500, 
              color: activeFilter === tab ? '#FFFFFF' : '#475569', 
              cursor: 'pointer',
              borderRadius: '99px',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
          >
            {tab}
            {tab === 'Unread' && notifications.filter(n => !n.read).length > 0 && (
              <span style={{ marginLeft: '6px', background: activeFilter === 'Unread' ? '#FFFFFF' : '#EF4444', color: activeFilter === 'Unread' ? '#2563EB' : '#FFFFFF', padding: '2px 6px', borderRadius: '10px', fontSize: '11px', fontWeight: 800 }}>
                {notifications.filter(n => !n.read).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredNotifications.length === 0 ? (
          <Card style={{ padding: '40px', textAlign: 'center', background: '#FFFFFF' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
            <h3 style={{ margin: '0 0 8px 0', color: '#0F172A', fontSize: '16px' }}>No notifications found</h3>
            <p style={{ color: '#64748B', fontSize: '14px', margin: 0 }}>You're all caught up in this category.</p>
          </Card>
        ) : (
          filteredNotifications.map(notification => (
            <Card 
              key={notification.id} 
              onClick={() => handleNotificationClick(notification)}
              style={{ 
                padding: '20px', 
                background: notification.read ? '#FFFFFF' : '#EFF6FF',
                borderLeft: notification.read ? '4px solid transparent' : '4px solid #2563EB',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                gap: '16px',
                alignItems: 'flex-start'
              }}
            >
              <div style={{ fontSize: '24px', background: '#F8FAFC', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {getCategoryIcon(notification.category)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: notification.read ? 600 : 700, color: '#0F172A', margin: 0 }}>
                    {notification.title}
                  </h3>
                  <span style={{ fontSize: '12px', color: '#64748B', whiteSpace: 'nowrap' }}>
                    {new Date(notification.createdAt).toLocaleString()}
                  </span>
                </div>
                <p style={{ fontSize: '14px', color: notification.read ? '#475569' : '#1E293B', margin: '0 0 8px 0', lineHeight: 1.5 }}>
                  {notification.message}
                </p>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {notification.category}
                </div>
              </div>
              {!notification.read && (
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2563EB', flexShrink: 0, marginTop: '8px' }} />
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
