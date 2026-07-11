import React, { useState } from "react";
import { Interview, TalentProfile } from "@kongila/shared-types";
import { supabase } from "../lib/supabaseClient";

interface ClientInterviewsPanelProps {
  currentUser: any;
  interviews: Interview[];
  talents: TalentProfile[];
  setInterviews?: (interviews: Interview[]) => void;
  saveToDb?: (db: any) => Promise<void>;
  onReschedule?: (interview: Interview) => void;
}

type TabType = "upcoming" | "pending" | "past";

export default function ClientInterviewsPanel({
  currentUser,
  interviews,
  talents,
  setInterviews,
  saveToDb,
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
    const timeA = new Date(`${a.date}T${a.time}`).getTime();
    const timeB = new Date(`${b.date}T${b.time}`).getTime();
    return timeA - timeB; // ascending
  });

  const upcomingInterviews = sortedInterviews.filter(iv => 
    (iv.status === "Scheduled" || iv.status === "Rescheduled") && 
    (new Date(`${iv.date}T${iv.time}`) >= now)
  );

  const pastInterviews = sortedInterviews.filter(iv => 
    iv.status === "Completed" || iv.status === "Cancelled" || (new Date(`${iv.date}T${iv.time}`) < now && iv.clientRating)
  ).reverse(); // descending for past

  const pendingInterviews = sortedInterviews.filter(iv => 
    iv.status === "Proposed"
  );

  const handleCancel = async (iv: Interview) => {
    if (!confirm("Are you sure you want to cancel this interview?")) return;
    
    try {
      await supabase.from('interviews').update({ status: 'Cancelled' }).eq('id', iv.id);
      
      if (setInterviews) {
        setInterviews(interviews.map(i => i.id === iv.id ? { ...i, status: 'Cancelled' } : i));
      }
    } catch (err) {
      console.error(err);
      alert("Failed to cancel interview.");
    }
  };

  const handleReschedule = (iv: Interview) => {
    const ivTime = new Date(`${iv.date}T${iv.time}`).getTime();
    const hoursDifference = (ivTime - now.getTime()) / (1000 * 60 * 60);

    if (hoursDifference < 4) {
      alert("Late Reschedule Request: Interviews cannot be rescheduled by the client less than 4 hours before the start time. Your Account Manager has been notified and will reach out to coordinate.");
      // Optional: trigger saveToDb notification to AM
      if (saveToDb) {
        saveToDb({
          notifications: [{
            id: `notif_${Date.now()}`,
            userId: "admin_team",
            type: "alert",
            message: `Late Reschedule Request: ${currentUser?.name} attempted to reschedule interview with ${iv.talentName} (less than 4 hours notice).`,
            read: false,
            createdAt: new Date().toISOString()
          }]
        });
      }
      return;
    }
    
    if (onReschedule) {
      onReschedule(iv);
    } else {
      alert("Reschedule flow triggered. Please select a new time slot.");
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

      await supabase.from('interviews').update({
        status: 'Completed',
        client_rating: clientRating,
        client_feedback: clientFeedback
      }).eq('id', selectedInterview.id);

      if (setInterviews) {
        setInterviews(interviews.map(i => i.id === selectedInterview.id ? { ...i, ...updates } : i));
      }
      
      if (saveToDb) {
        await saveToDb({
          notifications: [{
            id: `notif_${Date.now()}`,
            userId: "admin_team",
            type: "info",
            message: `Client ${currentUser?.name} submitted a ${clientRating}-star rating for interview with ${selectedInterview.talentName}.`,
            read: false,
            createdAt: new Date().toISOString()
          }]
        });
      }

    } catch (err) {
      console.error(err);
      alert("Failed to submit rating.");
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
            <span>📅 {new Date(interview.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            <span>⏰ {interview.time} (Local Time)</span>
          </div>
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
