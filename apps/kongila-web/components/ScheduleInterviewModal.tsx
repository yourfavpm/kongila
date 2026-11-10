import React, { useState, useEffect } from "react";
import { Interview, TalentProfile } from "@kongila/shared-types";
import { apiFetch } from "../lib/apiFetch";
import {
  viewerTimeZone,
  timeZoneOptions,
  generateSlots,
  formatInstantInZone,
  formatForBothParties
} from "@kongila/utils";

interface ScheduleInterviewModalProps {
  currentUser: any;
  request: any;
  talent: TalentProfile;
  matchId?: string;
  interviews: Interview[];
  setInterviews?: (interviews: Interview[]) => void;
  onClose: () => void;
}

export default function ScheduleInterviewModal({
  currentUser,
  request,
  talent,
  matchId,
  interviews,
  setInterviews,
  onClose
}: ScheduleInterviewModalProps) {
  const localTimezone = viewerTimeZone();
  const [selectedTimezone, setSelectedTimezone] = useState(localTimezone);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // The candidate's own zone, so the client can see what time the call lands
  // on at the other end before they pick a slot.
  const talentTimezone = (talent as any)?.timezone || (talent as any)?.timeZone || null;

  // Generated from today in the zone the client is working in. These were
  // four slots hardcoded to 20-22 July 2026, so the client's main route to an
  // interview offered only dates that are already in the past.
  const availableSlots = React.useMemo(
    () => generateSlots(selectedTimezone),
    [selectedTimezone]
  );

  // Enforce Max 3 Interviews per Talent-Request pairing
  const existingPairInterviews = interviews.filter(iv => iv.requestId === request.id && iv.talentId === talent.id && iv.status !== "Cancelled");

  const handleConfirm = async () => {
    if (!selectedSlot || submitting) return;

    if (existingPairInterviews.length >= 3) {
      alert("You have reached the maximum limit of 3 interview requests for this candidate.");
      return;
    }

    const slot = availableSlots[parseInt(selectedSlot, 10)];
    if (!slot) return;

    setSubmitting(true);

    // Through the server, not straight into the table. A browser insert
    // could not check whether either party was already booked, could not
    // email the candidate, and wrote nothing to the audit log. The route
    // does all three and refuses a clash with a 409.
    try {
      const response = await apiFetch('/api/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: request.id,
          matchId: matchId || `match_${request.id}_${talent.id}`,
          talentId: talent.id,
          talentName: talent.name,
          talentAvatar: (talent as any).avatar || (talent as any).profilePhotoUrl,
          clientName: currentUser?.name || 'Client',
          title: `Interview: ${talent.name} for ${request.roleDescription || 'Role'}`,
          scheduledTime: slot.iso,
          timezone: selectedTimezone,
          clientTimezone: selectedTimezone,
          talentTimezone: talentTimezone,
          date: slot.date,
          time: slot.time
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `Could not request the interview (${response.status}).`);

      const newInterview = payload.interview;

      if (setInterviews) {
        setInterviews([...interviews, newInterview]);
      }
      alert(
        `Interview request sent to ${talent.name} for confirmation.\n\n` +
        `${formatInstantInZone(slot.iso, selectedTimezone)} (your time)` +
        (talentTimezone ? `\n${formatInstantInZone(slot.iso, talentTimezone)} (their time)` : '')
      );
      onClose();
    } catch (err: any) {
      console.error('[ScheduleInterviewModal] interview not created:', err);
      alert("Failed to schedule interview: " + (err?.message || 'unknown error'));
    } finally {
      setSubmitting(false);
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
                {timeZoneOptions(localTimezone).map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>

            {!talentTimezone && (
              <div style={{ padding: "10px 12px", background: "#FFFBEB", border: "1px solid #FDE68A", color: "#92400E", borderRadius: "8px", fontSize: "12px", marginBottom: "12px" }}>
                {talent.name} has not set a timezone, so we cannot show you their local time for these slots.
              </div>
            )}

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
                  <div style={{ fontSize: "16px", color: selectedSlot === idx.toString() ? "#1D4ED8" : "#0F172A", fontWeight: 800 }}>
                    {formatInstantInZone(slot.iso, selectedTimezone)}
                  </div>
                  {(() => {
                    const both = formatForBothParties(slot.iso, selectedTimezone, talentTimezone, `${talent.name}'s time`);
                    return both.other ? (
                      <div style={{ fontSize: "12px", color: "#64748B", fontWeight: 600, marginTop: "4px" }}>
                        {both.other}
                      </div>
                    ) : null;
                  })()}
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
            disabled={!selectedSlot || submitting || existingPairInterviews.length >= 3}
            style={{ flex: 1, padding: "12px", border: "none", background: (!selectedSlot || submitting || existingPairInterviews.length >= 3) ? "#93C5FD" : "#2563EB", borderRadius: "8px", fontWeight: 700, color: "#FFF", cursor: (!selectedSlot || submitting || existingPairInterviews.length >= 3) ? "not-allowed" : "pointer" }}
          >
            {submitting ? 'Sending...' : 'Confirm Slot'}
          </button>
        </div>
      </div>
    </div>
  );
}
