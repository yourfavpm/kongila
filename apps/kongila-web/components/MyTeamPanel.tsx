import React, { useState } from "react";
import { Contract, TalentProfile, ServiceRequest } from "@kongila/shared-types";
import { supabase } from "../lib/supabaseClient";

interface MyTeamPanelProps {
  currentUser: any;
  contracts: Contract[];
  talents: TalentProfile[];
  requests: ServiceRequest[];
  onAddRequest?: (req: any) => Promise<void>;
  saveToDb?: (db: any) => Promise<void>;
}

export default function MyTeamPanel({
  currentUser,
  contracts,
  talents,
  requests,
  onAddRequest,
  saveToDb
}: MyTeamPanelProps) {
  const [replacementModalOpen, setReplacementModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [replacementReason, setReplacementReason] = useState("");
  const [replacementNotes, setReplacementNotes] = useState("");
  const [replacementLoading, setReplacementLoading] = useState(false);

  // Group contracts
  const activeContracts = contracts.filter(c => c.status === "active" || c.status === "Signed");
  const pastContracts = contracts.filter(c => c.status === "terminated" || c.status === "completed" || c.status === "Expired");

  // Summary Metrics
  const activeHeadcount = activeContracts.length;
  
  const totalMonthlySpend = activeContracts.reduce((sum, c) => {
    return sum + (c.clientMonthlyFeeUsd || c.rateAmount || c.salary || 0);
  }, 0);

  const avgPerformance = activeHeadcount > 0 
    ? activeContracts.reduce((sum, c) => sum + (c.performanceScore || c.rating || 0), 0) / activeHeadcount
    : 0;

  const now = new Date();

  const handleRequestReplacement = (contract: Contract) => {
    const startDate = new Date(contract.startDate || contract.start_date || new Date());
    const daysActive = (now.getTime() - startDate.getTime()) / (1000 * 3600 * 24);
    
    if (daysActive < 30) {
      const eligibleDate = new Date(startDate);
      eligibleDate.setDate(startDate.getDate() + 30);
      alert(`Replacement requests are available after ${eligibleDate.toLocaleDateString()}. Contact your Account Manager for urgent concerns.`);
      return;
    }

    setSelectedContract(contract);
    setReplacementReason("");
    setReplacementNotes("");
    setReplacementModalOpen(true);
  };

  const submitReplacement = async () => {
    if (!selectedContract) return;
    setReplacementLoading(true);

    try {
      // Find original request to clone requirements
      const originalRequest = requests.find(r => r.roleTitle === selectedContract.role || r.id === selectedContract.requestId);
      
      if (onAddRequest) {
        await onAddRequest({
          id: `req_${Date.now()}`,
          clientId: currentUser?.id,
          roleTitle: selectedContract.role || selectedContract.role_title || "Replacement Role",
          roleDescription: originalRequest?.roleDescription || "Replacement requested",
          requiredSkills: originalRequest?.requiredSkills || [],
          status: "New Request",
          priority: "High",
          isReplacement: true,
          replacedContractId: selectedContract.id,
          replacementReason,
          internalNotes: replacementNotes,
          createdAt: new Date().toISOString()
        });
      }

      await supabase.from("notifications").insert({
        user_id: "admin_team", // Ops Manager + Account Manager
        title: "Replacement Requested",
        content: `Replacement requested by ${currentUser?.name || 'Client'} for ${selectedContract.talentName} (${selectedContract.role}). Reason: ${replacementReason}.`,
        read_status: false,
      });

      alert("Your replacement request has been received. We'll begin sourcing immediately — typical replacement time is 10 business days.");
      setReplacementModalOpen(false);
      setSelectedContract(null);
    } catch (err) {
      console.error("Failed to submit replacement request:", err);
      alert("Failed to submit replacement request. Please try again or contact your Account Manager.");
    } finally {
      setReplacementLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px", display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Header & Banner */}
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#0F172A", margin: "0 0 16px 0" }}>My Team</h1>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          <div style={{ background: "#FFF", borderRadius: "12px", padding: "20px", border: "1px solid #E2E8F0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#64748B", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Active Headcount</div>
            <div style={{ fontSize: "32px", fontWeight: 800, color: "#0F172A" }}>{activeHeadcount}</div>
          </div>
          <div style={{ background: "#FFF", borderRadius: "12px", padding: "20px", border: "1px solid #E2E8F0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#64748B", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Total Monthly Spend</div>
            <div style={{ fontSize: "32px", fontWeight: 800, color: "#0F172A" }}>${totalMonthlySpend.toLocaleString()}</div>
          </div>
          <div style={{ background: "#FFF", borderRadius: "12px", padding: "20px", border: "1px solid #E2E8F0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#64748B", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Avg Performance</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <div style={{ fontSize: "32px", fontWeight: 800, color: avgPerformance >= 85 ? "#059669" : (avgPerformance >= 70 ? "#D97706" : "#DC2626") }}>
                {avgPerformance ? avgPerformance.toFixed(1) : "--"}
              </div>
              <div style={{ fontSize: "14px", color: "#64748B", fontWeight: 500 }}>/ 100</div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Team Grid */}
      <div>
        <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#0F172A", margin: "0 0 16px 0", borderBottom: "2px solid #E2E8F0", paddingBottom: "12px" }}>Active Team</h2>
        {activeContracts.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", background: "#F8FAFC", borderRadius: "12px", border: "1px dashed #CBD5E1" }}>
            <p style={{ color: "#64748B", fontWeight: 500, margin: 0 }}>You currently have no active team members.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
            {activeContracts.map(c => {
              const t = talents.find(tal => tal.id === c.talentId);
              const score = c.performanceScore || c.rating || 0;
              const isLowPerf = score > 0 && score < 70;

              return (
                <div key={c.id} style={{ background: "#FFF", borderRadius: "12px", border: isLowPerf ? "1px solid #FCA5A5" : "1px solid #E2E8F0", padding: "20px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                    <img 
                      src={t?.avatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150"} 
                      alt={c.talentName}
                      style={{ width: "56px", height: "56px", borderRadius: "50%", objectFit: "cover" }}
                    />
                    <div>
                      <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 800, color: "#0F172A" }}>{c.talentName}</h3>
                      <div style={{ fontSize: "13px", color: "#64748B", fontWeight: 500 }}>{c.role || c.role_title} • {t?.country || "Remote"}</div>
                    </div>
                  </div>

                  <div style={{ background: "#F8FAFC", padding: "12px", borderRadius: "8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <div style={{ fontSize: "11px", color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>Monthly Cost</div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>${(c.clientMonthlyFeeUsd || c.rateAmount || c.salary || 0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>Start Date</div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>
                        {new Date(c.startDate || c.start_date || "").toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ gridColumn: "span 2" }}>
                      <div style={{ fontSize: "11px", color: "#64748B", fontWeight: 700, textTransform: "uppercase", display: "flex", justifyContent: "space-between" }}>
                        <span>Performance Score</span>
                        <span style={{ color: isLowPerf ? "#DC2626" : "#059669" }}>Live from Remotan</span>
                      </div>
                      <div style={{ fontSize: "20px", fontWeight: 800, color: isLowPerf ? "#DC2626" : (score >= 85 ? "#059669" : "#0F172A") }}>
                        {score > 0 ? score : "Pending"}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
                    <button style={{ flex: 1, padding: "8px", background: "#F1F5F9", color: "#475569", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                      Open in Remotan
                    </button>
                    <button style={{ flex: 1, padding: "8px", background: "#F1F5F9", color: "#475569", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                      Message AM
                    </button>
                  </div>
                  <button 
                    onClick={() => handleRequestReplacement(c)}
                    style={{ padding: "8px", background: "transparent", color: "#DC2626", border: "1px solid #FECACA", borderRadius: "6px", fontSize: "12px", fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}
                  >
                    Request Replacement
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Past Team Members */}
      <div>
        <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#0F172A", margin: "0 0 16px 0", borderBottom: "2px solid #E2E8F0", paddingBottom: "12px" }}>Past Team Members</h2>
        {pastContracts.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", background: "#F8FAFC", borderRadius: "12px" }}>
            <p style={{ color: "#64748B", margin: 0 }}>No past team members found.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {pastContracts.map(c => {
              const t = talents.find(tal => tal.id === c.talentId);
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#FFF", border: "1px solid #E2E8F0", padding: "16px", borderRadius: "12px" }}>
                  <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                    <img 
                      src={t?.avatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150"} 
                      alt={c.talentName}
                      style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" }}
                    />
                    <div>
                      <h4 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: 700, color: "#0F172A" }}>{c.talentName}</h4>
                      <div style={{ fontSize: "13px", color: "#64748B", display: "flex", gap: "12px" }}>
                        <span>{c.role || c.role_title}</span>
                        <span>Ended: {new Date(c.endDate || "").toLocaleDateString()}</span>
                        {c.terminationReason && (
                          <span style={{ color: "#DC2626" }}>Reason: {c.terminationReason.replace(/_/g, " ")}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "11px", color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>Final Score</div>
                      <div style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A" }}>{c.performanceScore || c.rating || "--"}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Request Replacement Modal */}
      {replacementModalOpen && selectedContract && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#FFF", borderRadius: "16px", padding: "32px", width: "100%", maxWidth: "480px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}>
            <h3 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 8px 0", color: "#0F172A" }}>Request Replacement</h3>
            <p style={{ fontSize: "14px", color: "#475569", margin: "0 0 24px 0", lineHeight: 1.5 }}>
              You are requesting a replacement for <strong>{selectedContract.talentName}</strong> ({selectedContract.role || selectedContract.role_title}).
              <br/><br/>
              A new sourcing request will be created automatically. The current contract remains active until the replacement is finalized to prevent coverage gaps.
            </p>
            
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "8px" }}>Reason for Replacement *</label>
            <select 
              value={replacementReason} 
              onChange={e => setReplacementReason(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", outline: "none", marginBottom: "20px" }}
            >
              <option value="">Select a reason...</option>
              <option value="Performance">Performance Below Expectations</option>
              <option value="Skill Mismatch">Skill Mismatch</option>
              <option value="Communication Issues">Communication Issues</option>
              <option value="Other">Other</option>
            </select>

            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "8px" }}>Additional Notes (Optional)</label>
            <textarea 
              value={replacementNotes}
              onChange={e => setReplacementNotes(e.target.value)}
              placeholder="Provide more context for your Account Manager..."
              style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", outline: "none", marginBottom: "24px", minHeight: "80px", resize: "vertical", boxSizing: "border-box" }}
            />

            <div style={{ display: "flex", gap: "12px" }}>
              <button 
                onClick={() => setReplacementModalOpen(false)}
                disabled={replacementLoading}
                style={{ flex: 1, padding: "12px", border: "1px solid #CBD5E1", background: "transparent", borderRadius: "8px", fontWeight: 600, color: "#475569", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button 
                onClick={submitReplacement}
                disabled={!replacementReason || replacementLoading}
                style={{ flex: 1, padding: "12px", border: "none", background: !replacementReason || replacementLoading ? "#9CA3AF" : "#DC2626", borderRadius: "8px", fontWeight: 700, color: "#FFF", cursor: !replacementReason || replacementLoading ? "not-allowed" : "pointer" }}
              >
                {replacementLoading ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
