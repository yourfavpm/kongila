import React, { useState } from 'react';
import { GlassCard as Card, NeonButton as Button } from '@kongila/ui';
import { SupportTicket, TalentProfile } from '@kongila/shared-types';
import { supabase } from '../lib/supabaseClient';

interface TalentSupportPanelProps {
  currentUser: any;
  profile: TalentProfile;
  supportTickets: SupportTicket[];
  setSupportTickets: (val: any) => void;
}

export default function TalentSupportPanel({
  currentUser,
  profile,
  supportTickets,
  setSupportTickets
}: TalentSupportPanelProps) {
  const [activeTab, setActiveTab] = useState<'open' | 'resolved' | 'faq'>('open');
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [newTicket, setNewTicket] = useState({
    subject: '',
    category: 'Vetting Question' as SupportTicket['category'],
    description: ''
  });

  const myTickets = supportTickets.filter(t => t.talentId === profile.id);
  const openTickets = myTickets.filter(t => ['open', 'in_progress', 'awaiting_talent_response'].includes(t.status.toLowerCase()));
  const resolvedTickets = myTickets.filter(t => ['resolved', 'closed'].includes(t.status.toLowerCase()));

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();

    if (openTickets.length >= 5) {
      alert("You have reached the maximum of 5 open tickets. Please consolidate your issues or wait for resolution.");
      return;
    }

    // Auto-route and priority logic (REQ-KT-1401 & REQ-KT-1402)
    let priority = 'Low';
    let assignedTo = null; // null means generic support queue
    let routingNote = '';

    switch (newTicket.category) {
      case 'Payment Issue':
        priority = 'High';
        assignedTo = 'finance-admin-id';
        routingNote = 'Routed to Finance Admin (SLA: 4 hrs)';
        break;
      case 'Account Access':
        priority = 'Urgent';
        assignedTo = 'super-admin-id';
        routingNote = 'Routed to Super Admin (SLA: 1 hr)';
        break;
      case 'Vetting Question':
        priority = 'Medium';
        assignedTo = 'talent-manager-id';
        routingNote = 'Routed to Talent Manager (SLA: 24 hrs)';
        break;
      case 'Technical Bug':
        priority = 'Medium';
        assignedTo = 'tech-support-id';
        routingNote = 'Routed to Tech Support (SLA: 24 hrs)';
        break;
      default:
        priority = 'Low';
        routingNote = 'Routed to General Support (SLA: 48 hrs)';
        break;
    }

    const ticketRow = {
      id: crypto.randomUUID(),
      talent_id: profile.id,
      subject: newTicket.subject,
      category: newTicket.category,
      description: newTicket.description,
      status: 'open',
      priority: priority,
      assigned_to: assignedTo,
      created_at: new Date().toISOString(),
      last_activity: new Date().toISOString()
    };

    const { data, error } = await supabase.from('support_tickets').insert([ticketRow]).select();

    if (error) {
      alert("Error creating ticket: " + error.message);
      return;
    }

    if (data && data[0]) {
      const formattedTicket: SupportTicket = {
        id: data[0].id,
        talentId: data[0].talent_id,
        clientId: data[0].client_id,
        linkedContractId: data[0].linked_contract_id,
        assignedTo: data[0].assigned_to,
        subject: data[0].subject,
        category: data[0].category,
        status: data[0].status,
        priority: data[0].priority,
        createdAt: data[0].created_at,
        lastActivity: data[0].last_activity
      };
      setSupportTickets((prev: any[]) => [formattedTicket, ...prev]);
    }

    setShowNewTicketModal(false);
    setNewTicket({ subject: '', category: 'Vetting Question', description: '' });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent': return { bg: '#FEF2F2', text: '#991B1B', border: '#EF4444' };
      case 'High': return { bg: '#FFF7ED', text: '#9A3412', border: '#F97316' };
      case 'Medium': return { bg: '#FEFCE8', text: '#854D0E', border: '#EAB308' };
      default: return { bg: '#F1F5F9', text: '#475569', border: '#94A3B8' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', paddingBottom: '60px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', margin: '0 0 4px 0' }}>Support Center</h2>
          <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>Raise issues, ask questions, and track resolution.</p>
        </div>
        <Button onClick={() => setShowNewTicketModal(true)} style={{ background: '#0F172A', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
          + New Support Ticket
        </Button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
        <button onClick={() => setActiveTab('open')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'open' ? '2px solid #2563EB' : '2px solid transparent', padding: '8px 4px', fontSize: '14px', fontWeight: activeTab === 'open' ? 600 : 500, color: activeTab === 'open' ? '#0F172A' : '#64748B', cursor: 'pointer' }}>
          Open Tickets ({openTickets.length})
        </button>
        <button onClick={() => setActiveTab('resolved')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'resolved' ? '2px solid #2563EB' : '2px solid transparent', padding: '8px 4px', fontSize: '14px', fontWeight: activeTab === 'resolved' ? 600 : 500, color: activeTab === 'resolved' ? '#0F172A' : '#64748B', cursor: 'pointer' }}>
          Resolved History
        </button>
        <button onClick={() => setActiveTab('faq')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'faq' ? '2px solid #2563EB' : '2px solid transparent', padding: '8px 4px', fontSize: '14px', fontWeight: activeTab === 'faq' ? 600 : 500, color: activeTab === 'faq' ? '#0F172A' : '#64748B', cursor: 'pointer' }}>
          FAQ & Knowledge Base
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {activeTab === 'open' && (
          openTickets.length === 0 ? (
            <Card style={{ padding: '40px', textAlign: 'center' }}>
              <p style={{ color: '#64748B', fontSize: '14px' }}>You have no open support tickets.</p>
            </Card>
          ) : (
            openTickets.map(ticket => {
              const colors = getPriorityColor(ticket.priority);
              return (
                <Card key={ticket.id} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: `4px solid ${colors.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', margin: '0 0 4px 0' }}>{ticket.subject}</h3>
                      <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>Category: {ticket.category} • Created: {new Date(ticket.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 8px', borderRadius: '4px', background: colors.bg, color: colors.text }}>
                        {ticket.priority}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 8px', borderRadius: '4px', background: '#F1F5F9', color: '#475569' }}>
                        {ticket.status.toUpperCase().replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                  {ticket.assignedTo && (
                    <div style={{ fontSize: '13px', color: '#059669', background: '#D1FAE5', padding: '8px', borderRadius: '4px', display: 'inline-block' }}>
                      ✅ Ticket Assigned and being worked on.
                    </div>
                  )}
                </Card>
              );
            })
          )
        )}

        {activeTab === 'resolved' && (
           resolvedTickets.length === 0 ? (
            <Card style={{ padding: '40px', textAlign: 'center' }}>
              <p style={{ color: '#64748B', fontSize: '14px' }}>No resolved tickets.</p>
            </Card>
          ) : (
            resolvedTickets.map(ticket => (
              <Card key={ticket.id} style={{ padding: '20px', background: '#F8FAFC' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#475569', margin: '0 0 4px 0', textDecoration: 'line-through' }}>{ticket.subject}</h3>
                    <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>Category: {ticket.category} • Resolved: {new Date(ticket.lastActivity).toLocaleDateString()}</p>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 8px', borderRadius: '4px', background: '#ECFDF5', color: '#065F46' }}>
                    Resolved
                  </span>
                </div>
              </Card>
            ))
          )
        )}

        {activeTab === 'faq' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Card style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 8px 0' }}>How do payouts work?</h3>
              <p style={{ fontSize: '14px', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
                Payouts are processed according to your contract schedule. Usually, this is bi-weekly or monthly. If a payment fails, the system will notify you, and you can raise a 'Payment Issue' ticket which will be prioritized.
              </p>
            </Card>
            <Card style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 8px 0' }}>I am having trouble with a technical assessment.</h3>
              <p style={{ fontSize: '14px', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
                If your environment crashed during a sandbox assessment, please raise a 'Technical Bug' ticket immediately so we can reset your session.
              </p>
            </Card>
            <Card style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 8px 0' }}>I can't log in to my account.</h3>
              <p style={{ fontSize: '14px', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
                Issues categorized as 'Account Access' are escalated directly to the Super Admin for immediate resolution to ensure your data remains secure.
              </p>
            </Card>
          </div>
        )}
      </div>

      {/* New Ticket Modal */}
      {showNewTicketModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={(e) => { if (e.target === e.currentTarget) setShowNewTicketModal(false); }}>
          <div className="modal-content" style={{ background: '#FFF', padding: '32px', maxWidth: '500px', width: '100%', borderRadius: '12px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 24px 0', fontSize: '20px', color: '#0F172A' }}>Create Support Ticket</h2>
            
            <form onSubmit={handleSubmitTicket} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px', display: 'block' }}>Category</label>
                <select 
                  value={newTicket.category} 
                  onChange={(e) => setNewTicket({...newTicket, category: e.target.value as any})}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFF' }}
                >
                  <option value="Account Access">Account Access</option>
                  <option value="Vetting Question">Vetting Question</option>
                  <option value="Payment Issue">Payment Issue</option>
                  <option value="Technical Bug">Technical Bug</option>
                  <option value="Other">Other</option>
                </select>
                {newTicket.category === 'Payment Issue' && <p style={{ fontSize: '11px', color: '#D97706', margin: '4px 0 0 0' }}>⚠️ Sent to Finance Admin (High Priority)</p>}
                {newTicket.category === 'Account Access' && <p style={{ fontSize: '11px', color: '#DC2626', margin: '4px 0 0 0' }}>⚠️ Sent to Super Admin (Urgent Priority)</p>}
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px', display: 'block' }}>Subject</label>
                <input 
                  type="text" 
                  required
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({...newTicket, subject: e.target.value})}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1' }} 
                  placeholder="Brief description of the issue"
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px', display: 'block' }}>Description</label>
                <textarea 
                  required
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({...newTicket, description: e.target.value})}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', minHeight: '100px', resize: 'vertical' }} 
                  placeholder="Provide detailed information..."
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <Button type="submit" style={{ flex: 1, background: '#2563EB', color: 'white', padding: '12px' }}>Submit Ticket</Button>
                <Button type="button" onClick={() => setShowNewTicketModal(false)} style={{ flex: 1, background: '#F8FAFC', color: '#475569', border: '1px solid #CBD5E1', padding: '12px' }}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
