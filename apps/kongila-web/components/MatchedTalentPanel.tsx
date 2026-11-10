import React, { useState, useMemo } from "react";
import { apiFetch } from "../lib/apiFetch";
import { requestTitle } from "@kongila/shared-types";

/**
 * A match is rejected when its status is "rejected". Rows written before the
 * status vocabulary was fixed may still read "rejected_by_client", so both
 * are recognised here. Only "rejected" is ever written.
 */
function isRejectedMatch(status: unknown): boolean {
  const s = String(status || "").toLowerCase();
  return s === "rejected" || s === "rejected_by_client";
}

interface MatchedTalentPanelProps {
  currentUser: any;
  requests: any[];
  matches: any[];
  interviews: any[];
  talents: any[];
  setMatches?: (matches: any[]) => void;
  onRequestUpdated?: (request: any) => void;
  onScheduleMeeting?: (talent: any, request: any, match: any) => void;
  onExtendOffer?: (talent: any, request: any, match: any) => void;
}

export default function MatchedTalentPanel({
  currentUser,
  requests,
  matches,
  interviews,
  talents,
  setMatches,
  onRequestUpdated,
  onScheduleMeeting,
  onExtendOffer,
}: MatchedTalentPanelProps) {
  const [sortOption, setSortOption] = useState<"matchScore" | "vettingScore" | "recent">("matchScore");
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [rejectionCandidate, setRejectionCandidate] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionError, setRejectionError] = useState("");
  const [isSubmittingRejection, setIsSubmittingRejection] = useState(false);

  const eligibleRequests = requests.filter((request) =>
    !['closed', 'closed/cancelled', 'cancelled'].includes(
      String(request.status || '').toLowerCase().replace(/[_-]+/g, ' ')
    )
  );

  const getTalentGrade = (talent: any) => {
    // Keep the submitted candidate visible even when the grade is below A.
    return talent.grade || "A";
  };

  const getVettingScore = (talent: any) => {
    return talent.vettingScore || 85;
  };

  // Pre-process and filter matches
  const processedGroups = useMemo(() => {
    return eligibleRequests.map(req => {
      const requestMatches = matches.filter(m =>
        String(m.requestId) === String(req.id) &&
        // Must not be rejected
        !isRejectedMatch(m.status)
      ).map(m => {
        const talent = talents.find(t => t.id === m.talentId) || { name: "Unknown", id: m.talentId, primarySkills: [], title: "Unknown Role" };
        return { match: m, talent };
      });

      // Sort matches
      const sortedMatches = [...requestMatches].sort((a, b) => {
        if (sortOption === "matchScore") return (b.match.score || 0) - (a.match.score || 0);
        if (sortOption === "vettingScore") return getVettingScore(b.talent) - getVettingScore(a.talent);
        if (sortOption === "recent") return new Date(b.match.createdAt || 0).getTime() - new Date(a.match.createdAt || 0).getTime();
        return 0;
      });

      const finalList = [
        ...sortedMatches.filter(x => String(x.match.status).toLowerCase() === 'shortlisted'),
        ...sortedMatches.filter(x => String(x.match.status).toLowerCase() !== 'shortlisted')
      ];

      return { request: req, candidates: finalList };
    }).filter(group => group.candidates.length > 0);
  }, [eligibleRequests, matches, talents, sortOption]);

  const toggleShortlist = async (match: any) => {
    if (String(match.status).toLowerCase() === 'shortlisted') return;
    try {
      const response = await apiFetch('/api/matches', {
        method: 'PATCH',
        body: JSON.stringify({ matchId: match.id, status: 'shortlisted' })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'The candidate could not be shortlisted.');
      if (setMatches) {
        setMatches(matches.map((item) => item.id === match.id ? { ...item, ...body.match } : item));
      }
    } catch (error: any) {
      console.error('[MatchedTalentPanel] shortlist not saved:', error);
      alert(error?.message || 'The candidate could not be shortlisted.');
    }
  };

  const handleRequestInterview = (talent: any, req: any, match: any) => {
    onScheduleMeeting?.(talent, req, match);
  };

  const openRejection = (match: any, talent: any, request: any) => {
    setRejectionCandidate({ match, talent, request });
    setRejectionReason("");
    setRejectionError("");
    setRejectionModalOpen(true);
  };

  const confirmRejection = async () => {
    if (!rejectionCandidate || !rejectionReason || isSubmittingRejection) return;
    const { match, request } = rejectionCandidate;
    setRejectionError("");
    setIsSubmittingRejection(true);

    try {
      // Through the server. matches_status_check allows only
      // proposed/shortlisted/rejected/accepted; "rejected_by_client" was
      // rejected by the database and the error was logged and swallowed, so
      // no rejection was ever recorded while the screen said otherwise.
      const response = await apiFetch('/api/matches', {
        method: 'PATCH',
        body: JSON.stringify({
          matchId: match.id,
          status: 'rejected',
          rejectionReason
        })
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'The rejection was not saved.');

      // Optimistic UI update
      if (setMatches) {
        const updated = matches.map(m => m.id === match.id ? { ...m, ...body.match } : m);
        setMatches(updated);
      }
      const currentRequest = requests.find((item) => String(item.id) === String(request.id));
      if (currentRequest && body.match?.requestStatus && onRequestUpdated) {
        onRequestUpdated({ ...currentRequest, status: body.match.requestStatus });
      }

      // Operations is told by the route when the request runs out of
      // candidates. The insert here addressed user_id "admin_team",
      // which is not a row in users, so the foreign key refused it
      // every time and nobody was ever told.

      setRejectionModalOpen(false);
      setRejectionCandidate(null);
      setRejectionReason("");
    } catch(err: any) {
      console.error('[MatchedTalentPanel] candidate rejection failed:', err);
      setRejectionError(err?.message || "Failed to reject candidate.");
    } finally {
      setIsSubmittingRejection(false);
    }
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px", display: "flex", flexDirection: "column", gap: "32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#0F172A", margin: "0 0 8px 0" }}>Matched Talent</h1>
          <p style={{ color: "#64748B", margin: 0, fontSize: "15px" }}>Review, shortlist, and interview top-tier candidates handpicked for your roles.</p>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "14px", fontWeight: 600, color: "#475569" }}>Sort by:</span>
          <select 
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as any)}
            style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", fontWeight: 500, outline: "none", cursor: "pointer" }}
          >
            <option value="matchScore">Match % (Highest First)</option>
            <option value="vettingScore">Vetting Score</option>
            <option value="recent">Most Recently Submitted</option>
          </select>
        </div>
      </div>

      {processedGroups.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 20px", background: "#F8FAFC", borderRadius: "16px", border: "1px dashed #CBD5E1" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.5 }}>👥</div>
          <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#0F172A", margin: "0 0 8px 0" }}>No candidates ready for review yet</h3>
          <p style={{ color: "#64748B", margin: 0 }}>We are currently vetting candidates for your requests. You'll be notified as soon as they are ready.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
          {processedGroups.map(group => (
            <div key={group.request.id}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", paddingBottom: "12px", borderBottom: "2px solid #E2E8F0" }}>
                <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#0F172A", margin: 0 }}>
                  {requestTitle(group.request)}
                </h2>
                <span style={{ padding: "4px 10px", background: "#EEF2FF", color: "#4F46E5", borderRadius: "20px", fontSize: "12px", fontWeight: 700 }}>
                  {group.candidates.length} Candidates
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "24px" }}>
                {group.candidates.map(({ match, talent }) => {
                  const isShortlisted = String(match.status).toLowerCase() === 'shortlisted';
                  const breakdown = match.breakdown || {} as any;
                  const candidateInterviews = interviews.filter((interview) =>
                    String(interview.requestId) === String(group.request.id)
                    && (String(interview.matchId || '') === String(match.id)
                      || String(interview.talentId) === String(talent.id))
                  );
                  const hasCompletedInterview = candidateInterviews.some((interview) =>
                    String(interview.status).toLowerCase() === 'completed'
                  );
                  const isTerminalMatch = ['rejected', 'accepted'].includes(String(match.status).toLowerCase());
                  
                  return (
                    <div 
                      key={match.id}
                      style={{
                        background: "#FFF",
                        borderRadius: "16px",
                        border: isShortlisted ? "2px solid #2563EB" : "1px solid #E2E8F0",
                        boxShadow: isShortlisted ? "0 4px 12px rgba(37, 99, 235, 0.1)" : "0 2px 4px rgba(0,0,0,0.02)",
                        overflow: "hidden",
                        position: "relative",
                        transition: "all 0.2s"
                      }}
                    >
                      {/* Shortlist Star */}
                      <button
                        onClick={() => toggleShortlist(match)}
                        disabled={isShortlisted || isTerminalMatch}
                        title={isShortlisted ? "Shortlisted" : "Shortlist candidate"}
                        style={{
                          position: "absolute",
                          top: "16px",
                          right: "16px",
                          background: "#FFF",
                          border: "none",
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                          color: isShortlisted ? "#F59E0B" : "#CBD5E1",
                          fontSize: "18px",
                          zIndex: 2,
                          transition: "color 0.2s"
                        }}
                      >
                        ★
                      </button>

                      <div style={{ padding: "24px" }}>
                        <div style={{ display: "flex", gap: "16px", marginBottom: "20px" }}>
                          <img 
                            src={talent.profilePhotoUrl || talent.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150"} 
                            alt={talent.name}
                            style={{ width: "72px", height: "72px", borderRadius: "16px", objectFit: "cover" }}
                          />
                          <div style={{ flex: 1, paddingRight: "30px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>{talent.name}</h3>
                              <span style={{ 
                                padding: "2px 6px", 
                                borderRadius: "4px", 
                                fontSize: "11px", 
                                fontWeight: 800, 
                                background: getTalentGrade(talent) === "A+" ? "#FEF3C7" : "#F1F5F9", 
                                color: getTalentGrade(talent) === "A+" ? "#D97706" : "#475569" 
                              }}>
                                Grade {getTalentGrade(talent)}
                              </span>
                            </div>
                            <div style={{ fontSize: "14px", color: "#64748B", marginTop: "4px", fontWeight: 500 }}>
                              {talent.title || talent.primaryRoleCategory} • {talent.seniorityLevel || "Mid"}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#94A3B8", marginTop: "6px" }}>
                              <span>📍 {talent.country || "Remote"} ({talent.timezone || "UTC"})</span>
                            </div>
                          </div>
                        </div>

                        {/* Metrics */}
                        <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
                          <div style={{ flex: 1, background: "#F8FAFC", padding: "12px", borderRadius: "12px", textAlign: "center" }}>
                            <div style={{ fontSize: "20px", fontWeight: 800, color: "#2563EB" }}>{match.score || 0}%</div>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginTop: "4px" }}>Match Score</div>
                          </div>
                          <div style={{ flex: 1, background: "#F8FAFC", padding: "12px", borderRadius: "12px", textAlign: "center" }}>
                            <div style={{ fontSize: "20px", fontWeight: 800, color: "#0F172A" }}>{getVettingScore(talent)}</div>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginTop: "4px" }}>Vetting Score</div>
                          </div>
                        </div>

                        {/* Match Breakdown details (collapsible or just tags) */}
                        <div style={{ marginBottom: "20px" }}>
                          <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "8px", textTransform: "uppercase" }}>Key Fit Areas</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            <span style={{ fontSize: "12px", padding: "4px 8px", background: "#F1F5F9", borderRadius: "6px", color: "#334155" }}>
                              Skill: {breakdown.skillFit || 0}%
                            </span>
                            <span style={{ fontSize: "12px", padding: "4px 8px", background: "#F1F5F9", borderRadius: "6px", color: "#334155" }}>
                              Behavior: {breakdown.behaviourFit || 0}%
                            </span>
                            <span style={{ fontSize: "12px", padding: "4px 8px", background: "#F1F5F9", borderRadius: "6px", color: "#334155" }}>
                              Personality: {breakdown.personalityFit || 0}%
                            </span>
                          </div>
                        </div>

                        {/* Top Tags */}
                        <div style={{ marginBottom: "24px", display: "flex", gap: "6px" }}>
                          {(talent.primarySkills || []).slice(0, 2).map((skill: string, idx: number) => (
                            <span key={idx} style={{ padding: "4px 10px", background: "#DBEAFE", color: "#1E40AF", borderRadius: "20px", fontSize: "12px", fontWeight: 600 }}>
                              {skill}
                            </span>
                          ))}
                          {(talent.primarySkills || []).length > 2 && (
                            <span style={{ padding: "4px 10px", color: "#64748B", fontSize: "12px", fontWeight: 600 }}>
                              +{(talent.primarySkills || []).length - 2} more
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: "flex", gap: "12px" }}>
                          <button 
                            onClick={() => handleRequestInterview(talent, group.request, match)}
                            disabled={isTerminalMatch}
                            style={{ flex: 1, background: "#2563EB", color: "#FFF", border: "none", padding: "10px", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer", transition: "background 0.2s" }}
                            onMouseOver={(e) => e.currentTarget.style.background = "#1D4ED8"}
                            onMouseOut={(e) => e.currentTarget.style.background = "#2563EB"}
                          >
                            Request Interview
                          </button>
                          <button 
                            onClick={() => openRejection(match, talent, group.request)}
                            disabled={isTerminalMatch}
                            style={{ background: "#FEE2E2", color: "#B91C1C", border: "none", padding: "10px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer", transition: "background 0.2s" }}
                            onMouseOver={(e) => e.currentTarget.style.background = "#FECACA"}
                            onMouseOut={(e) => e.currentTarget.style.background = "#FEE2E2"}
                          >
                            Not a Fit
                          </button>
                          {hasCompletedInterview && onExtendOffer && !isTerminalMatch && (
                            <button
                              onClick={() => onExtendOffer(talent, group.request, match)}
                              style={{ background: "#10B981", color: "#FFF", border: "none", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
                            >
                              Start Offer
                            </button>
                          )}
                        </div>
                        
                        <div style={{ textAlign: "center", marginTop: "16px" }}>
                          <a href="#" onClick={(e) => { e.preventDefault(); alert("Full Profile Modal integration point"); }} style={{ color: "#4F46E5", fontSize: "13px", fontWeight: 600, textDecoration: "none" }}>
                            View Full Profile →
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rejection Modal */}
      {rejectionModalOpen && rejectionCandidate && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#FFF", borderRadius: "20px", padding: "32px", width: "100%", maxWidth: "400px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}>
            <h3 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 16px 0", color: "#0F172A" }}>Remove Candidate</h3>
            <p style={{ fontSize: "14px", color: "#475569", margin: "0 0 24px 0" }}>
              Please let us know why <strong>{rejectionCandidate.talent.name}</strong> isn't the right fit. This helps your Account Manager refine future matches.
            </p>
            
            <select 
              value={rejectionReason}
              onChange={e => {
                setRejectionReason(e.target.value);
                setRejectionError("");
              }}
              style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", outline: "none", marginBottom: "24px" }}
            >
              <option value="" disabled>Select a reason...</option>
              <option value="Time zone mismatch">Time zone mismatch</option>
              <option value="Skill level insufficient">Skill level insufficient</option>
              <option value="Missing specific tool/technology">Missing specific tool/technology</option>
              <option value="Budget mismatch">Budget mismatch</option>
              <option value="Other">Other</option>
            </select>

            {rejectionError && (
              <div role="alert" style={{ color: "#B91C1C", fontSize: "13px", marginBottom: "16px" }}>
                {rejectionError}
              </div>
            )}

            <div style={{ display: "flex", gap: "12px" }}>
              <button 
                onClick={() => {
                  setRejectionModalOpen(false);
                  setRejectionCandidate(null);
                  setRejectionReason("");
                  setRejectionError("");
                }}
                disabled={isSubmittingRejection}
                style={{ flex: 1, padding: "10px", border: "1px solid #CBD5E1", background: "transparent", borderRadius: "8px", fontWeight: 600, color: "#475569", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmRejection}
                disabled={!rejectionReason || isSubmittingRejection}
                style={{ flex: 1, padding: "10px", border: "none", background: rejectionReason && !isSubmittingRejection ? "#B91C1C" : "#F87171", borderRadius: "8px", fontWeight: 700, color: "#FFF", cursor: rejectionReason && !isSubmittingRejection ? "pointer" : "not-allowed" }}
              >
                {isSubmittingRejection ? "Saving..." : "Confirm Removal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
