import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { GlassCard } from '@kongila/ui';
import { formatCurrency, getGradeColor } from '@kongila/utils';

export default function MatchingEngine() {
  const router = useRouter();
  const { requestId } = router.query;

  const [request, setRequest] = useState<any>(null);
  const [talents, setTalents] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Scoring results state
  const [scoredCandidates, setScoredCandidates] = useState<any[]>([]);
  
  // Selection state
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [submissionJustification, setSubmissionJustification] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);

  useEffect(() => {
    if (!requestId) return;
    const fetchData = async () => {
      try {
        const res = await fetch('/api/db');
        const db = await res.json();
        
        const req = (db.clientRequests || db.requests || []).find((r: any) => r.id === requestId);
        if (req) {
          setRequest(req);
        }
        
        // Only load deployable talent
        const allTalents = (db.talents || []).filter((t: any) => t.vettingStage === 'Vetted & Available');
        setTalents(allTalents);
        
        setMatches(db.matches || []);
        
        if (req) {
          calculateScores(req, allTalents);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [requestId]);

  const calculateScores = (req: any, deployableTalents: any[]) => {
    const requiredSkills = req.requiredSkills || [];
    
    const results = deployableTalents.map(t => {
      // 1. Skill Fit (40%)
      const talentSkills = t.primarySkills || t.skills || [];
      let skillMatchCount = 0;
      requiredSkills.forEach((rs: string) => {
        if (talentSkills.some((ts: string) => ts.toLowerCase().includes(rs.toLowerCase()))) {
          skillMatchCount++;
        }
      });
      const skillScore = requiredSkills.length > 0 ? (skillMatchCount / requiredSkills.length) * 100 : 100;

      // 2. Behavior Fit (20%) - From performanceScore or previous assessments
      const behaviorScore = t.performanceScore || 85; 

      // 3. Personality Fit (15%) - From personality snapshot or default 
      const personalityScore = t.personalitySnapshot ? 90 : 80;

      // 4. Availability (15%) - Check engagement type preference
      const prefEng = t.preferredEngagementType || '';
      const reqEng = req.commitmentLevel || '';
      const availScore = prefEng.toLowerCase().includes(reqEng.toLowerCase()) ? 100 : 70;

      // 5. Past Performance (10%)
      const pastPerfScore = t.previousPerformanceScore || t.performanceScore || 80;

      const totalScore = (skillScore * 0.40) + (behaviorScore * 0.20) + (personalityScore * 0.15) + (availScore * 0.15) + (pastPerfScore * 0.10);

      return {
        talent: t,
        score: Math.round(totalScore),
        breakdown: {
          skillFit: Math.round(skillScore),
          behaviorFit: Math.round(behaviorScore),
          personalityFit: Math.round(personalityScore),
          availability: Math.round(availScore),
          pastPerformance: Math.round(pastPerfScore)
        }
      };
    });

    results.sort((a, b) => b.score - a.score);
    setScoredCandidates(results);
  };

  const handleToggleSelect = (candidateId: string) => {
    setSelectedCandidateIds(prev => 
      prev.includes(candidateId) ? prev.filter(id => id !== candidateId) : [...prev, candidateId]
    );
  };

  const handleSubmitCandidates = async () => {
    // Validations
    if (selectedCandidateIds.length === 0) {
      alert("Please select at least one candidate to submit.");
      return;
    }

    // Check for double submissions
    const conflictingTalent = selectedCandidateIds.find(id => {
      return matches.some(m => 
        m.talentId === id && 
        m.requestId !== requestId && 
        ['Shortlisted', 'Interview Requested', 'Interview Scheduled', 'Interviewed'].includes(m.status)
      );
    });

    if (conflictingTalent) {
      const t = talents.find(t => t.id === conflictingTalent);
      alert(`Conflict: ${t?.name} is already an active candidate for another client's request. Resolve that match first.`);
      return;
    }

    if (selectedCandidateIds.length < 2 && !submissionJustification) {
      alert("Minimum Candidate Justification: Please provide a written reason below for submitting fewer than 2 candidates.");
      return;
    }

    // Check for override
    const requiresOverride = selectedCandidateIds.some(id => {
      const idx = scoredCandidates.findIndex(c => c.talent.id === id);
      return idx >= 5; // Selected someone outside top 5
    });

    if (requiresOverride && !overrideReason) {
      setShowOverrideModal(true);
      return;
    }

    executeSubmission();
  };

  const executeSubmission = async () => {
    setIsSubmitting(true);
    try {
      const resDb = await fetch('/api/db');
      const db = await resDb.json();
      
      const newMatches = selectedCandidateIds.map(id => {
        const c = scoredCandidates.find(sc => sc.talent.id === id);
        return {
          id: `match_${Date.now()}_${id}`,
          requestId: requestId as string,
          talentId: id,
          score: c.score,
          breakdown: c.breakdown,
          status: 'Shortlisted',
          overrideReason: overrideReason || undefined,
          submissionJustification: submissionJustification || undefined
        };
      });

      const updatedRequests = (db.clientRequests || db.requests || []).map((r: any) => {
        if (r.id === requestId) {
          return { ...r, status: 'Candidates Ready' };
        }
        return r;
      });

      const newAuditLog = {
        id: `audit_${Date.now()}`,
        actor: 'Talent Manager',
        action: 'Submit Candidates',
        details: `Submitted ${selectedCandidateIds.length} candidates for request ${requestId}`,
        timestamp: new Date().toISOString()
      };

      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matches: [...(db.matches || []), ...newMatches],
          service_requests: updatedRequests,
          auditLogs: [newAuditLog, ...(db.auditLogs || [])]
        })
      });

      alert('Candidates successfully submitted to the client!');
      router.push(`/requests/${requestId}`);
    } catch (e) {
      console.error(e);
      alert('Failed to submit candidates.');
    } finally {
      setIsSubmitting(false);
      setShowOverrideModal(false);
    }
  };

  const handleSourcingRequired = async () => {
    if (!confirm('Flag this request as Sourcing Required? This will notify Talent Acquisition and the client of a delay.')) return;
    
    try {
      setIsSubmitting(true);
      const resDb = await fetch('/api/db');
      const db = await resDb.json();

      const updatedRequests = (db.clientRequests || db.requests || []).map((r: any) => {
        if (r.id === requestId) {
          return { ...r, status: 'Sourcing Required', internalNotes: (r.internalNotes || '') + '\n[System]: Flagged as Sourcing Required.' };
        }
        return r;
      });

      const newTask = {
        id: `task_${Date.now()}`,
        title: `Source Talent for Request ${requestId}`,
        assignedTo: 'Talent Acquisition Team',
        status: 'Not Started',
        priority: 'High',
        createdAt: new Date().toISOString()
      };

      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_requests: updatedRequests,
          tasks: [...(db.tasks || []), newTask]
        })
      });

      alert('Request flagged for Sourcing. TA team notified.');
      router.push(`/requests/${requestId}`);
    } catch (e) {
      console.error(e);
      alert('Action failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div style={{ padding: '40px' }}>Loading matching workspace...</div>;
  if (!request) return <div style={{ padding: '40px' }}>Request not found.</div>;

  return (
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        <Head>
          <title>Matching Engine - Kongila Admin</title>
        </Head>

        <button onClick={() => router.push(`/requests/${requestId}`)} className="btn-secondary" style={{ marginBottom: '20px', fontSize: '13px', padding: '6px 14px', borderRadius: '8px' }}>← Back to Request</button>

        <div className="page-header" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '24px' }}>🎯</span> Matching Engine Workspace
            </h1>
            <p className="page-subtitle" style={{ marginTop: '8px' }}>Translating request requirements into AI-assisted talent shortlists.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={handleSourcingRequired} className="btn-secondary" style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', color: '#EF4444', borderColor: '#FCA5A5' }}>
              Sourcing Required
            </button>
            <button 
              onClick={handleSubmitCandidates} 
              disabled={isSubmitting || selectedCandidateIds.length === 0} 
              className="btn-primary" 
              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', opacity: selectedCandidateIds.length === 0 ? 0.5 : 1 }}
            >
              Submit {selectedCandidateIds.length} Candidates to Client
            </button>
          </div>
        </div>

        {/* Request Summary */}
        <GlassCard style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Request Context</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', fontSize: '13px' }}>
            <div>
              <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Role</div>
              <div style={{ fontWeight: 600 }}>{request.roleDescription || request.serviceType}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Commitment</div>
              <div style={{ fontWeight: 600 }}>{request.commitmentLevel}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Duration</div>
              <div style={{ fontWeight: 600 }}>{request.duration}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Budget</div>
              <div style={{ fontWeight: 600 }}>{request.budget ? formatCurrency(request.budget) : 'Unspecified'}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Required Skills</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {(request.requiredSkills || []).map((s: string) => (
                  <span key={s} style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>{s}</span>
                ))}
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Justification Box */}
        {selectedCandidateIds.length > 0 && selectedCandidateIds.length < 2 && (
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #FCD34D', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
            <h4 style={{ color: '#D97706', margin: '0 0 8px 0', fontSize: '14px', fontWeight: 700 }}>Minimum Candidate Justification Required</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>You are submitting fewer than 2 candidates. Please explain why (e.g. limited pool for niche skill).</p>
            <input 
              type="text" 
              className="kongila-input" 
              placeholder="Enter justification..."
              value={submissionJustification}
              onChange={e => setSubmissionJustification(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px' }}
            />
          </div>
        )}

        {/* Override Modal */}
        {showOverrideModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GlassCard style={{ width: '400px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Match Override Logging</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>You have selected a candidate outside the top 5 system recommendations. Please log a reason for this override.</p>
              <textarea 
                className="kongila-input"
                rows={4}
                placeholder="Why did you select this candidate despite their ranking?"
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}
              />
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowOverrideModal(false)} className="btn-secondary" style={{ padding: '8px 16px', borderRadius: '8px' }}>Cancel</button>
                <button onClick={executeSubmission} disabled={!overrideReason} className="btn-primary" style={{ padding: '8px 16px', borderRadius: '8px' }}>Confirm Override</button>
              </div>
            </GlassCard>
          </div>
        )}

        {/* Ranked Candidates */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '20px' }}>
          {scoredCandidates.map((c, idx) => {
            const isSelected = selectedCandidateIds.includes(c.talent.id);
            const isTop5 = idx < 5;
            
            return (
              <GlassCard 
                key={c.talent.id} 
                style={{ 
                  border: isSelected ? '2px solid #0047CC' : '1px solid var(--border-glass)',
                  padding: '24px',
                  position: 'relative'
                }}
              >
                {isSelected && (
                  <div style={{ position: 'absolute', top: '16px', right: '16px', background: '#0047CC', color: 'white', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                    Selected
                  </div>
                )}
                
                <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                  <img src={c.talent.profilePhotoUrl || 'https://via.placeholder.com/60'} alt="" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} />
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0' }}>{c.talent.name}</h3>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{c.talent.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {c.talent.experienceYears} yrs exp · {c.talent.preferredEngagementType}
                    </div>
                  </div>
                </div>

                {/* Score Circle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: getGradeColor(c.score > 80 ? 'A' : c.score > 60 ? 'B' : 'C'), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 800 }}>
                    {c.score}%
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>System Match Score</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{isTop5 ? 'Top Recommendation' : 'Eligible Candidate'}</div>
                  </div>
                </div>

                {/* Breakdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                  {[
                    { label: 'Skill Fit (40%)', val: c.breakdown.skillFit },
                    { label: 'Behavior Fit (20%)', val: c.breakdown.behaviorFit },
                    { label: 'Personality Fit (15%)', val: c.breakdown.personalityFit },
                    { label: 'Availability (15%)', val: c.breakdown.availability },
                    { label: 'Past Performance (10%)', val: c.breakdown.pastPerformance },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '50%' }}>
                        <div style={{ flex: 1, height: '6px', background: 'var(--bg-elevated)', borderRadius: '999px' }}>
                          <div style={{ width: `${item.val}%`, height: '100%', background: '#10B981', borderRadius: '999px' }} />
                        </div>
                        <span style={{ fontWeight: 600, width: '30px', textAlign: 'right' }}>{item.val}%</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => window.open(`/talent/${c.talent.id}`, '_blank')} className="btn-secondary" style={{ flex: 1, padding: '8px', fontSize: '12px', borderRadius: '8px' }}>View Profile</button>
                  <button 
                    onClick={() => handleToggleSelect(c.talent.id)} 
                    className={isSelected ? "btn-secondary" : "btn-primary"} 
                    style={{ flex: 1, padding: '8px', fontSize: '12px', borderRadius: '8px' }}
                  >
                    {isSelected ? 'Deselect' : 'Select for Submission'}
                  </button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}
