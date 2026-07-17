import React, { useState, useEffect, useRef } from 'react';
import { GlassCard as Card, NeonButton as Button } from '@kongila/ui';
import { Conversation, Message } from '@kongila/shared-types';
import { supabase } from '../lib/supabaseClient';

interface TalentMessagesPanelProps {
  currentUser: any;
  conversations: Conversation[];
  messages: Message[];
  setMessages: (messages: Message[]) => void;
}

export default function TalentMessagesPanel({
  currentUser,
  conversations,
  messages,
  setMessages
}: TalentMessagesPanelProps) {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [composerText, setComposerText] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Filter conversations relevant to this talent
  const myConversations = conversations.filter(c => 
    c.type === 'talent_admin' && c.participantIds.includes(currentUser?.id)
  ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const activeConversation = myConversations.find(c => c.id === activeConversationId);
  const activeMessages = messages
    .filter(m => m.conversationId === activeConversationId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Mark unread messages as read when opening a conversation
  useEffect(() => {
    if (!activeConversationId || !currentUser) return;

    const unreadMessagesFromOthers = activeMessages.filter(
      m => m.senderId !== currentUser.id && !m.isRead
    );

    if (unreadMessagesFromOthers.length > 0) {
      const markAsRead = async () => {
        const ids = unreadMessagesFromOthers.map(m => m.id);
        const { error } = await supabase
          .from('messages')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .in('id', ids);

        if (!error) {
          setMessages(messages.map(m => 
            ids.includes(m.id) ? { ...m, isRead: true, readAt: new Date().toISOString() } : m
          ));
        }
      };
      markAsRead();
    }
  }, [activeConversationId, activeMessages.length, currentUser]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages]);

  const handleSendMessage = async () => {
    if (!composerText.trim() && !attachment) return;
    if (!activeConversationId || !currentUser) return;

    let attachmentUrl = '';
    let attachmentName = '';

    if (attachment) {
      // REQ-KT-1103: File attachment support up to 10MB
      if (attachment.size > 10 * 1024 * 1024) {
        alert('File size exceeds 10MB limit.');
        return;
      }
      setIsUploading(true);
      const fileExt = attachment.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `talent-${currentUser.id}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('message-attachments')
        .upload(filePath, attachment);

      if (error) {
        alert('Failed to upload attachment: ' + error.message);
        setIsUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('message-attachments')
        .getPublicUrl(filePath);

      attachmentUrl = urlData.publicUrl;
      attachmentName = attachment.name;
      setIsUploading(false);
    }

    const newMessageRow = {
      id: crypto.randomUUID(),
      conversation_id: activeConversationId,
      sender_id: currentUser.id,
      content: composerText,
      attachment_url: attachmentUrl || null,
      attachment_name: attachmentName || null,
      is_read: false,
      timestamp: new Date().toISOString()
    };

    const { data, error } = await supabase.from('messages').insert([newMessageRow]).select();

    if (error) {
      alert('Failed to send message: ' + error.message);
      return;
    }

    if (data && data[0]) {
      const formattedMessage: Message = {
        id: data[0].id,
        conversationId: data[0].conversation_id,
        senderId: data[0].sender_id,
        content: data[0].content,
        attachmentUrl: data[0].attachment_url,
        attachmentName: data[0].attachment_name,
        timestamp: data[0].timestamp,
        isRead: false
      };
      setMessages([...messages, formattedMessage]);
    }

    // Update conversation updatedAt
    await supabase.from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', activeConversationId);

    setComposerText('');
    setAttachment(null);
  };

  const getUnreadCount = (convId: string) => {
    return messages.filter(m => m.conversationId === convId && m.senderId !== currentUser?.id && !m.isRead).length;
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 140px)', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
      {/* Sidebar: Conversation List */}
      <div style={{ width: '320px', borderRight: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', background: '#F8FAFC' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #E2E8F0', background: '#FFFFFF' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Messages</h2>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {myConversations.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: '#64748B', fontSize: '14px' }}>
              No messages yet.<br/>Conversations will appear here when an admin reaches out.
            </div>
          ) : (
            myConversations.map(conv => {
              const unreadCount = getUnreadCount(conv.id);
              const isActive = activeConversationId === conv.id;
              
              // Get last message for snippet
              const convMessages = messages.filter(m => m.conversationId === conv.id);
              const lastMessage = convMessages.length > 0 
                ? convMessages.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0] 
                : null;

              return (
                <div 
                  key={conv.id}
                  onClick={() => setActiveConversationId(conv.id)}
                  style={{ 
                    padding: '16px 20px', 
                    borderBottom: '1px solid #E2E8F0', 
                    cursor: 'pointer',
                    background: isActive ? '#EFF6FF' : '#FFFFFF',
                    borderLeft: isActive ? '4px solid #2563EB' : '4px solid transparent',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ fontWeight: unreadCount > 0 ? 800 : 600, fontSize: '14px', color: '#0F172A' }}>
                      Kongila Admin
                    </div>
                    {lastMessage && (
                      <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                        {new Date(lastMessage.timestamp).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', color: unreadCount > 0 ? '#334155' : '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: unreadCount > 0 ? 600 : 400 }}>
                      {lastMessage ? (lastMessage.content || (lastMessage.attachmentName ? '📎 Attachment' : '')) : 'New Conversation'}
                    </div>
                    {unreadCount > 0 && (
                      <div style={{ background: '#EF4444', color: '#FFFFFF', fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '99px', minWidth: '18px', textAlign: 'center' }}>
                        {unreadCount}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Area: Thread View */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}>
        {activeConversation ? (
          <>
            {/* Header / Context Banner */}
            <div style={{ padding: '20px', borderBottom: '1px solid #E2E8F0' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px 0', color: '#0F172A' }}>Kongila Admin</h3>
              <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>Replies typically within 1-2 hours</p>
              
              {/* REQ-KT-1101: Context-Linked Conversations */}
              {activeConversation.contextType && (
                <div style={{ marginTop: '12px', background: '#F1F5F9', border: '1px solid #E2E8F0', padding: '10px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>🔗</span>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Linked Context</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                      {activeConversation.contextType === 'vetting' && 'Vetting — Action Required'}
                      {activeConversation.contextType === 'request' && 'Service Request Clarification'}
                      {activeConversation.contextType === 'contract' && 'Contract Discussion'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Messages Flow */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {activeMessages.map(msg => {
                const isMine = msg.senderId === currentUser?.id;
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                    <div style={{ 
                      maxWidth: '70%', 
                      background: isMine ? '#2563EB' : '#F1F5F9', 
                      color: isMine ? '#FFFFFF' : '#0F172A',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      borderBottomRightRadius: isMine ? '4px' : '12px',
                      borderBottomLeftRadius: isMine ? '12px' : '4px',
                      fontSize: '14px',
                      lineHeight: 1.5
                    }}>
                      {msg.content && <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>}
                      
                      {msg.attachmentUrl && (
                        <a 
                          href={msg.attachmentUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            marginTop: msg.content ? '10px' : '0',
                            padding: '8px 12px', 
                            background: isMine ? 'rgba(255,255,255,0.1)' : '#FFFFFF', 
                            borderRadius: '6px', 
                            textDecoration: 'none',
                            color: 'inherit',
                            border: isMine ? '1px solid rgba(255,255,255,0.2)' : '1px solid #E2E8F0'
                          }}
                        >
                          <span>📎</span>
                          <span style={{ fontSize: '13px', fontWeight: 500, textDecoration: 'underline' }}>{msg.attachmentName || 'Attachment'}</span>
                        </a>
                      )}
                    </div>
                    
                    {/* Meta info below bubble */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', fontSize: '11px', color: '#94A3B8' }}>
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {isMine && msg.isRead && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#3B82F6', fontWeight: 600 }}>
                          ✓✓ Seen
                        </span>
                      )}
                      {isMine && !msg.isRead && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          ✓ Delivered
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            <div style={{ padding: '20px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              {attachment && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#E2E8F0', padding: '6px 12px', borderRadius: '6px', marginBottom: '12px', fontSize: '13px', color: '#334155' }}>
                  <span>📎 {attachment.name}</span>
                  <button onClick={() => setAttachment(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontWeight: 700 }}>✕</button>
                </div>
              )}
              
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <textarea
                    value={composerText}
                    onChange={(e) => setComposerText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    style={{
                      width: '100%',
                      padding: '12px 40px 12px 16px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      resize: 'none',
                      minHeight: '44px',
                      maxHeight: '120px',
                      fontFamily: 'inherit',
                      fontSize: '14px',
                      lineHeight: 1.5
                    }}
                    rows={Math.min(4, composerText.split('\n').length || 1)}
                  />
                  <div style={{ position: 'absolute', right: '8px', bottom: '8px' }}>
                    <label style={{ cursor: 'pointer', padding: '4px', display: 'block' }}>
                      <input 
                        type="file" 
                        style={{ display: 'none' }} 
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setAttachment(e.target.files[0]);
                          }
                        }}
                      />
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                      </svg>
                    </label>
                  </div>
                </div>
                <Button 
                  onClick={handleSendMessage}
                  disabled={isUploading || (!composerText.trim() && !attachment)}
                  style={{
                    background: (composerText.trim() || attachment) ? '#0F172A' : '#CBD5E1',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0 20px',
                    height: '46px',
                    fontWeight: 600,
                    cursor: (composerText.trim() || attachment) && !isUploading ? 'pointer' : 'not-allowed'
                  }}
                >
                  {isUploading ? 'Sending...' : 'Send'}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', flexDirection: 'column', gap: '16px' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p style={{ margin: 0, fontSize: '15px' }}>Select a conversation to view thread</p>
          </div>
        )}
      </div>
    </div>
  );
}
