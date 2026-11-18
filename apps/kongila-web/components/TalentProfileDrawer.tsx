import React, { useEffect, useMemo } from "react";

/**
 * A matched candidate, in full, for the client who was matched with them.
 *
 * There was a profile modal before this: a 490-line block inside
 * ClientDashboard that showed a name, a grade, three scores and a skills
 * list. Everything a client actually weighs a candidate on was missing —
 * what work they have done, what they are asking for, when they can start,
 * how they work remotely — and the vetting they had been through was a
 * single word, "Vetted", with nothing behind it. A client could see that
 * Kongila had assessed someone and not one thing Kongila had found.
 *
 * So this shows the whole assessment: every vetting stage, its decision, its
 * score and the assessor's own notes. That is the argument for the candidate,
 * and withholding it while asking a client to commit to an interview makes
 * the vetting worth nothing to the person it is meant to persuade.
 *
 * It is a drawer rather than a centred modal because reading a profile is
 * reading, not a decision in a box: the shortlist stays on screen behind it,
 * and the client can open one candidate after another without losing where
 * they were.
 *
 * Contact details are not here, and are not withheld by this component:
 * `scopeDbForUser` strips the email address, the phone number, the LinkedIn
 * profile and the CV before a candidate record is ever sent to a client, so
 * there is nothing to hide at this layer. Kongila makes the introduction.
 */

interface TalentProfileDrawerProps {
  talent: any | null;
  /** The role this candidate was matched against, when opened from one. */
  request?: any | null;
  /** Their match on that role, for the fit breakdown. */
  match?: any | null;
  onClose: () => void;
  /** Rendered as the primary action when the client may still ask for one. */
  onRequestInterview?: () => void;
  interviewDisabled?: boolean;
  interviewDisabledReason?: string;
  /** Replaces the button's wording when an interview is already running. */
  interviewLabel?: string;
}

const STAGE_ORDER = [
  'Application Screening',
  'Skill Assessment',
  'Behavioural Interview',
  'Personality Test',
  'Remote Readiness',
  'Work Simulation',
  'Final Review'
];

const STAGE_TONE: Record<string, { bg: string; fg: string; label: string }> = {
  passed: { bg: '#ECFDF5', fg: '#047857', label: 'Passed' },
  failed: { bg: '#FEF2F2', fg: '#B91C1C', label: 'Failed' },
  rejected: { bg: '#FEF2F2', fg: '#B91C1C', label: 'Rejected' },
  submitted: { bg: '#EFF6FF', fg: '#1D4ED8', label: 'Submitted' },
  in_progress: { bg: '#FFF7ED', fg: '#C2410C', label: 'In progress' },
  needs_clarification: { bg: '#FFFBEB', fg: '#92400E', label: 'Needs clarification' },
  skipped: { bg: '#F8FAFC', fg: '#64748B', label: 'Not required' },
  pending: { bg: '#F8FAFC', fg: '#64748B', label: 'Not started' }
};

function stageTone(status: unknown) {
  return STAGE_TONE[String(status || 'pending').toLowerCase()] || STAGE_TONE.pending;
}

function formatDate(value: unknown): string | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** A score, or an em-free "not scored" — never a 0 standing in for no mark. */
function formatScore(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `${Math.round(n)}` : '–';
}

function money(value: unknown): string | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `$${n.toLocaleString()}`;
}

export default function TalentProfileDrawer({
  talent,
  request,
  match,
  onClose,
  onRequestInterview,
  interviewDisabled,
  interviewDisabledReason,
  interviewLabel
}: TalentProfileDrawerProps) {
  // Escape closes it. A drawer that can only be dismissed by finding a small
  // button is a drawer people leave open.
  useEffect(() => {
    if (!talent) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [talent, onClose]);

  const pipeline = useMemo(() => {
    const stages = Array.isArray(talent?.vettingPipeline) ? [...talent.vettingPipeline] : [];
    return stages.sort((a: any, b: any) => {
      const ai = Number.isFinite(Number(a?.stageIndex))
        ? Number(a.stageIndex)
        : STAGE_ORDER.indexOf(String(a?.stageName));
      const bi = Number.isFinite(Number(b?.stageIndex))
        ? Number(b.stageIndex)
        : STAGE_ORDER.indexOf(String(b?.stageName));
      return ai - bi;
    });
  }, [talent]);

  if (!talent) return null;

  const scores = talent.vettingScores || {};
  const breakdown = match?.breakdown || {};
  const salary = money(talent.salaryExpectationUsd) || money(talent.salaryExpectation);
  const salaryRange = money(talent.salaryExpectationMinUsd) && money(talent.salaryExpectationMaxUsd)
    ? `${money(talent.salaryExpectationMinUsd)} – ${money(talent.salaryExpectationMaxUsd)}`
    : null;
  const skills: string[] = talent.primarySkills?.length
    ? talent.primarySkills
    : (talent.skills || []);
  const experience: any[] = Array.isArray(talent.workExperience) ? talent.workExperience : [];

  const facts: { label: string; value: string }[] = [
    { label: 'Seniority', value: talent.seniorityLevel || '—' },
    { label: 'Experience', value: talent.experienceYears ? `${talent.experienceYears} years` : '—' },
    { label: 'Timezone', value: talent.timezone || '—' },
    { label: 'Based in', value: talent.country || talent.city || '—' },
    { label: 'Notice period', value: talent.noticePeriod || '—' },
    { label: 'Can start', value: formatDate(talent.availableStartDate) || 'Immediately' },
    { label: 'Engagement', value: talent.preferredEngagementType || talent.employmentPreference || '—' },
    { label: 'Working hours', value: talent.preferredWorkHours || '—' },
    { label: 'Rate expectation', value: salaryRange || (salary ? `${salary} / month` : '—') },
    { label: 'Vetting status', value: talent.vettingStatus || '—' }
  ];

  const remote: { label: string; value: string }[] = [
    { label: 'Internet', value: talent.internetQuality || '—' },
    { label: 'Work setup', value: talent.workSetup || '—' },
    { label: 'Devices', value: talent.devices || '—' },
    { label: 'Collaboration tools', value: talent.communicationTools || '—' }
  ];

  const scoreCards = [
    { label: 'Technical', value: scores.technical },
    { label: 'Behavioural', value: scores.behavioral },
    { label: 'Personality', value: scores.personality },
    { label: 'Remote readiness', value: scores.remoteReadiness },
    { label: 'Work simulation', value: scores.workSimulation }
  ];

  const fitCards = [
    { label: 'Skill fit', value: breakdown.skillFit },
    { label: 'Behaviour fit', value: breakdown.behaviourFit },
    { label: 'Personality fit', value: breakdown.personalityFit },
    { label: 'Availability', value: breakdown.availability },
    { label: 'Past performance', value: breakdown.pastPerformance }
  ].filter(card => Number(card.value) > 0);

  const sectionTitle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#64748B',
    margin: '0 0 12px 0'
  };
  const card: React.CSSProperties = {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '14px',
    padding: '20px'
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${talent.name} profile`}
      style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', justifyContent: 'flex-end' }}
    >
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(3px)' }}
      />

      <aside
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '620px',
          height: '100%',
          background: '#F8FAFC',
          boxShadow: '-24px 0 60px rgba(15,23,42,0.18)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'kongilaDrawerIn 220ms cubic-bezier(0.22, 1, 0.36, 1)'
        }}
      >
        <style>{`
          @keyframes kongilaDrawerIn {
            from { transform: translateX(32px); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
        `}</style>

        {/* Header. Stays put while the body scrolls, so the client always
            knows whose profile they are reading. */}
        <header
          style={{
            padding: '24px 28px 20px',
            background: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            gap: '16px',
            alignItems: 'flex-start',
            flexShrink: 0
          }}
        >
          <div
            style={{
              width: '60px', height: '60px', borderRadius: '16px', flexShrink: 0,
              background: '#EFF6FF', color: '#1D4ED8', fontWeight: 800, fontSize: '22px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
            }}
          >
            {talent.avatar || talent.profilePhotoUrl ? (
              <img
                src={talent.avatar || talent.profilePhotoUrl}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              String(talent.name || '?').charAt(0).toUpperCase()
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '21px', fontWeight: 800, color: '#0F172A' }}>
                {talent.name}
              </h2>
              {talent.grade && (
                <span style={{
                  padding: '3px 9px', borderRadius: '999px', background: '#0F172A',
                  color: '#FFFFFF', fontSize: '11px', fontWeight: 800
                }}>
                  Grade {talent.grade}
                </span>
              )}
            </div>
            <div style={{ fontSize: '14px', color: '#475569', fontWeight: 600, marginTop: '3px' }}>
              {talent.title || talent.primaryRoleCategory || 'Candidate'}
            </div>
            {request && (
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px' }}>
                Matched to {request.title || request.roleTitle || request.roleDescription || 'your role'}
                {Number(match?.score) > 0 ? ` · ${Math.round(Number(match.score))}% match` : ''}
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            aria-label="Close profile"
            style={{
              background: '#F1F5F9', border: 'none', borderRadius: '10px',
              width: '34px', height: '34px', cursor: 'pointer', fontSize: '18px',
              color: '#475569', flexShrink: 0, lineHeight: 1
            }}
          >
            ×
          </button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 28px 28px', display: 'grid', gap: '22px' }}>
          {talent.bio && (
            <section>
              <h3 style={sectionTitle}>About</h3>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.65, color: '#334155' }}>{talent.bio}</p>
            </section>
          )}

          <section>
            <h3 style={sectionTitle}>At a glance</h3>
            <div style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px 20px' }}>
              {facts.map(fact => (
                <div key={fact.label}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {fact.label}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>
                    {fact.value}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {skills.length > 0 && (
            <section>
              <h3 style={sectionTitle}>Skills</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {skills.map((skill: string) => (
                  <span key={skill} style={{
                    padding: '6px 11px', borderRadius: '999px', background: '#EFF6FF',
                    color: '#1E40AF', fontSize: '12px', fontWeight: 700
                  }}>
                    {skill}
                    {talent.skillLevels?.[skill] ? ` · ${talent.skillLevels[skill]}` : ''}
                  </span>
                ))}
                {(talent.secondarySkills || []).map((skill: string) => (
                  <span key={`s-${skill}`} style={{
                    padding: '6px 11px', borderRadius: '999px', background: '#F1F5F9',
                    color: '#475569', fontSize: '12px', fontWeight: 600
                  }}>
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 style={sectionTitle}>Vetting scores</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(104px, 1fr))', gap: '10px' }}>
              {scoreCards.map(score => (
                <div key={score.label} style={{ ...card, padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>
                    {formatScore(score.value)}
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', marginTop: '3px' }}>
                    {score.label}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {fitCards.length > 0 && (
            <section>
              <h3 style={sectionTitle}>Why they were matched to this role</h3>
              <div style={{ ...card, display: 'grid', gap: '11px' }}>
                {fitCards.map(fit => (
                  <div key={fit.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                      <span>{fit.label}</span>
                      <span style={{ color: '#0F172A' }}>{Math.round(Number(fit.value))}%</span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '999px', background: '#E2E8F0', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(100, Math.max(0, Number(fit.value)))}%`,
                        height: '100%', background: '#2563EB', borderRadius: '999px'
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* The vetting record. This is the part that did not exist: the
              decision on each stage, what it scored, and what the assessor
              wrote. A client being asked to commit to an interview is
              entitled to the reasoning, not just the verdict. */}
          <section>
            <h3 style={sectionTitle}>Vetting record</h3>
            {pipeline.length === 0 ? (
              <div style={{ ...card, fontSize: '13px', color: '#64748B' }}>
                This candidate's vetting stages have not been recorded in detail yet.
                Your account manager can talk you through where they are.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {pipeline.map((stage: any, index: number) => {
                  const tone = stageTone(stage?.status);
                  const completed = formatDate(stage?.completedAt);
                  return (
                    <div key={`${stage?.stageName}-${index}`} style={card}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{
                          width: '22px', height: '22px', borderRadius: '50%', background: '#F1F5F9',
                          color: '#475569', fontSize: '11px', fontWeight: 800,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          {index + 1}
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', flex: 1, minWidth: '140px' }}>
                          {stage?.stageName || `Stage ${index + 1}`}
                        </span>
                        <span style={{
                          padding: '3px 9px', borderRadius: '999px', background: tone.bg,
                          color: tone.fg, fontSize: '11px', fontWeight: 800
                        }}>
                          {tone.label}
                        </span>
                        {Number(stage?.score) > 0 && (
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                            {formatScore(stage.score)}/100
                          </span>
                        )}
                      </div>

                      {(stage?.decision || completed) && (
                        <div style={{ fontSize: '12px', color: '#64748B', marginTop: '8px', fontWeight: 600 }}>
                          {stage?.decision ? `Decision: ${stage.decision}` : ''}
                          {stage?.decision && completed ? ' · ' : ''}
                          {completed ? `Completed ${completed}` : ''}
                        </div>
                      )}

                      {stage?.notes && (
                        <p style={{
                          margin: '10px 0 0 0', padding: '11px 13px', background: '#F8FAFC',
                          borderLeft: '3px solid #CBD5E1', borderRadius: '0 8px 8px 0',
                          fontSize: '13px', lineHeight: 1.6, color: '#334155', whiteSpace: 'pre-wrap'
                        }}>
                          {stage.notes}
                        </p>
                      )}

                      {stage?.interviewRubricScores && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                          {Object.entries(stage.interviewRubricScores).map(([key, value]) => (
                            <span key={key} style={{
                              padding: '3px 8px', borderRadius: '6px', background: '#F1F5F9',
                              color: '#334155', fontSize: '11px', fontWeight: 700, textTransform: 'capitalize'
                            }}>
                              {key}: {formatScore(value)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {experience.length > 0 && (
            <section>
              <h3 style={sectionTitle}>Work history</h3>
              <div style={{ display: 'grid', gap: '10px' }}>
                {experience.map((role: any, index: number) => (
                  <div key={index} style={card}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                      {role.title || role.role || 'Role'}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginTop: '2px' }}>
                      {[role.company, role.duration || [role.startDate, role.endDate].filter(Boolean).join(' – ')]
                        .filter(Boolean).join(' · ')}
                    </div>
                    {role.description && (
                      <p style={{ margin: '8px 0 0 0', fontSize: '13px', lineHeight: 1.6, color: '#334155' }}>
                        {role.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 style={sectionTitle}>Remote working setup</h3>
            <div style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px 20px' }}>
              {remote.map(item => (
                <div key={item.label}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {(talent.portfolioUrl || talent.githubUrl || talent.websiteUrl || talent.certifications) && (
            <section>
              <h3 style={sectionTitle}>Work samples</h3>
              <div style={{ ...card, display: 'grid', gap: '9px' }}>
                {[
                  { label: 'Portfolio', url: talent.portfolioUrl },
                  { label: 'GitHub', url: talent.githubUrl },
                  { label: 'Website', url: talent.websiteUrl }
                ].filter(link => link.url).map(link => (
                  <a
                    key={link.label}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    style={{ fontSize: '13px', fontWeight: 700, color: '#2563EB', textDecoration: 'none' }}
                  >
                    {link.label} ↗
                  </a>
                ))}
                {talent.certifications && (
                  <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.6 }}>
                    <strong style={{ color: '#0F172A' }}>Certifications: </strong>
                    {talent.certifications}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Said plainly, once, so a client does not go hunting for an email
              address and conclude the profile is broken. */}
          <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8', lineHeight: 1.6 }}>
            Kongila handles introductions, so a candidate's contact details stay with us until
            you hire them. Request an interview and we will set it up.
          </p>
        </div>

        {onRequestInterview && (
          <footer style={{
            padding: '16px 28px', background: '#FFFFFF', borderTop: '1px solid #E2E8F0',
            display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0
          }}>
            <button
              onClick={onClose}
              style={{
                padding: '12px 18px', borderRadius: '10px', border: '1px solid #E2E8F0',
                background: '#FFFFFF', fontWeight: 700, fontSize: '13px', color: '#475569', cursor: 'pointer'
              }}
            >
              Close
            </button>
            <button
              onClick={onRequestInterview}
              disabled={interviewDisabled}
              title={interviewDisabled ? interviewDisabledReason : undefined}
              style={{
                flex: 1, padding: '12px 18px', borderRadius: '10px',
                border: interviewLabel && !interviewDisabled ? '1px solid #CBD5E1' : 'none',
                background: interviewDisabled ? '#CBD5E1' : interviewLabel ? '#F1F5F9' : '#2563EB',
                fontWeight: 800, fontSize: '13px',
                color: interviewDisabled ? '#FFFFFF' : interviewLabel ? '#334155' : '#FFFFFF',
                cursor: interviewDisabled ? 'not-allowed' : 'pointer'
              }}
            >
              {interviewDisabled
                ? (interviewDisabledReason || 'Interview unavailable')
                : (interviewLabel || 'Request an interview')}
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}
