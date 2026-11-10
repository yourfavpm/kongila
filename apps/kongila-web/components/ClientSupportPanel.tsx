import React, { useState } from 'react';
import { GlassCard as Card, NeonButton as Button } from '@kongila/ui';
import { SupportTicket, Contract, ClientProfile } from '@kongila/shared-types';
import { apiFetch } from '../lib/apiFetch';

interface ClientSupportPanelProps {
  currentUser: any;
  clientProfile: ClientProfile;
  contracts: Contract[];
  supportTickets: SupportTicket[];
  talents: any[];
  setSupportTickets: (val: any) => void;
}

export default function ClientSupportPanel({
  currentUser,
  clientProfile,
  contracts,
  supportTickets,
  talents,
  setSupportTickets
}: ClientSupportPanelProps) {
  const [activeTab, setActiveTab] = useState<'open' | 'resolved' | 'faq'>('open');
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [newTicket, setNewTicket] = useState({
    subject: '',
    category: 'Contract Question' as SupportTicket['category'],
    description: '',
    linkedContractId: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const myTickets = supportTickets.filter(t => t.clientId === currentUser?.id);
  // A ticket with no status used to take the whole panel down here.
  const statusOf = (t: any) => String(t?.status || '').toLowerCase();
  const openTickets = myTickets.filter(t => ['open', 'in_progress', 'awaiting_client_response'].includes(statusOf(t)));
  const resolvedTickets = myTickets.filter(t => ['resolved', 'closed'].includes(statusOf(t)));

  /**
   * Raises a ticket.
   *
   * This had no try/catch and no in-flight state. When the request threw
   * rather than returning a response, which is what a dropped connection or a
   * route that failed to compile looks like from here, the promise rejected
   * into nothing: the button did not change, the modal stayed open and no
   * message appeared. Pressing Submit did nothing visible at all. A failure
   * now shows in the modal, the button says what it is doing, and the reason
   * is logged for whoever is reading the console.
   */
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitError('');
    if (!newTicket.subject.trim() || !newTicket.description.trim()) {
      setSubmitError('A subject and a description are both needed.');
      return;
    }

    setSubmitting(true);
    try {
      // Through the server. A browser insert set its own client_id, worked out
      // its own priority, and assigned the ticket to a hardcoded placeholder
      // id ('account-manager-uuid-001') that is not a user. Nothing told
      // operations a ticket had arrived.
      const response = await apiFetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: newTicket.subject,
          category: newTicket.category,
          description: newTicket.description,
          linkedContractId: newTicket.linkedContractId || null
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSubmitError(payload?.error || `The ticket could not be created (${response.status}).`);
        return;
      }

      // The route returns the ticket already mapped, so no snake_case here.
      if (payload.ticket) {
        setSupportTickets((prev: any[]) => [payload.ticket as SupportTicket, ...prev]);
      }

      setShowNewTicketModal(false);
      setNewTicket({ subject: '', category: 'Contract Question', description: '', linkedContractId: '' });
    } catch (err: any) {
      console.error('[support] ticket submit failed', err);
      setSubmitError(err?.message || 'We could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', margin: '0 0 4px 0' }}>Support & Help Center</h2>
          <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>Raise issues, ask questions, or view our knowledge base.</p>
        </div>
        <Button onClick={() => { setSubmitError(''); setShowNewTicketModal(true); }} style={{ background: '#0F172A', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
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
            openTickets.map(ticket => (
              <Card key={ticket.id} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: ticket.priority === 'High' ? '4px solid #EF4444' : '4px solid #3B82F6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', margin: '0 0 4px 0' }}>{ticket.subject}</h3>
                    <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>Category: {ticket.category} • Created: {new Date(ticket.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 8px', borderRadius: '4px', background: ticket.priority === 'High' ? '#FEE2E2' : '#EFF6FF', color: ticket.priority === 'High' ? '#991B1B' : '#1E40AF' }}>
                      {ticket.priority} Priority
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 8px', borderRadius: '4px', background: '#F1F5F9', color: '#475569' }}>
                      Status: {ticket.status.toUpperCase().replace('_', ' ')}
                    </span>
                  </div>
                </div>
                {ticket.assignedTo && (
                  <div style={{ fontSize: '13px', color: '#059669', background: '#D1FAE5', padding: '8px', borderRadius: '4px', display: 'inline-block' }}>
                    ✅ Routed to Account Manager (SLA: 4 Business Hours)
                  </div>
                )}
                {ticket.linkedContractId && (
                  <div style={{ fontSize: '12px', color: '#64748B' }}>
                    🔗 Linked Contract ID: {ticket.linkedContractId.slice(0,8)}...
                  </div>
                )}
              </Card>
            ))
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
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 8px 0' }}>How does billing work?</h3>
              <p style={{ fontSize: '14px', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
                Kongila charges a flat 15% platform fee on all standard engagements. Invoices are generated automatically on the 1st of every month.
              </p>
            </Card>
            <Card style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 8px 0' }}>What happens if a talent underperforms?</h3>
              <p style={{ fontSize: '14px', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
                Raise a "Talent Performance Concern" ticket. This will alert your Account Manager directly who will intervene, provide coaching, or immediately initiate our free replacement guarantee process.
              </p>
            </Card>
          </div>
        )}
      </div>

      {/* New Ticket Modal */}
      {showNewTicketModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowNewTicketModal(false); }}>
          <div className="modal-content" style={{ padding: '32px', maxWidth: '500px', width: '100%' }}>
            <h2 style={{ margin: '0 0 24px 0', fontSize: '20px', color: '#0F172A' }}>Create Support Ticket</h2>
            
            <form onSubmit={handleSubmitTicket} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px', display: 'block' }}>Category</label>
                <select 
                  value={newTicket.category} 
                  onChange={(e) => setNewTicket({...newTicket, category: e.target.value as any})}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1' }}
                >
                  <option value="Billing Issue">Billing Issue</option>
                  <option value="Talent Performance Concern">Talent Performance Concern</option>
                  <option value="Contract Question">Contract Question</option>
                  <option value="Technical Bug">Technical Bug</option>
                  <option value="Other">Other</option>
                </select>
                {(newTicket.category === 'Billing Issue' || newTicket.category === 'Talent Performance Concern') && (
                  <p style={{ fontSize: '11px', color: '#D97706', margin: '4px 0 0 0' }}>⚠️ This issue will be prioritized and sent directly to your Account Manager.</p>
                )}
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
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px', display: 'block' }}>Link Contract/Talent (Optional)</label>
                <select 
                  value={newTicket.linkedContractId} 
                  onChange={(e) => setNewTicket({...newTicket, linkedContractId: e.target.value})}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1' }}
                >
                  <option value="">-- None --</option>
                  {contracts.filter(c => c.status === 'active' || c.status === 'completed').map(c => {
                    const t = talents.find(tal => tal.id === c.talentId);
                    return <option key={c.id} value={c.id}>{t?.user?.first_name} {t?.user?.last_name} - {c.role_title}</option>;
                  })}
                </select>
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

              {submitError && (
                <div style={{ padding: '10px 12px', borderRadius: '6px', background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: '13px' }}>
                  {submitError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" disabled={submitting} onClick={() => setShowNewTicketModal(false)} style={{ padding: '10px 16px', background: 'none', border: 'none', color: '#64748B', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 600 }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ padding: '10px 24px', background: submitting ? '#94A3B8' : '#2563EB', color: 'white', border: 'none', borderRadius: '6px', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                  {submitting ? 'Submitting…' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
