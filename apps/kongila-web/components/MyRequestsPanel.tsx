import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";

interface MyRequestsPanelProps {
  currentUser: any;
  requests: any[];
  matches: any[];
  contracts: any[];
  talents: any[];
  messages: any[];
  requestActivityLogs: any[];
  onSignContract: () => void;
  onExtendOffer: (talent: any) => void;
  onScheduleMeeting: () => void;
  matchingShortlistedState: Record<string, boolean>;
  handleShortlistToggle: (candId: string, candName: string, requestId?: string) => void;
  interviewRequests: Record<string, string[]>;
  handleRequestInterview: (candName: string, requestId?: string) => void;
  detailsViewRequestId: string | null;
  setDetailsViewRequestId: (id: string | null) => void;
}

const Card = ({ children, style, onClick }: { children: React.ReactNode, style?: React.CSSProperties, onClick?: () => void }) => (
  <div onClick={onClick} style={{ background: '#FFF', borderRadius: '16px', padding: '24px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', boxSizing: 'border-box', ...style }}>
    {children}
  </div>
);

const Button = ({ children, variant = 'primary', onClick, style }: { children: React.ReactNode, variant?: 'primary' | 'outline', onClick?: () => void, style?: React.CSSProperties }) => (
  <button 
    onClick={onClick} 
    style={{
      padding: '8px 16px',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: 600,
      cursor: 'pointer',
      border: variant === 'outline' ? '1px solid #CBD5E1' : 'none',
      background: variant === 'outline' ? 'transparent' : '#2563EB',
      color: variant === 'outline' ? '#0F172A' : '#FFF',
      ...style
    }}
  >
    {children}
  </button>
);

const TextInput = ({ label, value, onChange, type = 'text', placeholder, style }: { label?: string, value: any, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, type?: string, placeholder?: string, style?: React.CSSProperties }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', ...style }}>
    {label && <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>{label}</label>}
    <input 
      type={type} 
      value={value} 
      onChange={onChange} 
      placeholder={placeholder}
      style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px', color: '#0F172A', background: '#FFF' }}
    />
  </div>
);

const Select = ({ label, value, onChange, options }: { label: string, value: any, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, options: {label: string, value: string}[] }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
    <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>{label}</label>
    <select 
      value={value} 
      onChange={onChange}
      style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px', color: '#0F172A', background: '#FFF' }}
    >
      <option value="">Select an option</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

export default function MyRequestsPanel({
  currentUser,
  requests,
  matches,
  contracts,
  talents,
  messages,
  requestActivityLogs,
  onSignContract,
  onExtendOffer,
  onScheduleMeeting,
  matchingShortlistedState,
  handleShortlistToggle,
  interviewRequests,
  handleRequestInterview,
  detailsViewRequestId,
  setDetailsViewRequestId
}: MyRequestsPanelProps) {
  const [activeTab, setActiveTab] = useState<"All" | "Active" | "Hired" | "Closed/Cancelled">("All");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Detail View State
  const [detailSubTab, setDetailSubTab] = useState<"Overview" | "Request Details" | "Matched Talent" | "Interviews" | "Contracts" | "Messages" | "Activity Log">("Overview");

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  const filteredRequests = requests.filter((req: any) => {
    // Tab filtering
    if (activeTab === "Active" && !["new", "reviewing", "matching", "candidates_ready", "interviewing"].includes((req.status || "").toLowerCase())) return false;
    if (activeTab === "Hired" && (req.status || "").toLowerCase() !== "hired") return false;
    if (activeTab === "Closed/Cancelled" && !["closed", "cancelled"].includes((req.status || "").toLowerCase())) return false;
    
    // Search filtering
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const title = (req.roleDescription || "").toLowerCase();
      const idStr = (req.id || "").toLowerCase();
      if (!title.includes(q) && !idStr.includes(q)) return false;
    }
    return true;
  });

  const handleEditClick = (req: any) => {
    setEditForm({ ...req });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
  };

  const handleSaveEdit = async () => {
    if (editForm.id) {
      try {
        // Collect field changes
        const selectedReq = requests.find((r) => r.id === editForm.id);
        const fieldChanges: any = {};
        let hasChanges = false;
        Object.keys(editForm).forEach((key) => {
          if (editForm[key] !== selectedReq[key]) {
            fieldChanges[key] = { old: selectedReq[key], new: editForm[key] };
            hasChanges = true;
          }
        });

        if (hasChanges) {
          // Update DB
          const { error: updateError } = await supabase.from('service_requests').update({
            role_description: editForm.roleDescription,
            service_type: editForm.serviceType,
            num_of_talents: editForm.numberOfHires,
            status: editForm.status
          }).eq('id', editForm.id);

          if (updateError) throw updateError;

          // Log Activity
          const { error: logError } = await supabase.from('request_activity_logs').insert({
            request_id: editForm.id,
            actor_id: currentUser?.id,
            action_type: "EDIT_REQUEST",
            field_changes: fieldChanges
          });

          if (logError) throw logError;

          alert("Request updated successfully! Note: Changes will reflect upon page reload until real-time sync is enabled.");
        }
        setIsEditing(false);
      } catch (err) {
        console.error("Failed to save edit:", err);
        alert("Failed to save edit. Check console for details.");
      }
    }
  };

  if (detailsViewRequestId) {
    const request = requests.find((r) => r.id === detailsViewRequestId);
    if (!request) return <div>Request not found</div>;

    const isEditable = ["New", "New Request", "Reviewing"].includes(request.status);
    const relatedLogs = requestActivityLogs.filter((log) => log.requestId === request.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const requestMatches = matches.filter((m) => m.requestId === request.id);
    const requestContracts = contracts.filter((c) => c.matchId?.includes(request.id) || requestMatches.some(m => c.matchId === m.id));
    const requestMessages = messages.filter((m) => m.requestId === request.id || m.threadId === request.id);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "1200px", margin: "0 auto", padding: "32px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            onClick={() => setDetailsViewRequestId(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              backgroundColor: "#F1F5F9",
              color: "#64748B",
            }}
          >
            ←
          </button>
          <div>
            <h2 style={{ fontSize: "24px", fontWeight: 800, color: "#0F172A", margin: 0 }}>
              {request.roleDescription || "Service Request"}
            </h2>
            <div style={{ fontSize: "14px", color: "#64748B", marginTop: "4px" }}>
              Ref: {request.id} • Submitted on {new Date(request.createdAt).toLocaleDateString()}
            </div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <span
              style={{
                display: "inline-block",
                padding: "6px 12px",
                borderRadius: "20px",
                fontSize: "13px",
                fontWeight: 700,
                backgroundColor: isEditable ? "#DBEAFE" : "#F1F5F9",
                color: isEditable ? "#1E40AF" : "#475569",
              }}
            >
              Status: {request.status || "Reviewing"}
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #E2E8F0", paddingBottom: "16px", overflowX: 'auto' }}>
          {["Overview", "Request Details", "Matched Talent", "Interviews", "Contracts", "Messages", "Activity Log"].map((tab) => (
            <button
              key={tab}
              onClick={() => setDetailSubTab(tab as any)}
              style={{
                padding: "8px 16px",
                borderRadius: "20px",
                fontSize: "14px",
                fontWeight: detailSubTab === tab ? 700 : 500,
                color: detailSubTab === tab ? "#FFFFFF" : "#64748B",
                backgroundColor: detailSubTab === tab ? "#0F172A" : "transparent",
                border: "none",
                cursor: "pointer",
                transition: "all 0.2s",
                whiteSpace: "nowrap"
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {detailSubTab === "Overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <Card>
              <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0, marginBottom: "16px" }}>Request Summary</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <div style={{ fontSize: "12px", color: "#64748B" }}>Service Type</div>
                  <div style={{ fontSize: "14px", fontWeight: 600 }}>{request.serviceType}</div>
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "#64748B" }}>Duration</div>
                  <div style={{ fontSize: "14px", fontWeight: 600 }}>{request.duration}</div>
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "#64748B" }}>Urgency</div>
                  <div style={{ fontSize: "14px", fontWeight: 600 }}>{request.urgency}</div>
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "#64748B" }}>Hires Needed</div>
                  <div style={{ fontSize: "14px", fontWeight: 600 }}>{request.numberOfHires}</div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {detailSubTab === "Request Details" && (
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0 }}>Detailed Requirements</h3>
              {isEditable && !isEditing && (
                <Button variant="outline" onClick={() => handleEditClick(request)}>
                  Edit Request
                </Button>
              )}
            </div>
            
            {isEditing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <TextInput 
                  label="Role Description" 
                  value={editForm.roleDescription || ""} 
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({...editForm, roleDescription: e.target.value})}
                />
                <Select 
                  label="Service Type" 
                  options={[{value: "Technical", label: "Technical"}, {value: "Design", label: "Design"}]} 
                  value={editForm.serviceType || ""} 
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditForm({...editForm, serviceType: e.target.value})}
                />
                <TextInput 
                  label="Number of Hires" 
                  type="number"
                  value={editForm.numberOfHires || ""} 
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({...editForm, numberOfHires: parseInt(e.target.value)})}
                />
                <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "16px" }}>
                  <Button variant="outline" onClick={handleCancelEdit}>Cancel</Button>
                  <Button onClick={handleSaveEdit}>Save Changes</Button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <div style={{ fontSize: "12px", color: "#64748B", marginBottom: "4px" }}>Role Description</div>
                  <div style={{ fontSize: "14px", color: "#0F172A", padding: "12px", backgroundColor: "#F8FAFC", borderRadius: "8px" }}>
                    {request.roleDescription}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "#64748B", marginBottom: "4px" }}>Required Skills</div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {(request.requiredSkills || []).map((skill: string) => (
                      <span key={skill} style={{ padding: "4px 10px", backgroundColor: "#E2E8F0", borderRadius: "12px", fontSize: "12px", fontWeight: 500 }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Card>
        )}

        {detailSubTab === "Matched Talent" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {requestMatches.length > 0 ? requestMatches.map((match: any) => {
              const talent = talents.find(t => t.id === match.talentId) || { name: match.talentId, title: "Candidate", avatar: "" };
              const isShortlisted = !!matchingShortlistedState[match.talentId];
              return (
                <Card key={match.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <img src={talent.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&q=80"} alt="" style={{ width: "48px", height: "48px", borderRadius: "12px", objectFit: "cover" }} />
                    <div>
                      <div style={{ fontSize: "15px", fontWeight: 700 }}>{talent.name}</div>
                      <div style={{ fontSize: "13px", color: "#64748B" }}>{talent.title} • Match Score: {match.score}%</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <Button variant={isShortlisted ? "primary" : "outline"} onClick={() => handleShortlistToggle(match.talentId, talent.name, request.id)}>
                      {isShortlisted ? "Shortlisted" : "Shortlist"}
                    </Button>
                    <Button variant="outline" onClick={() => handleRequestInterview(talent.name, request.id)}>
                      Request Interview
                    </Button>
                  </div>
                </Card>
              )
            }) : (
              <Card>
                <div style={{ textAlign: "center", padding: "40px", color: "#64748B" }}>
                  <div style={{ margin: "0 auto 16px", opacity: 0.5, fontSize: "32px" }}>👥</div>
                  <div>No matched talent yet. We're working on finding the best candidates for you.</div>
                </div>
              </Card>
            )}
          </div>
        )}

        {detailSubTab === "Interviews" && (
          <Card>
            <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0, marginBottom: "16px" }}>Requested Interviews</h3>
            {(interviewRequests[request.id] || []).length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {(interviewRequests[request.id] || []).map((candName, idx) => (
                  <div key={idx} style={{ padding: "16px", backgroundColor: "#F8FAFC", borderRadius: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 600 }}>{candName}</div>
                    <div style={{ fontSize: "13px", color: "#64748B" }}>Pending Scheduling</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "40px", color: "#64748B" }}>
                <div style={{ margin: "0 auto 16px", opacity: 0.5, fontSize: "32px" }}>📅</div>
                <div>No interviews scheduled.</div>
              </div>
            )}
          </Card>
        )}

        {detailSubTab === "Contracts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {requestContracts.length > 0 ? requestContracts.map((contract: any) => (
              <Card key={contract.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 700 }}>Contract with {contract.talentName}</div>
                    <div style={{ fontSize: "13px", color: "#64748B" }}>Status: {contract.status} • Rate: ${contract.rateAmount}/{contract.rateType}</div>
                  </div>
                  <Button variant="outline" onClick={onSignContract}>View Contract</Button>
                </div>
              </Card>
            )) : (
              <Card>
                <div style={{ textAlign: "center", padding: "40px", color: "#64748B" }}>
                  <div style={{ margin: "0 auto 16px", opacity: 0.5, fontSize: "32px" }}>📄</div>
                  <div>No contracts generated yet.</div>
                </div>
              </Card>
            )}
          </div>
        )}

        {detailSubTab === "Messages" && (
          <Card>
            <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0, marginBottom: "16px" }}>Discussion Thread</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxHeight: "400px", overflowY: "auto", padding: "16px", backgroundColor: "#F8FAFC", borderRadius: "12px" }}>
              {requestMessages.length > 0 ? requestMessages.map((msg: any) => (
                <div key={msg.id} style={{ display: "flex", gap: "12px", flexDirection: msg.senderId === currentUser.id ? "row-reverse" : "row" }}>
                  <div style={{ padding: "12px 16px", borderRadius: "16px", backgroundColor: msg.senderId === currentUser.id ? "#2563EB" : "#FFFFFF", color: msg.senderId === currentUser.id ? "#FFFFFF" : "#0F172A", maxWidth: "80%", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                    {msg.content}
                  </div>
                </div>
              )) : (
                <div style={{ textAlign: "center", color: "#64748B", padding: "20px" }}>No messages yet.</div>
              )}
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
              <TextInput value={""} onChange={() => {}} placeholder="Type a message..." style={{ flex: 1 }} />
              <Button>Send</Button>
            </div>
          </Card>
        )}

        {detailSubTab === "Activity Log" && (
          <Card>
            <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0, marginBottom: "16px" }}>Audit Trail</h3>
            {relatedLogs.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {relatedLogs.map((log: any) => (
                  <div key={log.id} style={{ display: "flex", gap: "16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "#E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>
                        🕒
                      </div>
                      <div style={{ width: "2px", flex: 1, backgroundColor: "#E2E8F0", margin: "8px 0" }} />
                    </div>
                    <div style={{ flex: 1, paddingBottom: "16px" }}>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A" }}>{log.actionType}</div>
                      <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px" }}>
                        {new Date(log.createdAt).toLocaleString()} by {log.actorId}
                      </div>
                      {log.fieldChanges && Object.keys(log.fieldChanges).length > 0 && (
                        <div style={{ marginTop: "8px", padding: "12px", backgroundColor: "#F8FAFC", borderRadius: "8px", fontSize: "13px" }}>
                          {Object.keys(log.fieldChanges).map((key) => (
                            <div key={key}>
                              <strong>{key}:</strong> {JSON.stringify(log.fieldChanges[key].old)} → {JSON.stringify(log.fieldChanges[key].new)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "#64748B", padding: "40px" }}>No activity recorded yet.</div>
            )}
          </Card>
        )}

      </div>
    );
  }

  // --- List View ---
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "1200px", margin: "0 auto", padding: "32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#0F172A", margin: "0 0 8px 0" }}>My Requests</h1>
          <p style={{ color: "#64748B", margin: 0 }}>Track and manage all your talent service requests.</p>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
        <div style={{ display: "flex", gap: "8px", background: "#F1F5F9", padding: "4px", borderRadius: "12px" }}>
          {["All", "Active", "Hired", "Closed/Cancelled"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                background: activeTab === tab ? "#FFFFFF" : "transparent",
                color: activeTab === tab ? "#0F172A" : "#64748B",
                boxShadow: activeTab === tab ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                transition: "all 0.2s"
              }}
            >
              {tab}
            </button>
          ))}
        </div>
        
        <div style={{ position: "relative", width: "300px" }}>
          <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748B", fontSize: "14px" }}>🔍</span>
          <input
            type="text"
            placeholder="Search role or reference..."
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 10px 10px 40px",
              borderRadius: "12px",
              border: "1px solid #E2E8F0",
              fontSize: "14px",
              outline: "none",
              boxSizing: "border-box"
            }}
          />
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "24px" }}>
        {filteredRequests.map((req: any) => (
          <Card 
            key={req.id} 
            style={{ display: "flex", flexDirection: "column", cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s" }}
            onClick={() => setDetailsViewRequestId(req.id)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", color: "#4F46E5", fontSize: "20px" }}>
                  📋
                </div>
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "#0F172A" }}>{req.roleDescription || "Untitled Request"}</h3>
                  <div style={{ fontSize: "13px", color: "#64748B", marginTop: "4px" }}>Ref: {req.id}</div>
                </div>
              </div>
              <span style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, background: "#F1F5F9", color: "#475569" }}>
                {req.status || "Reviewing"}
              </span>
            </div>

            <div style={{ display: "flex", gap: "16px", marginBottom: "20px" }}>
              <div>
                <div style={{ fontSize: "11px", color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>Hires</div>
                <div style={{ fontSize: "14px", fontWeight: 600 }}>{req.numberOfHires || 1}</div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>Created</div>
                <div style={{ fontSize: "14px", fontWeight: 600 }}>{new Date(req.createdAt).toLocaleDateString()}</div>
              </div>
            </div>

            <div style={{ marginTop: "auto", paddingTop: "16px", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "13px", color: "#4F46E5", fontWeight: 600 }}>View Details</div>
              <span style={{ color: "#4F46E5", fontSize: "16px" }}>→</span>
            </div>
          </Card>
        ))}
        {filteredRequests.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px", color: "#64748B", background: "#F8FAFC", borderRadius: "16px" }}>
            <div style={{ margin: "0 auto 16px", opacity: 0.2, fontSize: "48px" }}>📋</div>
            <div style={{ fontSize: "16px", fontWeight: 600 }}>No requests found</div>
            <p>Try adjusting your search or filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
