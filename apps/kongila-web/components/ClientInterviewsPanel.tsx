import React, { useState } from "react";
import { Interview, TalentProfile } from "@kongila/shared-types";
import { apiFetch } from "../lib/apiFetch";
import { interviewInstant, formatForBothParties, viewerTimeZone } from "@kongila/utils";
import { confirmInApp, promptInApp } from '@kongila/ui';

/**
 * When an interview actually starts, as a number. Everything here used to do
 * `new Date(`${iv.date}T${iv.time}`)`, which parses a naive string in the
 * browser's own zone with nothing recording which zone it was written in, so
 * sorting and the upcoming/past split were both wrong across zones. An
 * interview with no usable instant sorts last rather than to 1970.
 */
function interviewStartMs(iv: any): number {
  const iso = interviewInstant(iv);
  return iso ? new Date(iso).getTime() : Number.MAX_SAFE_INTEGER;
}

interface ClientInterviewsPanelProps {
  currentUser: any;
  interviews: Interview[];
  talents: TalentProfile[];
  setInterviews?: (interviews: Interview[]) => void;
  onReschedule?: (interview: Interview) => void;
}

type TabType = "upcoming" | "pending" | "past";

export default function ClientInterviewsPanel({
  currentUser,
  interviews,
  talents,
  setInterviews,
  onReschedule
}: ClientInterviewsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("upcoming");
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [clientRating, setClientRating] = useState<number>(0);
  const [clientFeedback, setClientFeedback] = useState("");

  const now = new Date();

  // Sort interviews so newest is at the top or upcoming is chronologically nearest
  const sortedInterviews = [...interviews].sort((a, b) => {
    const timeA = interviewStartMs(a);
    const timeB = interviewStartMs(b);
    return timeA - timeB; // ascending
  });

  const upcomingInterviews = sortedInterviews.filter(iv => 
    (iv.status === "Scheduled" || iv.status === "Rescheduled") && 
    (interviewStartMs(iv) >= now.getTime())
  );

  const pastInterviews = sortedInterviews.filter(iv => 
    iv.status === "Completed" || iv.status === "Cancelled" || (interviewStartMs(iv) < now.getTime() && iv.clientRating)
  ).reverse(); // descending for past

  const pendingInterviews = sortedInterviews.filter(iv => 
    iv.status === "Proposed"
  );

  const handleCancel = async (iv: Interview) => {
    if (!await confirmInApp('Are you sure you want to cancel this interview?', 'Cancel interview')) return;

    // Through the server. A browser update cancelled the row and told
    // nobody: the candidate kept the slot in their calendar and found out
    // when they joined a call that was not happening.
    try {
      const response = await apiFetch('/api/interviews/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId: iv.id })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `Could not cancel (${response.status}).`);

      if (setInterviews) {
        setInterviews(interviews.map(i => i.id === iv.id ? { ...i, status: 'Cancelled' } : i));
      }
    } catch (err: any) {
      console.error('[ClientInterviewsPanel] cancel failed:', err);
      alert("Failed to cancel interview: " + (err?.message || 'unknown error'));
    }
  };

  const handleReschedule = async (iv: Interview) => {
    // The four-hour rule is enforced on the server now, not just here, and
    // the "account manager has been notified" claim is true: the old code
    // addressed a user_id of 'admin_team', which is not a user, so the
    // foreign key rejected it and nobody was ever told.
    if (onReschedule) {
      onReschedule(iv);
      return;
    }

    const reason = await promptInApp('Why do you need to move this interview?', { title: 'Request a new interview time', placeholder: 'Reason (optional)' });
    if (reason === null) return;

    try {
      const response = await apiFetch('/api/interviews/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId: iv.id, reason })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `Could not request a reschedule (${response.status}).`);

      if (setInterviews) {
        setInterviews(interviews.map(i =>
          i.id === iv.id ? { ...i, status: 'Reschedule Requested', rescheduleRequested: true } : i
        ));
      }
      alert('Your request has been sent. Operations will confirm a new time.');
    } catch (err: any) {
      console.error('[ClientInterviewsPanel] reschedule failed:', err);
      alert(err?.message || 'Could not request a reschedule.');
    }
  };

  const openRatingModal = (iv: Interview) => {
    setSelectedInterview(iv);
    setClientRating(iv.clientRating || 0);
    setClientFeedback(iv.clientFeedback || "");
    setRatingModalOpen(true);
  };

  const submitRating = async () => {
    if (!selectedInterview) return;

    try {
      const updates = {
        status: 'Completed' as const,
        clientRating,
        clientFeedback
      };

      const response = await apiFetch('/api/interviews/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId: selectedInterview.id,
          rating: clientRating,
          feedback: clientFeedback
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `Could not save the rating (${response.status}).`);

      if (setInterviews) {
        setInterviews(interviews.map(i => i.id === selectedInterview.id ? { ...i, ...updates } : i));
      }

      // The notification to operations is written by the route's audit
      // entry. The insert here addressed 'admin_team', which is not a user,
      // so the foreign key rejected it every time.
    } catch (err: any) {
      console.error('[ClientInterviewsPanel] rating failed:', err);
      alert("Failed to submit rating: " + (err?.message || 'unknown error'));
    }

    setRatingModalOpen(false);
    setSelectedInterview(null);
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#0F172A", margin: "0 0 8px 0" }}>Interviews</h1>
        <p style={{ color: "#64748B", margin: 0, fontSize: "15px" }}>Manage your upcoming interviews and review past conversations.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "32px", borderBottom: "1px solid #E2E8F0" }}>
        {[
          { id: "upcoming", label: `Upcoming (${upcomingInterviews.length})` },
          { id: "pending", label: `Pending Confirmation (${pendingInterviews.length})` },
          { id: "past", label: `Past (${pastInterviews.length})` }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            style={{
              background: "none",
              border: "none",
              padding: "12px 0",
              fontSize: "14px",
              fontWeight: 700,
              color: activeTab === tab.id ? "#2563EB" : "#64748B",
              borderBottom: activeTab === tab.id ? "3px solid #2563EB" : "3px solid transparent",
              cursor: "pointer"
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {activeTab === "upcoming" && upcomingInterviews.length === 0 && (
           <EmptyState message="You have no upcoming interviews scheduled." />
        )}
        {activeTab === "upcoming" && upcomingInterviews.map(iv => (
          <InterviewCard 
            key={iv.id} 
            interview={iv} 
            talents={talents} 
            now={now}
            onCancel={() => handleCancel(iv)}
            onReschedule={() => handleReschedule(iv)}
            onRate={() => openRatingModal(iv)}
          />
        ))}

        {activeTab === "pending" && pendingInterviews.length === 0 && (
           <EmptyState message="No interviews pending confirmation." />
        )}
        {activeTab === "pending" && pendingInterviews.map(iv => (
          <InterviewCard 
            key={iv.id} 
            interview={iv} 
            talents={talents} 
            now={now}
            isPending={true}
            onCancel={() => handleCancel(iv)}
          />
        ))}

        {activeTab === "past" && pastInterviews.length === 0 && (
           <EmptyState message="You have no past interviews." />
        )}
        {activeTab === "past" && pastInterviews.map(iv => (
          <InterviewCard 
            key={iv.id} 
            interview={iv} 
            talents={talents} 
            now={now}
            isPast={true}
          />
        ))}
      </div>

      {/* Rating Modal */}
      {ratingModalOpen && selectedInterview && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#FFF", borderRadius: "16px", padding: "32px", width: "100%", maxWidth: "400px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}>
            <h3 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 8px 0", color: "#0F172A" }}>Rate Interview</h3>
            <p style={{ fontSize: "14px", color: "#475569", margin: "0 0 24px 0" }}>How was your conversation with <strong>{selectedInterview.talentName}</strong>?</p>
            
            <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: "24px" }}>
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setClientRating(star)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "32px",
                    cursor: "pointer",
                    color: star <= clientRating ? "#F59E0B" : "#E2E8F0",
                    transition: "color 0.2s"
                  }}
                >
                  ★
                </button>
              ))}
            </div>

            <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "8px" }}>Optional Notes (For your AM)</label>
            <textarea 
              value={clientFeedback}
              onChange={e => setClientFeedback(e.target.value)}
              placeholder="What did you like? Any concerns?"
              style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", outline: "none", marginBottom: "24px", minHeight: "80px", resize: "vertical", boxSizing: "border-box" }}
            />

            <div style={{ display: "flex", gap: "12px" }}>
              <button 
                onClick={() => setRatingModalOpen(false)}
                style={{ flex: 1, padding: "12px", border: "1px solid #CBD5E1", background: "transparent", borderRadius: "8px", fontWeight: 600, color: "#475569", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button 
                onClick={submitRating}
                disabled={clientRating === 0}
                style={{ flex: 1, padding: "12px", border: "none", background: clientRating > 0 ? "#2563EB" : "#93C5FD", borderRadius: "8px", fontWeight: 700, color: "#FFF", cursor: clientRating > 0 ? "pointer" : "not-allowed" }}
              >
                Submit Rating
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ textAlign: "center", padding: "64px 20px", background: "#F8FAFC", borderRadius: "16px", border: "1px dashed #CBD5E1" }}>
      <div style={{ fontSize: "40px", marginBottom: "16px", opacity: 0.5 }}>📅</div>
      <p style={{ color: "#64748B", margin: 0, fontWeight: 500 }}>{message}</p>
    </div>
  );
}

/**
 * The client reads their own zone; the candidate's time is shown underneath
 * so nobody has to work out the difference, which is the whole point when
 * one party is in Lagos and the other in New York.
 */
function whenForClient(interview: any) {
  const iso = interviewInstant(interview);
  const clientZone = interview?.clientTimezone || interview?.client_timezone || viewerTimeZone();
  const talentZone = interview?.talentTimezone || interview?.talent_timezone || null;
  return formatForBothParties(iso, clientZone, talentZone, `${interview?.talentName || 'candidate'}'s time`);
}

function InterviewCard({ 
  interview, talents, now, isPending, isPast, onCancel, onReschedule, onRate 
}: { 
  interview: Interview, talents: TalentProfile[], now: Date, isPending?: boolean, isPast?: boolean, 
  onCancel?: () => void, onReschedule?: () => void, onRate?: () => void 
}) {
  const talent = talents.find(t => t.id === interview.talentId);
  const ivTime = new Date(`${interview.date}T${interview.time}`);
  
  // Can be rated if the time has passed and it's not cancelled
  const canRate = !isPast && !isPending && ivTime < now && interview.status !== "Cancelled";

  return (
    <div style={{ background: "#FFF", borderRadius: "16px", border: "1px solid #E2E8F0", padding: "24px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
      <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
        <img 
          src={interview.talentAvatar || talent?.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150"} 
          alt={interview.talentName}
          style={{ width: "64px", height: "64px", borderRadius: "16px", objectFit: "cover" }}
        />
        <div>
          <h3 style={{ margin: "0 0 4px 0", fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>{interview.title || `Interview with ${interview.talentName}`}</h3>
          <div style={{ fontSize: "14px", color: "#64748B", fontWeight: 500, display: "flex", gap: "12px", alignItems: "center" }}>
            {/* Was the raw wall-clock string labelled "(Local Time)" — the
                time the other party entered, presented as this viewer's. */}
            <span>🕒 {whenForClient(interview).viewer}</span>
          </div>
          {whenForClient(interview).other && (
            <div style={{ fontSize: "12px", color: "#94A3B8", fontWeight: 500, marginTop: "2px" }}>
              {whenForClient(interview).other}
            </div>
          )}
          {isPast && interview.clientRating && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
              <span style={{ color: "#F59E0B", letterSpacing: "2px" }}>
                {"★".repeat(interview.clientRating)}{"☆".repeat(5 - interview.clientRating)}
              </span>
              {interview.outcome && (
                <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 700, background: interview.outcome === 'Proceed to Hire' ? '#D1FAE5' : '#F1F5F9', color: interview.outcome === 'Proceed to Hire' ? '#059669' : '#475569' }}>
                  {interview.outcome}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        {!isPast && !isPending && interview.meetingLink && (
          <a 
            href={interview.meetingLink} 
            target="_blank" 
            rel="noreferrer"
            style={{ padding: "10px 16px", background: "#EFF6FF", color: "#2563EB", borderRadius: "8px", textDecoration: "none", fontSize: "13px", fontWeight: 700 }}
          >
            Join Video Call
          </a>
        )}

        {canRate && (
          <button 
            onClick={onRate}
            style={{ padding: "10px 16px", background: "#2563EB", color: "#FFF", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
          >
            Mark Complete & Rate
          </button>
        )}

        {!isPast && !canRate && (
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={onReschedule} style={{ padding: "8px 16px", background: "#F1F5F9", color: "#475569", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Reschedule</button>
            <button onClick={onCancel} style={{ padding: "8px 16px", background: "#FEF2F2", color: "#DC2626", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
