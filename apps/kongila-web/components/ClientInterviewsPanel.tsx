import React, { useEffect, useState } from "react";
import { Interview, TalentProfile } from "@kongila/shared-types";
import { apiFetch } from "../lib/apiFetch";
import { interviewInstant, formatForBothParties, formatInstantInZone, viewerTimeZone } from "@kongila/utils";
import { confirmInApp, promptInApp, InterviewStatusTrail } from '@kongila/ui';
import {
  normalizeInterviewStage,
  isConfirmedInterview,
  isOpenInterview
} from "@kongila/workflows";
import { interviewTrail } from "../lib/interviewTrail";

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
  /**
   * The decision that follows a held interview.
   *
   * There was none. An interview ended and the screen went on showing it as
   * a past event, while the one thing the client was supposed to do next —
   * offer, or say they are not a fit — lived on a different screen behind a
   * button that only appeared once somebody had marked the interview
   * complete. Most never were, so most hires stopped here.
   */
  onMakeOffer?: (interview: Interview) => void;
  onPassCandidate?: (interview: Interview) => void;
  /** Interview ids the client has already decided on, so the prompt clears. */
  decidedInterviewIds?: Set<string>;
}

type TabType = "action" | "upcoming" | "inflight" | "past";

export default function ClientInterviewsPanel({
  currentUser,
  interviews,
  talents,
  setInterviews,
  onReschedule,
  onMakeOffer,
  onPassCandidate,
  decidedInterviewIds
}: ClientInterviewsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("upcoming");
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [clientRating, setClientRating] = useState<number>(0);
  const [clientFeedback, setClientFeedback] = useState("");
  const [answering, setAnswering] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const now = new Date();

  // Sort interviews so newest is at the top or upcoming is chronologically nearest
  const sortedInterviews = [...interviews].sort((a, b) => {
    const timeA = interviewStartMs(a);
    const timeB = interviewStartMs(b);
    return timeA - timeB; // ascending
  });

  // Grouped by the stage the interview is at, not by matching two status
  // strings. "Scheduled" and "Proposed" were the only two this screen knew,
  // so an interview the candidate had countered, one operations had not
  // picked up yet and one that had been declined all fell through every tab
  // and appeared nowhere at all.
  /**
   * A time the candidate has put to the client, in either of its two shapes.
   *
   * Answering an invitation with a different time moves the interview to
   * `talent_countered`. Asking to move one that is already confirmed does
   * not: the booking stays live and the row keeps its confirmed status until
   * the client agrees, which is right — nobody's calendar should change on a
   * request alone. The cost is that the second kind matched nothing here, so
   * a client was emailed about a move and then found nothing on the screen
   * waiting for them. Both are the same question, so both are caught.
   */
  const awaitingClientAnswer = (iv: any) => {
    if (normalizeInterviewStage(iv.status as string) === 'talent_countered') return true;
    return Boolean(
      iv?.rescheduleRequested
      && String(iv?.rescheduleRequestedBy || '') === 'talent'
      && (iv?.proposedTime || iv?.proposedNewDate)
    );
  };

  const needsAnswer = sortedInterviews.filter(awaitingClientAnswer);

  /** Held, and the client has not said what they want to do about it yet. */
  const awaitingDecision = (iv: any) =>
    normalizeInterviewStage(iv.status as string) === 'completed'
    && Boolean(onMakeOffer)
    && !(decidedInterviewIds?.has(String(iv.id)));

  const decisionsDue = sortedInterviews.filter(awaitingDecision);

  useEffect(() => {
    // Bring a newly arrived talent proposal into view instead of leaving the
    // client on the upcoming list while their response is waiting elsewhere.
    if (needsAnswer.length > 0 && activeTab === 'upcoming') setActiveTab('action');
  }, [needsAnswer.length, activeTab]);

  // A confirmed interview with a move pending is still on, at its current
  // time, so it stays in Upcoming as well as in Needs your answer. That is
  // the honest reading: until the client accepts, that is when it happens.
  const upcomingInterviews = sortedInterviews.filter(iv =>
    isConfirmedInterview(iv.status as string) && interviewStartMs(iv) >= now.getTime()
  );

  const inflightInterviews = sortedInterviews.filter(iv =>
    isOpenInterview(iv.status as string) && !awaitingClientAnswer(iv)
  );

  const pastInterviews = sortedInterviews.filter(iv => {
    const stage = normalizeInterviewStage(iv.status as string);
    return ['completed', 'cancelled', 'talent_declined', 'admin_declined', 'expired'].includes(stage)
      || (isConfirmedInterview(iv.status as string) && interviewStartMs(iv) < now.getTime());
  }).reverse(); // descending for past

  /**
   * The client answers a time the candidate proposed instead.
   *
   * This did not exist. A candidate who could not make the slot raised a
   * reschedule that only operations could answer, so the client whose
   * interview it was had no say in the time they were moved to. Accepting
   * confirms it outright; declining hands it back to operations.
   */
  const answerCounter = async (iv: Interview, accept: boolean) => {
    if (answering) return;
    let reason: string | null = '';
    if (!accept) {
      reason = await promptInApp(
        'What should we tell them? Your Kongila team will find another time.',
        { title: 'That time does not work', placeholder: 'Reason (optional)' }
      );
      if (reason === null) return;
    }

    setAnswering(String(iv.id));
    try {
      const response = await apiFetch('/api/interviews/counter-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId: iv.id, accept, reason })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `Could not save your answer (${response.status}).`);

      if (setInterviews && payload.interview) {
        setInterviews(interviews.map(existing =>
          String(existing.id) === String(iv.id)
            ? {
                ...existing,
                status: payload.interview.status,
                scheduledTime: payload.interview.scheduled_time,
                scheduledTimezone: payload.interview.scheduled_timezone,
                date: payload.interview.date,
                time: payload.interview.time,
                rescheduledFrom: payload.interview.rescheduled_from,
                rescheduleRequested: false,
                rescheduleRequestedBy: null,
                rescheduleReason: undefined,
                proposedTime: undefined,
                proposedTimezone: undefined,
                proposedNewDate: undefined,
                proposedNewTime: undefined
              } as Interview
            : existing
        ));
      }
      setFeedback(accept
        ? 'The new interview time is confirmed for both sides.'
        : 'The proposed time was declined. Kongila has been notified to coordinate next steps.');
    } catch (err: any) {
      console.error('[ClientInterviewsPanel] counter answer failed:', err);
      setFeedback(err?.message || 'Could not save your answer.');
    } finally {
      setAnswering(null);
    }
  };

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
      setFeedback('The interview was cancelled and the participants were notified.');
    } catch (err: any) {
      console.error('[ClientInterviewsPanel] cancel failed:', err);
      setFeedback("Failed to cancel interview: " + (err?.message || 'unknown error'));
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
      setFeedback('Your request has been sent to the Kongila team.');
    } catch (err: any) {
      console.error('[ClientInterviewsPanel] reschedule failed:', err);
      setFeedback(err?.message || 'Could not request a reschedule.');
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
      {/* The decision that follows a held interview, put in front of the
          client rather than left on another screen behind a button that
          only appeared if somebody had remembered to mark the interview
          complete. */}
      {decisionsDue.length > 0 && (
        <div style={{ display: 'grid', gap: '12px' }}>
          {decisionsDue.map(iv => (
            <div
              key={`decision-${iv.id}`}
              style={{
                padding: '18px 20px', borderRadius: '14px', background: '#F0F9FF',
                border: '1px solid #BAE6FD', display: 'flex', gap: '16px',
                alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between'
              }}
            >
              <div style={{ minWidth: '260px', flex: 1 }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#0369A1', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Your decision
                </div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
                  You interviewed {iv.talentName || 'this candidate'}. What would you like to do?
                </div>
                <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px', lineHeight: 1.55 }}>
                  Make them an offer and your Kongila team will review the terms before the
                  candidate sees them. Or tell us they are not a fit and we will keep looking.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => onMakeOffer?.(iv)}
                  style={{ padding: '11px 18px', borderRadius: '10px', border: 'none', background: '#13866F', color: '#FFFFFF', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}
                >
                  Make an offer
                </button>
                <button
                  onClick={() => onPassCandidate?.(iv)}
                  style={{ padding: '11px 18px', borderRadius: '10px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Not a fit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {feedback && (
        <div role="status" aria-live="polite" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '12px 16px', border: '1px solid #D5E5F5', borderRadius: '10px', background: '#F0F7FF', color: '#17365D', fontSize: '13px' }}>
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)} aria-label="Dismiss notification" style={{ border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: '18px' }}>×</button>
        </div>
      )}
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#0F172A", margin: "0 0 8px 0" }}>Interviews</h1>
        <p style={{ color: "#64748B", margin: 0, fontSize: "15px" }}>Manage your upcoming interviews and review past conversations.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "32px", borderBottom: "1px solid #E2E8F0" }}>
        {[
          // First, and only when there is something there, because a tab
          // labelled "Needs you (0)" is a tab people learn to ignore.
          ...(needsAnswer.length > 0
            ? [{ id: "action", label: `Needs your answer (${needsAnswer.length})` }]
            : []),
          { id: "upcoming", label: `Upcoming (${upcomingInterviews.length})` },
          { id: "inflight", label: `Being arranged (${inflightInterviews.length})` },
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
              color: activeTab === tab.id
                ? (tab.id === "action" ? "#B45309" : "#2563EB")
                : (tab.id === "action" ? "#B45309" : "#64748B"),
              borderBottom: activeTab === tab.id
                ? `3px solid ${tab.id === "action" ? "#B45309" : "#2563EB"}`
                : "3px solid transparent",
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
            {...(awaitingClientAnswer(iv) ? {
              onAcceptCounter: () => answerCounter(iv, true),
              onDeclineCounter: () => answerCounter(iv, false),
              busy: answering === String(iv.id)
            } : {})}
          />
        ))}

        {activeTab === "action" && needsAnswer.map(iv => (
          <InterviewCard
            key={iv.id}
            interview={iv}
            talents={talents}
            now={now}
            isPending={true}
            onCancel={() => handleCancel(iv)}
            onAcceptCounter={() => answerCounter(iv, true)}
            onDeclineCounter={() => answerCounter(iv, false)}
            busy={answering === String(iv.id)}
          />
        ))}

        {activeTab === "inflight" && inflightInterviews.length === 0 && (
           <EmptyState message="Nothing is being arranged right now." />
        )}
        {activeTab === "inflight" && inflightInterviews.map(iv => (
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
  interview, talents, now, isPending, isPast, onCancel, onReschedule, onRate,
  onAcceptCounter, onDeclineCounter, busy
}: { 
  interview: Interview, talents: TalentProfile[], now: Date, isPending?: boolean, isPast?: boolean, 
  onCancel?: () => void, onReschedule?: () => void, onRate?: () => void,
  onAcceptCounter?: () => void, onDeclineCounter?: () => void, busy?: boolean
}) {
  const talent = talents.find(t => t.id === interview.talentId);
  // The instant, not `new Date(date + 'T' + time)`, which parses a naive
  // string in whatever zone the browser happens to be in.
  const startMs = interviewStartMs(interview);

  const trail = interviewTrail(interview.status, 'client');
  const proposed = (interview as any).proposedTime || (interview as any).proposed_time;
  const proposedZone = (interview as any).clientTimezone
    || (interview as any).client_timezone
    || viewerTimeZone();
  const proposedSlots: string[] = Array.isArray((interview as any).proposedSlots)
    ? (interview as any).proposedSlots
    : [];
  // Whether there is already an agreed time behind this. A candidate
  // answering an invitation and a candidate asking to move a booking both
  // arrive here, and they are not the same question to the person answering
  // them: one is "does this suit you", the other is "may we move what we
  // already agreed". A move keeps the interview confirmed until the client
  // says yes, which is what tells the two apart.
  const wasConfirmed = isConfirmedInterview(interview.status as string)
    && Boolean((interview as any).rescheduleRequested);
  const currentIso = interviewInstant(interview);
  const currentWhen = currentIso ? formatInstantInZone(currentIso, proposedZone) : null;

  // Can be rated if the time has passed and both sides had agreed it.
  const canRate = !isPast && !isPending && startMs < now.getTime()
    && isConfirmedInterview(interview.status as string);

  return (
    <div style={{ background: "#FFF", borderRadius: "16px", border: trail.tone === 'active' && trail.waitingOn === 'Your move' ? "1px solid #FCD34D" : "1px solid #E2E8F0", padding: "24px", display: "flex", flexDirection: "column", gap: "18px", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px", flexWrap: "wrap" }}>
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

        {!isPast && !canRate && !onAcceptCounter && (
          <div style={{ display: "flex", gap: "8px" }}>
            {onReschedule && (
              <button onClick={onReschedule} style={{ padding: "8px 16px", background: "#F1F5F9", color: "#475569", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Reschedule</button>
            )}
            <button onClick={onCancel} style={{ padding: "8px 16px", background: "#FEF2F2", color: "#DC2626", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          </div>
        )}
      </div>
      </div>

      {/* Where the request has got to, and whose move it is. This screen used
          to print a raw status string — "Proposed", "talent_accepted" — which
          told the client nothing about whether anybody was waiting on them. */}
      <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: "16px" }}>
        <InterviewStatusTrail steps={trail.steps} detail={trail.detail} waitingOn={trail.waitingOn} compact />
      </div>

      {/* The times the client asked for, while it is still being arranged.
          They proposed up to three and then had nothing to look at but a
          status word, so there was no way to check what they had actually
          sent — or to see that their first choice was the one in play. */}
      {!isPast && proposedSlots.length > 1 && !isConfirmedInterview(interview.status as string) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "7px", alignItems: "center" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            You offered
          </span>
          {proposedSlots.map((slot: string, index: number) => (
            <span
              key={slot}
              style={{
                padding: "4px 9px", borderRadius: "999px", fontSize: "11.5px", fontWeight: 700,
                background: index === 0 ? "#EFF6FF" : "#F1F5F9",
                color: index === 0 ? "#1D4ED8" : "#475569"
              }}
            >
              {formatInstantInZone(slot, proposedZone)}{index === 0 ? " · first choice" : ""}
            </span>
          ))}
        </div>
      )}

      {/* The candidate's proposed time is shown to the client for a decision. */}
      {onAcceptCounter && proposed && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "12px", padding: "16px" }}>
          <div style={{ fontSize: "12px", fontWeight: 800, color: "#92400E", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {wasConfirmed
              ? `${interview.talentName || 'The candidate'} has asked to move this interview`
              : `${interview.talentName || 'The candidate'} requested a new time`}
          </div>

          {/* Both times, side by side. Answering "is this new time all right"
              means seeing what it replaces, and the row still holds the
              agreed one until the client decides. */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", margin: "10px 0 2px" }}>
            {currentWhen && (
              <div>
                <div style={{ fontSize: "10.5px", fontWeight: 800, color: "#A16207", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {wasConfirmed ? 'Currently' : 'Was proposed'}
                </div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#78350F", textDecoration: "line-through" }}>
                  {currentWhen}
                </div>
              </div>
            )}
            <div aria-hidden style={{ fontSize: "18px", color: "#A16207", fontWeight: 800 }}>→</div>
            <div>
              <div style={{ fontSize: "10.5px", fontWeight: 800, color: "#A16207", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                They propose
              </div>
              <div style={{ fontSize: "17px", fontWeight: 800, color: "#0F172A" }}>
                {formatInstantInZone(proposed, proposedZone)}
              </div>
            </div>
          </div>
          {(interview as any).rescheduleReason && (
            <div style={{ fontSize: "13px", color: "#78350F", marginTop: "6px", lineHeight: 1.55 }}>
              “{(interview as any).rescheduleReason}”
            </div>
          )}
          <div style={{ display: "flex", gap: "10px", marginTop: "14px", flexWrap: "wrap" }}>
            <button
              onClick={onAcceptCounter}
              disabled={busy}
              style={{ padding: "10px 18px", background: busy ? "#A7C4F0" : "#13866F", color: "#FFF", border: "none", borderRadius: "9px", fontSize: "13px", fontWeight: 800, cursor: busy ? "not-allowed" : "pointer" }}
            >
              {busy ? 'Saving…' : 'Accept this time'}
            </button>
            <button
              onClick={onDeclineCounter}
              disabled={busy}
              style={{ padding: "10px 18px", background: "#FFFFFF", color: "#92400E", border: "1px solid #FDE68A", borderRadius: "9px", fontSize: "13px", fontWeight: 700, cursor: busy ? "not-allowed" : "pointer" }}
            >
              Does not work for me
            </button>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: "12px", color: "#92400E", lineHeight: 1.5 }}>
            Accepting confirms the proposed time for both of you. If you decline, Kongila will
            coordinate another option; any already-confirmed time stays in place until changed.
          </p>
        </div>
      )}
    </div>
  );
}
