import React, { useState, useEffect } from "react";
import { Interview, TalentProfile } from "@kongila/shared-types";
import { supabase } from "../lib/supabaseClient";

interface ScheduleInterviewModalProps {
  currentUser: any;
  request: any;
  talent: TalentProfile;
  interviews: Interview[];
  setInterviews?: (interviews: Interview[]) => void;
  onClose: () => void;
}

export default function ScheduleInterviewModal({
  currentUser,
  request,
  talent,
  interviews,
  setInterviews,
  onClose
}: ScheduleInterviewModalProps) {
  const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [selectedTimezone, setSelectedTimezone] = useState(localTimezone);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  
  // Mock available slots - in reality, these come from admin configuration or Google Calendar integration
  const availableSlots = [
    { date: "2026-07-20", time: "10:00" },
    { date: "2026-07-20", time: "11:30" },
    { date: "2026-07-21", time: "14:00" },
    { date: "2026-07-22", time: "09:00" }
  ];

  // Enforce Max 3 Interviews per Talent-Request pairing
  const existingPairInterviews = interviews.filter(iv => iv.requestId === request.id && iv.talentId === talent.id && iv.status !== "Cancelled");

  const handleConfirm = async () => {
    if (!selectedSlot) return;

    if (existingPairInterviews.length >= 3) {
      alert("You have reached the maximum limit of 3 interview requests for this candidate.");
      return;
    }

    const slot = availableSlots[parseInt(selectedSlot, 10)];
    
    const newInterview: Interview = {
      id: `iv_${Date.now()}`,
      requestId: request.id,
      matchId: `match_${request.id}_${talent.id}`,
      talentId: talent.id,
      talentName: talent.name,
      talentAvatar: talent.avatar || talent.profilePhotoUrl,
      clientName: currentUser?.name || "Client",
      title: `Interview: ${talent.name} for ${request.roleDescription || 'Role'}`,
      date: slot.date,
      time: slot.time, // We would normally convert this to UTC for DB, and display in local, keeping it simple here
      status: "Proposed",
      createdAt: new Date().toISOString()
    };

    try {
      await supabase.from('interviews').insert({
        id: newInterview.id,
        request_id: newInterview.requestId,
        match_id: newInterview.matchId,
        talent_id: newInterview.talentId,
        talent_name: newInterview.talentName,
        talent_avatar: newInterview.talentAvatar,
        client_name: newInterview.clientName,
        title: newInterview.title,
        date: newInterview.date,
        time: newInterview.time,
        status: newInterview.status,
        created_at: newInterview.createdAt
      });

      if (setInterviews) {
        setInterviews([...interviews, newInterview]);
      }
      alert("Interview request sent to talent for confirmation!");
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to schedule interview.");
    }
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "#FFF", borderRadius: "20px", padding: "32px", width: "100%", maxWidth: "500px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}>
        <h3 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 8px 0", color: "#0F172A" }}>Schedule Interview</h3>
        <p style={{ fontSize: "14px", color: "#64748B", margin: "0 0 24px 0" }}>Select an available time slot to interview <strong>{talent.name}</strong>.</p>
        
        {existingPairInterviews.length >= 3 ? (
          <div style={{ padding: "16px", background: "#FEF2F2", color: "#DC2626", borderRadius: "8px", fontSize: "14px", fontWeight: 600, marginBottom: "24px" }}>
            You have already scheduled the maximum of 3 interviews with this candidate for this request.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#475569" }}>Timezone</span>
              <select 
                value={selectedTimezone}
                onChange={e => setSelectedTimezone(e.target.value)}
                style={{ padding: "8px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", outline: "none", cursor: "pointer" }}
              >
                <option value={localTimezone}>{localTimezone} (Local)</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="Europe/London">London (GMT/BST)</option>
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "32px", maxHeight: "200px", overflowY: "auto" }}>
              {availableSlots.map((slot, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedSlot(idx.toString())}
                  style={{
                    padding: "16px",
                    borderRadius: "12px",
                    border: selectedSlot === idx.toString() ? "2px solid #2563EB" : "1px solid #E2E8F0",
                    background: selectedSlot === idx.toString() ? "#EFF6FF" : "#FFF",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s"
                  }}
                >
                  <div style={{ fontSize: "12px", color: "#64748B", fontWeight: 600, marginBottom: "4px" }}>
                    {new Date(slot.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </div>
                  <div style={{ fontSize: "16px", color: selectedSlot === idx.toString() ? "#1D4ED8" : "#0F172A", fontWeight: 800 }}>
                    {slot.time}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: "12px" }}>
          <button 
            onClick={onClose}
            style={{ flex: 1, padding: "12px", border: "1px solid #CBD5E1", background: "transparent", borderRadius: "8px", fontWeight: 600, color: "#475569", cursor: "pointer" }}
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm}
            disabled={!selectedSlot || existingPairInterviews.length >= 3}
            style={{ flex: 1, padding: "12px", border: "none", background: (!selectedSlot || existingPairInterviews.length >= 3) ? "#93C5FD" : "#2563EB", borderRadius: "8px", fontWeight: 700, color: "#FFF", cursor: (!selectedSlot || existingPairInterviews.length >= 3) ? "not-allowed" : "pointer" }}
          >
            Confirm Slot
          </button>
        </div>
      </div>
    </div>
  );
}
