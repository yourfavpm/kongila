import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { GlassCard, KongilaLoader } from '@kongila/ui';
import { formatCurrency, getGradeColor } from '@kongila/utils';
import { normalizeRequestStatus } from '@kongila/workflows';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '@kongila/ui';

// ─── Talent Profile Modal ──────────────────────────────────────────────────────
function TalentProfileModal({ talent, onClose }: { talent: any; onClose: () => void }) {
  if (!talent) return null;
  const vs = talent.vettingScores || {};
  const scores = [
    { label: 'Technical / Skill Assessment', key: 'technical', weight: '30%' },
    { label: 'Behavioural Interview', key: 'behavioral', weight: '30%' },
    { label: 'Work Simulation', key: 'workSimulation', weight: '20%' },
    { label: 'Personality Test', key: 'personality', weight: '10%' },
    { label: 'Remote Readiness', key: 'remoteReadiness', weight: '10%' },
  ];

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
      }}
    >
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: '20px', width: '100%', maxWidth: '780px',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        border: '1px solid var(--border-glass)'
      }}>
        {/* Header */}
        <div style={{ padding: '28px 32px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <img
              src={talent.profilePhotoUrl || talent.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(talent.name || 'T')}&background=0047CC&color=fff&size=80`}
              alt=""
              style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #0047CC' }}
            />
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>{talent.name}</h2>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '6px' }}>{talent.title || talent.primaryRole}</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ background: talent.grade === 'A+' ? '#0047CC' : talent.grade === 'A' ? '#10B981' : '#6B7280', color: 'white', padding: '2px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700 }}>
                  Grade {talent.grade}
                </span>
                <span style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', padding: '2px 10px', borderRadius: '999px', fontSize: '12px' }}>
                  {talent.vettingStatus || talent.vettingStage}
                </span>
                <span style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', padding: '2px 10px', borderRadius: '999px', fontSize: '12px' }}>
                  {talent.experienceYears || talent.experience_years || 0} yrs exp
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ padding: '24px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Bio */}
            {talent.bio && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '8px' }}>About</div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{talent.bio}</p>
              </div>
            )}

            {/* Contact & Location */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '8px' }}>Details</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                {(talent.country || talent.location) && <div>📍 {talent.country || talent.location}</div>}
                {talent.timezone && <div>🕐 {talent.timezone}</div>}
                {talent.preferredEngagementType && <div>💼 {talent.preferredEngagementType}</div>}
                {(talent.salaryExpectation || talent.salary_expectation) && (
                  <div>💰 ${(talent.salaryExpectation || talent.salary_expectation || 0).toLocaleString()} / mo</div>
                )}
                {talent.availabilityHours && <div>⏱ {talent.availabilityHours}h/week available</div>}
              </div>
            </div>

            {/* Skills */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '8px' }}>Skills</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(talent.primarySkills || talent.skills || []).map((s: string) => (
                  <span key={s} style={{ background: '#EEF3FF', color: '#0047CC', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600 }}>{s}</span>
                ))}
                {(!talent.primarySkills && !talent.skills) && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No skills listed</span>}
              </div>
            </div>

            {/* Work Experience */}
            {(talent.workExperience || talent.work_experience || []).length > 0 && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '8px' }}>Experience</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(talent.workExperience || talent.work_experience || []).slice(0, 3).map((w: any, i: number) => (
                    <div key={i} style={{ borderLeft: '3px solid #0047CC', paddingLeft: '12px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{w.role || w.title}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{w.company} · {w.startDate} – {w.endDate || 'Present'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column — Vetting Scorecard */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '12px' }}>Vetting Scorecard</div>

            {/* Composite Score */}
            <div style={{ background: 'linear-gradient(135deg, #0047CC15, #10B98115)', border: '1px solid #0047CC30', borderRadius: '12px', padding: '16px', marginBottom: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '36px', fontWeight: 900, color: '#0047CC' }}>
                {talent.compositeScore || vs.composite || '—'}
                {(talent.compositeScore || vs.composite) ? '%' : ''}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Composite Vetting Score</div>
              <div style={{ marginTop: '8px' }}>
                <span style={{
                  background: talent.grade === 'A+' ? '#0047CC' : talent.grade === 'A' ? '#10B981' : '#6B7280',
                  color: 'white', padding: '3px 14px', borderRadius: '999px', fontSize: '13px', fontWeight: 800
                }}>
                  Grade {talent.grade || '—'}
                </span>
              </div>
            </div>

            {/* Per-stage scores */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {scores.map(item => {
                const rawVal = vs[item.key];
                const val = typeof rawVal === 'number' ? rawVal : null;
                return (
                  <div key={item.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{item.label}</span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Weight: {item.weight}</span>
                        <span style={{ fontWeight: 700, color: val !== null ? (val >= 80 ? '#10B981' : val >= 65 ? '#F59E0B' : '#EF4444') : 'var(--text-muted)' }}>
                          {val !== null ? `${val}%` : 'N/A'}
                        </span>
                      </div>
                    </div>
                    <div style={{ height: '6px', background: 'var(--bg-elevated, #e5e7eb)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{
                        width: val !== null ? `${val}%` : '0%',
                        height: '100%',
                        background: val !== null ? (val >= 80 ? '#10B981' : val >= 65 ? '#F59E0B' : '#EF4444') : 'transparent',
                        borderRadius: '999px',
                        transition: 'width 0.4s ease'
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Vetting pipeline stage */}
            {talent.vettingPipeline && (
              <div style={{ marginTop: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '10px' }}>Pipeline Progress</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(talent.vettingPipeline as any[]).map((stage: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                      <span style={{ fontSize: '14px' }}>
                        {stage.status === 'passed' ? '✅' : stage.status === 'failed' ? '❌' : stage.status === 'in_progress' ? '🔄' : '⏳'}
                      </span>
                      <span style={{ color: stage.status === 'passed' ? '#10B981' : stage.status === 'failed' ? '#EF4444' : 'var(--text-secondary)', fontWeight: stage.status === 'in_progress' ? 700 : 400 }}>
                        {stage.stageName}
                      </span>
                      {typeof stage.score === 'number' && (
                        <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--text-primary)' }}>{stage.score}%</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function MatchingEngine() {
  const router = useRouter();
  const { requestId } = router.query;
  const { addToast } = useToast();

  const [request, setRequest] = useState<any>(null);
  const [talents, setTalents] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [scoredCandidates, setScoredCandidates] = useState<any[]>([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [submissionJustification, setSubmissionJustification] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);

  // Talent profile modal
  const [viewingTalent, setViewingTalent] = useState<any | null>(null);

  useEffect(() => {
    if (!requestId) return;
    const fetchData = async () => {
      try {
        const requestPromise = supabase
          .from('talent_requests')
          .select('payload')
          .eq('payload->>id', requestId as string)
          .maybeSingle();

        const dbPromise = fetch('/api/db').then(res => res.json());

        const [{ data: requestData }, db] = await Promise.all([requestPromise, dbPromise]);

        const req = requestData?.payload;
        if (req) setRequest({ ...req, status: normalizeRequestStatus(req.status) });

        // Only load deployable talent (A or A+ graded, and Vetted)
        const allTalents = (db.talents || []).filter((t: any) =>
          (t.vettingStage === 'Vetted & Available') ||
          (t.vettingStatus === 'Vetted' && (t.grade === 'A' || t.grade === 'A+'))
        );
        setTalents(allTalents);
        setMatches(db.matches || []);

        if (req) calculateScores(req, allTalents);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [requestId]);

  const calculateScores = (req: any, deployableTalents: any[]) => {
    const requiredSkills: string[] = req.requiredSkills || [];

    const results = deployableTalents.map(t => {
      const vs = t.vettingScores || {};

      // ── 1. Skill Fit (40%) ──────────────────────────────────────────────────
      // Real calculation: overlap between required skills and talent skills.
      // Falls back to the vetting technical score if no required skills are set.
      const talentSkills: string[] = t.primarySkills || t.skills || [];
      let skillScore: number;
      if (requiredSkills.length === 0) {
        skillScore = typeof vs.technical === 'number' ? vs.technical : 75;
      } else {
        const matched = requiredSkills.filter(rs =>
          talentSkills.some(ts => ts.toLowerCase().includes(rs.toLowerCase()))
        ).length;
        skillScore = Math.round((matched / requiredSkills.length) * 100);
      }

      // ── 2. Behavioural Fit (20%) ────────────────────────────────────────────
      // Pulled directly from the talent's vetting behavioral score.
      const behaviorScore = typeof vs.behavioral === 'number' ? vs.behavioral : 0;

      // ── 3. Personality Fit (15%) ────────────────────────────────────────────
      const personalityScore = typeof vs.personality === 'number' ? vs.personality : 0;

      // ── 4. Availability / Engagement Match (15%) ────────────────────────────
      const prefEng = (t.preferredEngagementType || '').toLowerCase();
      const reqEng = (req.commitmentLevel || '').toLowerCase();
      const availScore = reqEng && prefEng.includes(reqEng.split('-')[0].trim()) ? 100 : 70;

      // ── 5. Work Readiness (10%) — replaces "past performance" for undeployed talent ──
      // Uses remote readiness + work simulation scores (actual vetting data).
      // No inflated defaults — if not assessed, score is 0.
      const remoteScore = typeof vs.remoteReadiness === 'number' ? vs.remoteReadiness : 0;
      const workSimScore = typeof vs.workSimulation === 'number' ? vs.workSimulation : 0;
      const workReadinessScore = remoteScore > 0 || workSimScore > 0
        ? Math.round((remoteScore * 0.4) + (workSimScore * 0.6))
        : 0;

      const totalScore =
        (skillScore * 0.40) +
        (behaviorScore * 0.20) +
        (personalityScore * 0.15) +
        (availScore * 0.15) +
        (workReadinessScore * 0.10);

      return {
        talent: t,
        score: Math.min(100, Math.round(totalScore)),
        breakdown: {
          skillFit: Math.round(skillScore),
          behavioralInterview: Math.round(behaviorScore),
          personalityTest: Math.round(personalityScore),
          engagementMatch: Math.round(availScore),
          workReadiness: Math.round(workReadinessScore),
        },
        // Pass raw vetting scores too for accurate display
        vettingScores: vs,
        skillsMatched: requiredSkills.filter(rs =>
          talentSkills.some(ts => ts.toLowerCase().includes(rs.toLowerCase()))
        ),
        totalRequiredSkills: requiredSkills.length,
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
    if (selectedCandidateIds.length === 0) {
      addToast('Please select at least one candidate to submit.', 'error');
      return;
    }

    const conflictingTalent = selectedCandidateIds.find(id =>
      matches.some(m =>
        m.talentId === id &&
        m.requestId !== requestId &&
        ['Shortlisted', 'Interview Requested', 'Interview Scheduled', 'Interviewed',
         'shortlisted', 'interview_requested', 'interview_scheduled', 'interviewed'].includes(m.status)
      )
    );

    if (conflictingTalent) {
      const t = talents.find((tal: any) => tal.id === conflictingTalent);
      addToast(`Conflict: ${t?.name} is already an active candidate for another request.`, 'error');
      return;
    }

    if (selectedCandidateIds.length < 2 && !submissionJustification) {
      addToast('Please provide a justification for submitting fewer than 2 candidates.', 'info');
      return;
    }

    const requiresOverride = selectedCandidateIds.some(id => {
      const idx = scoredCandidates.findIndex(c => c.talent.id === id);
      return idx >= 5;
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
      const existingMatches = Array.isArray(db.matches) ? db.matches : [];

      const newMatches = selectedCandidateIds.map(id => {
        const c = scoredCandidates.find(sc => sc.talent.id === id);
        const existingMatch = existingMatches.find((m: any) => m.requestId === requestId && m.talentId === id);
        return {
          id: existingMatch?.id || `match_${Date.now()}_${id}`,
          requestId: requestId as string,
          talentId: id,
          score: c.score,
          breakdown: c.breakdown,
          status: 'Shortlisted',
          overrideReason: overrideReason || undefined,
          submissionJustification: submissionJustification || undefined
        };
      });

      // ── Re-read the FULL row so we never overwrite AM/TM assignments that were already set ──
      const { data: currentRow } = await supabase
        .from('talent_requests')
        .select('*')
        .eq('payload->>id', requestId as string)
        .maybeSingle();

      const existingPayload = currentRow?.payload || request;
      const resolvedAMId = currentRow?.account_manager_id || existingPayload.assignedAccountManagerId || '';
      const resolvedTMId = currentRow?.talent_manager_id || existingPayload.assignedTalentManagerId || '';

      const updatedPayload = {
        ...existingPayload,
        status: normalizeRequestStatus('Candidates Ready'),
        assignedAccountManagerId: resolvedAMId,
        assignedTalentManagerId: resolvedTMId,
      };

      const { error: reqError } = await supabase
        .from('talent_requests')
        .update({
          payload: updatedPayload,
          talent_manager_id: resolvedTMId || null,
          account_manager_id: resolvedAMId || null,
        })
        .eq('payload->>id', requestId as string);
      if (reqError) throw reqError;

      await supabase.from('audit_logs').insert({
        actor: 'Talent Manager',
        action: 'Submit Candidates',
        details: `Submitted ${selectedCandidateIds.length} candidates for request ${requestId}`
      });

      const mergedMatches = existingMatches.map((m: any) => {
        const replacement = newMatches.find(next => next.id === m.id || (next.requestId === m.requestId && next.talentId === m.talentId));
        return replacement ? { ...m, ...replacement } : m;
      });
      newMatches.forEach(next => {
        if (!mergedMatches.some((m: any) => m.id === next.id || (m.requestId === next.requestId && m.talentId === next.talentId))) {
          mergedMatches.push(next);
        }
      });

      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientRequests: (db.clientRequests || []).map((reqRow: any) =>
            reqRow.id === requestId ? { ...reqRow, ...updatedPayload } : reqRow
          ),
          matches: mergedMatches
        })
      });

      // Upsert into Supabase matches table with DB-normalised status
      const matchesToInsert = newMatches.map(m => ({
        id: m.id,
        request_id: m.requestId,
        talent_id: m.talentId,
        status: 'shortlisted',
        score: m.score,
        breakdown: m.breakdown
      }));
      const { error: matchErr } = await supabase.from('matches').upsert(matchesToInsert, { onConflict: 'id' });
      if (matchErr) console.error('Failed to upsert matches:', matchErr);

      // Notify the client
      if (updatedPayload.clientId) {
        await supabase.from('notifications').insert({
          id: crypto.randomUUID(),
          user_id: updatedPayload.clientId,
          title: 'New Talent Ready',
          message: `${selectedCandidateIds.length} new candidate(s) are ready for your review on this request.`,
          module_type: 'radar',
          read: false,
          created_at: new Date().toISOString()
        });
      }

      setRequest(updatedPayload);
      addToast('Candidates successfully submitted to the client!', 'success');
      router.push(`/requests/${requestId}`);
    } catch (e) {
      console.error(e);
      addToast('Failed to submit candidates.', 'error');
    } finally {
      setIsSubmitting(false);
      setShowOverrideModal(false);
    }
  };



  const handleSourcingRequired = async () => {
    if (!confirm('Flag this request as Sourcing Required?')) return;
    try {
      setIsSubmitting(true);
      const resDb = await fetch('/api/db');
      const db = await resDb.json();
      const updatedPayload = {
        ...request,
        status: 'Reviewing',
        internalNotes: (request.internalNotes || '') + '\n[System]: Flagged as Sourcing Required.'
      };
      const { error: reqError } = await supabase
        .from('talent_requests')
        .update({ payload: updatedPayload })
        .eq('payload->>id', requestId as string);
      if (reqError) throw reqError;

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
          clientRequests: (db.clientRequests || []).map((reqRow: any) =>
            reqRow.id === requestId ? { ...reqRow, ...updatedPayload } : reqRow
          ),
          tasks: [...(db.tasks || []), newTask]
        })
      });
      addToast('Request flagged for Sourcing. TA team notified.', 'info');
      router.push(`/requests/${requestId}`);
    } catch (e) {
      console.error(e);
      addToast('Action failed.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <KongilaLoader text="Loading Request Data..." />;
  if (!request) return <div style={{ padding: '40px' }}>Request not found.</div>;

  const breakdownLabels: Record<string, string> = {
    skillFit:          'Skill Fit',
    behavioralInterview: 'Behavioural Interview',
    personalityTest:   'Personality Test',
    engagementMatch:   'Engagement Match',
    workReadiness:     'Work Readiness',
  };
  const breakdownWeights: Record<string, string> = {
    skillFit:          '40%',
    behavioralInterview: '20%',
    personalityTest:   '15%',
    engagementMatch:   '15%',
    workReadiness:     '10%',
  };

  return (
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Talent Profile Modal */}
      {viewingTalent && <TalentProfileModal talent={viewingTalent} onClose={() => setViewingTalent(null)} />}

      <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        <Head><title>Matching Engine - Kongila Admin</title></Head>

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
              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', opacity: selectedCandidateIds.length === 0 ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin" style={{ width: '16px', height: '16px', color: 'white' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Submitting...
                </>
              ) : (
                `Submit ${selectedCandidateIds.length} Candidate${selectedCandidateIds.length !== 1 ? 's' : ''} to Client`
              )}
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
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>You are submitting fewer than 2 candidates. Please explain why.</p>
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
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>You have selected a candidate outside the top 5 system recommendations. Please log a reason.</p>
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
        {scoredCandidates.length === 0 ? (
          <GlassCard style={{ textAlign: 'center', padding: '60px 20px', marginTop: '20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>No Deployable Talents Found</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 24px auto', lineHeight: 1.5 }}>
              The matching engine only recommends talents who have completed the vetting process and are marked as <strong>"Vetted &amp; Available"</strong>.
            </p>
            <button onClick={() => router.push('/?tab=talent-pipeline')} className="btn-primary" style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px' }}>
              Go to Talent Pipeline
            </button>
          </GlassCard>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '20px' }}>
            {scoredCandidates.map((c, idx) => {
              const isSelected = selectedCandidateIds.includes(c.talent.id);
              const isTop5 = idx < 5;
              const scoreColor = c.score >= 80 ? '#10B981' : c.score >= 65 ? '#F59E0B' : '#EF4444';

              return (
                <GlassCard
                  key={c.talent.id}
                  style={{
                    border: isSelected ? '2px solid #0047CC' : '1px solid var(--border-glass)',
                    padding: '24px',
                    position: 'relative'
                  }}
                >
                  {isTop5 && (
                    <div style={{ position: 'absolute', top: '16px', left: '16px', background: '#0047CC10', color: '#0047CC', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, border: '1px solid #0047CC30' }}>
                      #{idx + 1} Top Pick
                    </div>
                  )}
                  {isSelected && (
                    <div style={{ position: 'absolute', top: '16px', right: '16px', background: '#0047CC', color: 'white', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                      ✓ Selected
                    </div>
                  )}

                  {/* Talent header */}
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', marginTop: '24px' }}>
                    <img
                      src={c.talent.profilePhotoUrl || c.talent.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.talent.name || 'T')}&background=0047CC&color=fff&size=60`}
                      alt=""
                      style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 2px 0' }}>{c.talent.name}</h3>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{c.talent.title || c.talent.primaryRole}</div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                        <span style={{ background: c.talent.grade === 'A+' ? '#0047CC' : '#10B981', color: 'white', padding: '1px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 800 }}>
                          Grade {c.talent.grade}
                        </span>
                        <span style={{ background: 'var(--bg-tertiary)', padding: '1px 8px', borderRadius: '999px', fontSize: '10px', color: 'var(--text-muted)' }}>
                          {c.talent.experienceYears || 0} yrs
                        </span>
                        {c.talent.country && (
                          <span style={{ background: 'var(--bg-tertiary)', padding: '1px 8px', borderRadius: '999px', fontSize: '10px', color: 'var(--text-muted)' }}>
                            {c.talent.country}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Match Score */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px', background: 'var(--bg-tertiary)', borderRadius: '10px', marginBottom: '16px' }}>
                    <div style={{
                      width: '52px', height: '52px', borderRadius: '50%',
                      background: `conic-gradient(${scoreColor} ${c.score * 3.6}deg, var(--bg-elevated) 0deg)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      position: 'relative'
                    }}>
                      <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 900, color: scoreColor }}>
                        {c.score}%
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>Match Score</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {c.totalRequiredSkills > 0
                          ? `${c.skillsMatched.length}/${c.totalRequiredSkills} required skills matched`
                          : 'Score based on vetting results'}
                      </div>
                    </div>
                    <div style={{ fontSize: '10px', color: scoreColor, fontWeight: 700 }}>
                      {isTop5 ? '⭐ Recommended' : 'Eligible'}
                    </div>
                  </div>

                  {/* Vetting Score Breakdown */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Score Breakdown (from vetting results)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {Object.entries(c.breakdown).map(([key, val]) => {
                        const v = val as number;
                        const barColor = v >= 80 ? '#10B981' : v >= 65 ? '#F59E0B' : v > 0 ? '#EF4444' : '#94A3B8';
                        return (
                          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                            <span style={{ color: 'var(--text-secondary)', width: '140px', flexShrink: 0 }}>
                              {breakdownLabels[key] || key}
                            </span>
                            <div style={{ flex: 1, height: '5px', background: 'var(--bg-elevated, #e5e7eb)', borderRadius: '999px', overflow: 'hidden' }}>
                              <div style={{ width: `${v}%`, height: '100%', background: barColor, borderRadius: '999px' }} />
                            </div>
                            <span style={{ fontWeight: 700, width: '28px', textAlign: 'right', color: barColor }}>
                              {v > 0 ? `${v}%` : 'N/A'}
                            </span>
                            <span style={{ fontSize: '9px', color: 'var(--text-muted)', width: '28px' }}>
                              {breakdownWeights[key]}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Skill match tags */}
                  {c.totalRequiredSkills > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '6px' }}>Matched Skills</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {(request.requiredSkills || []).map((s: string) => {
                          const matched = c.skillsMatched.includes(s);
                          return (
                            <span key={s} style={{
                              padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 600,
                              background: matched ? '#ECFDF5' : '#FEF2F2',
                              color: matched ? '#065F46' : '#991B1B',
                              border: `1px solid ${matched ? '#D1FAE5' : '#FECACA'}`
                            }}>
                              {matched ? '✓' : '✗'} {s}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setViewingTalent(c.talent)}
                      className="btn-secondary"
                      style={{ flex: 1, padding: '8px', fontSize: '12px', borderRadius: '8px' }}
                    >
                      👤 View Profile
                    </button>
                    <button
                      onClick={() => handleToggleSelect(c.talent.id)}
                      className={isSelected ? 'btn-secondary' : 'btn-primary'}
                      style={{ flex: 1, padding: '8px', fontSize: '12px', borderRadius: '8px' }}
                    >
                      {isSelected ? 'Deselect' : 'Select for Submission'}
                    </button>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
