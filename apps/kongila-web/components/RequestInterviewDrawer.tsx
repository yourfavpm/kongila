import React, { useMemo, useState } from "react";
import { apiFetch } from "../lib/apiFetch";
import { interviewTrail } from "../lib/interviewTrail";
import { InterviewStatusTrail } from "@kongila/ui";
import {
  viewerTimeZone,
  timeZoneOptions,
  generateSlots,
  formatInstantInZone,
  formatForBothParties
} from "@kongila/utils";

/**
 * Asking for an interview with a matched candidate.
 *
 * The modal this replaces presented the request as a booking: four hardcoded
 * time slots in July 2026 — dates already in the past — a Confirm Slot
 * button, and an alert() afterwards saying the candidate had been asked. None
 * of that was true. The client was not booking anything, the candidate had
 * not been asked, and nothing on the screen said what would happen next or
 * who had it.
 *
 * What a client is actually doing here is sending a request to their Kongila
 * team, who put it to the candidate. So the screen says that, shows the
 * journey the request is about to take, and collects the three things
 * operations needs to act on it without a phone call: when, how long, and
 * anything the client wants the candidate to know.
 *
 * The alternatives go in the note rather than in columns of their own. The
 * interviews table holds one time, and operations can send a different one
 * when they put it to the candidate, so a second and third preference are
 * worth having in front of them and not worth a migration.
 */

interface RequestInterviewDrawerProps {
  currentUser: any;
  request: any;
  talent: any;
  matchId?: string;
  interviews: any[];
  onClose: () => void;
  onRequested?: (interview: any) => void;
}

const MAX_PER_PAIR = 3;
const DURATIONS = [30, 45, 60, 90];
const FORMATS: { value: string; label: string; hint: string }[] = [
  { value: 'video', label: 'Video call', hint: 'We send a joining link to both sides' },
  { value: 'phone', label: 'Phone call', hint: 'We arrange the call between you' },
  { value: 'async_video', label: 'Recorded answers', hint: 'The candidate records answers to your questions' }
];

export default function RequestInterviewDrawer({
  currentUser,
  request,
  talent,
  matchId,
  interviews,
  onClose,
  onRequested
}: RequestInterviewDrawerProps) {
  const localTimezone = viewerTimeZone();
  const [timezone, setTimezone] = useState(localTimezone);
  const [format, setFormat] = useState('video');
  const [duration, setDuration] = useState(45);
  const [primary, setPrimary] = useState<string | null>(null);
  const [alternates, setAlternates] = useState<string[]>([]);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // What the server actually saved. The drawer used to close the instant the
  // request went through, with nothing said and nothing shown, so the only
  // difference between "sent" and "nothing happened" was a panel sliding
  // shut. And when it failed it stayed open with the error rendered down
  // inside the scrolling body, below the time picker, where nobody looked —
  // which reads exactly like a form still waiting to be filled in.
  const [sent, setSent] = useState<any | null>(null);

  const talentTimezone = talent?.timezone || talent?.timeZone || null;

  // Generated from today in the zone the client is working in, so the slots
  // on offer are always ahead of now.
  const slots = useMemo(
    () => generateSlots(timezone, { days: 8, hours: [9, 10, 11, 12, 13, 14, 15, 16, 17] }),
    [timezone]
  );

  // A day, then a time on that day.
  //
  // This was one grid of every slot — eight days by nine hours, seventy-odd
  // buttons, each carrying two timezones' worth of text. Picking a Tuesday
  // afternoon meant reading the whole wall to find it. Splitting it in two
  // means one small decision at a time, and the day strip is short enough to
  // take in at a glance.
  const days = useMemo(() => {
    const byDate = new Map<string, { date: string; iso: string; time: string }[]>();
    for (const slot of slots) {
      if (!byDate.has(slot.date)) byDate.set(slot.date, []);
      byDate.get(slot.date)!.push(slot);
    }
    return [...byDate.entries()].map(([date, times]) => ({ date, times }));
  }, [slots]);

  const selectedDay = activeDay && days.some(day => day.date === activeDay)
    ? activeDay
    : days[0]?.date || null;
  const timesForDay = days.find(day => day.date === selectedDay)?.times || [];

  const dayLabel = (date: string) => {
    const parsed = new Date(`${date}T12:00:00Z`);
    return {
      weekday: parsed.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' }),
      day: parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' })
    };
  };

  const clockLabel = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: timezone });

  const chosen = [primary, ...alternates].filter(Boolean) as string[];

  const liveForPair = interviews.filter(iv =>
    String(iv.requestId) === String(request?.id)
    && String(iv.talentId) === String(talent?.id)
    && !['cancelled', 'canceled', 'talent_declined', 'admin_declined', 'declined', 'expired']
      .includes(String(iv.status || '').toLowerCase())
  );
  const atLimit = liveForPair.length >= MAX_PER_PAIR;

  // What is about to happen, drawn with the same component that shows a live
  // interview's progress — so the client sees the journey before they commit
  // to it, not for the first time afterwards.
  const preview = interviewTrail('client_requested', 'client');

  const toggleAlternate = (iso: string) => {
    setAlternates(current =>
      current.includes(iso)
        ? current.filter(value => value !== iso)
        : current.length >= 2 ? current : [...current, iso]
    );
  };

  const submit = async () => {
    if (!primary || submitting) return;
    setError('');
    setSubmitting(true);

    const chosen = slots.find(slot => slot.iso === primary);
    if (!chosen) {
      setError('Pick a time before sending the request.');
      setSubmitting(false);
      return;
    }

    // The alternatives go up as data, not as a sentence. They used to be
    // formatted into the note — "Also works: Tue 24 Nov, 15:00" — so the only
    // way for operations to use them was to read them out of English prose,
    // and nothing else in the product could see them at all.
    const proposedSlots = [chosen.iso, ...alternates];

    try {
      const response = await apiFetch('/api/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: request.id,
          matchId: matchId || `match_${request.id}_${talent.id}`,
          talentId: talent.id,
          talentName: talent.name,
          talentAvatar: talent.avatar || talent.profilePhotoUrl,
          clientName: currentUser?.companyName || currentUser?.name || 'Client',
          title: `Interview: ${talent.name} for ${request.title || request.roleTitle || request.roleDescription || 'Role'}`,
          interviewType: format,
          scheduledTime: chosen.iso,
          timezone,
          clientTimezone: timezone,
          talentTimezone,
          date: chosen.date,
          time: chosen.time,
          durationMinutes: duration,
          proposedSlots,
          notes: note.trim()
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || `The request could not be sent (${response.status}).`);
      }

      onRequested?.(payload.interview);
      setSent(payload.interview || {});
    } catch (err: any) {
      setError(err?.message || 'The request could not be sent.');
    } finally {
      setSubmitting(false);
    }
  };

  const label: React.CSSProperties = {
    fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: '#64748B', margin: '0 0 10px 0'
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Request an interview with ${talent?.name}`}
      style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', justifyContent: 'flex-end' }}
    >
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(3px)' }}
      />

      <aside
        style={{
          position: 'relative', width: '100%', maxWidth: '560px', height: '100%',
          background: '#F8FAFC', boxShadow: '-24px 0 60px rgba(15,23,42,0.18)',
          display: 'flex', flexDirection: 'column',
          animation: 'kongilaDrawerIn 220ms cubic-bezier(0.22, 1, 0.36, 1)'
        }}
      >
        <style>{`
          @keyframes kongilaDrawerIn {
            from { transform: translateX(32px); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
        `}</style>

        <header style={{
          padding: '22px 26px 18px', background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0', flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 800, color: '#0F172A' }}>
                Request an interview
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#475569' }}>
                {talent?.name} · {request?.title || request?.roleTitle || request?.roleDescription || 'your role'}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: '#F1F5F9', border: 'none', borderRadius: '10px', width: '34px',
                height: '34px', cursor: 'pointer', fontSize: '18px', color: '#475569', lineHeight: 1
              }}
            >
              ×
            </button>
          </div>

          <div style={{ marginTop: '16px' }}>
            <InterviewStatusTrail
              steps={preview.steps}
              detail="You pick a time, your Kongila team puts it to the candidate, and it is scheduled once they accept."
            />
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 26px 26px', display: 'grid', gap: '22px' }}>
          {sent ? (
            /* Saved. Said so, with the thing that was saved and what happens
               to it next, instead of a panel quietly sliding shut. */
            <div style={{ display: 'grid', gap: '18px', alignContent: 'start' }}>
              <div style={{
                display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '16px',
                borderRadius: '14px', background: '#ECFDF5', border: '1px solid #A7F3D0'
              }}>
                <span aria-hidden style={{ fontSize: '20px', lineHeight: 1 }}>✓</span>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#065F46' }}>
                    Request sent to your Kongila team
                  </div>
                  <div style={{ fontSize: '13px', color: '#047857', marginTop: '3px', lineHeight: 1.55 }}>
                    {talent?.name} has not been contacted yet. Nothing is in anyone's diary until they accept.
                  </div>
                </div>
              </div>

              <div style={{ padding: '16px', borderRadius: '14px', background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Times you proposed
                </div>
                <ol style={{ margin: '8px 0 0', paddingLeft: '18px', display: 'grid', gap: '4px' }}>
                  {[primary, ...alternates].filter(Boolean).map((iso, index) => (
                    <li key={iso as string} style={{ fontSize: '13.5px', fontWeight: index === 0 ? 800 : 600, color: '#0F172A' }}>
                      {formatInstantInZone(iso as string, timezone)}
                      {index === 0 ? ' · first choice' : ''}
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                  What happens next
                </div>
                <InterviewStatusTrail
                  steps={interviewTrail(sent?.status || 'client_requested', 'client').steps}
                  detail="Your team picks one of your times and puts it to the candidate. You will be emailed the moment they answer, and it appears under Interviews either way."
                />
              </div>
            </div>
          ) : atLimit ? (
            <div style={{
              padding: '16px', background: '#FEF2F2', color: '#B91C1C',
              borderRadius: '12px', fontSize: '13.5px', fontWeight: 600, lineHeight: 1.6
            }}>
              You already have {MAX_PER_PAIR} interview requests open with {talent?.name} on this role.
              Your account manager can help if you need another.
            </div>
          ) : (
            <>
              <section>
                <h3 style={label}>Format</h3>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {FORMATS.map(option => {
                    const active = format === option.value;
                    return (
                      <button
                        key={option.value}
                        onClick={() => setFormat(option.value)}
                        style={{
                          textAlign: 'left', padding: '13px 15px', borderRadius: '12px',
                          border: active ? '2px solid #2563EB' : '1px solid #E2E8F0',
                          background: active ? '#EFF6FF' : '#FFFFFF', cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontSize: '14px', fontWeight: 800, color: active ? '#1D4ED8' : '#0F172A' }}>
                          {option.label}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{option.hint}</div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <h3 style={label}>How long</h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {DURATIONS.map(minutes => {
                    const active = duration === minutes;
                    return (
                      <button
                        key={minutes}
                        onClick={() => setDuration(minutes)}
                        style={{
                          padding: '9px 16px', borderRadius: '999px',
                          border: active ? '2px solid #2563EB' : '1px solid #E2E8F0',
                          background: active ? '#EFF6FF' : '#FFFFFF',
                          color: active ? '#1D4ED8' : '#334155',
                          fontSize: '13px', fontWeight: 700, cursor: 'pointer'
                        }}
                      >
                        {minutes} min
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                  <h3 style={{ ...label, margin: 0 }}>Preferred time</h3>
                  <select
                    value={timezone}
                    onChange={event => {
                      setTimezone(event.target.value);
                      setPrimary(null);
                      setAlternates([]);
                      setActiveDay(null);
                    }}
                    style={{
                      padding: '7px 10px', borderRadius: '9px', border: '1px solid #CBD5E1',
                      fontSize: '12px', cursor: 'pointer', maxWidth: '58%'
                    }}
                  >
                    {timeZoneOptions(localTimezone).map((tz: any) => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                </div>

                {!talentTimezone && (
                  <div style={{
                    padding: '10px 12px', background: '#FFFBEB', border: '1px solid #FDE68A',
                    color: '#92400E', borderRadius: '10px', fontSize: '12px', marginBottom: '10px', lineHeight: 1.5
                  }}>
                    {talent?.name} has not set a timezone, so we cannot show you their local time for these slots.
                  </div>
                )}

                {/* The day. A short strip, one row, scrollable. */}
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '14px' }}>
                  {days.map(day => {
                    const active = selectedDay === day.date;
                    const picks = day.times.filter(slot => chosen.includes(slot.iso)).length;
                    const label = dayLabel(day.date);
                    return (
                      <button
                        key={day.date}
                        onClick={() => setActiveDay(day.date)}
                        style={{
                          flex: '0 0 auto', minWidth: '66px', padding: '10px 6px', borderRadius: '12px',
                          border: active ? '2px solid #2563EB' : '1px solid #E2E8F0',
                          background: active ? '#EFF6FF' : '#FFFFFF',
                          cursor: 'pointer', textAlign: 'center', position: 'relative'
                        }}
                      >
                        <div style={{ fontSize: '11px', fontWeight: 700, color: active ? '#1D4ED8' : '#94A3B8', textTransform: 'uppercase' }}>
                          {label.weekday}
                        </div>
                        <div style={{ fontSize: '13.5px', fontWeight: 800, color: active ? '#1D4ED8' : '#0F172A', marginTop: '2px' }}>
                          {label.day}
                        </div>
                        {picks > 0 && (
                          <span style={{
                            position: 'absolute', top: '6px', right: '7px', width: '6px', height: '6px',
                            borderRadius: '50%', background: '#2563EB'
                          }} />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* The time. Just the clock, in the client's zone — the
                    candidate's local time is shown once underneath for what
                    they have actually picked, rather than on all seventy
                    buttons at once. */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {timesForDay.map(slot => {
                    const isPrimary = primary === slot.iso;
                    const isAlternate = alternates.includes(slot.iso);
                    const full = chosen.length >= 3 && !isPrimary && !isAlternate;
                    return (
                      <button
                        key={slot.iso}
                        disabled={full}
                        onClick={() => {
                          if (isPrimary) { setPrimary(alternates[0] || null); setAlternates(alternates.slice(1)); return; }
                          if (isAlternate) { toggleAlternate(slot.iso); return; }
                          if (!primary) { setPrimary(slot.iso); return; }
                          toggleAlternate(slot.iso);
                        }}
                        style={{
                          padding: '10px 15px', borderRadius: '10px', cursor: full ? 'not-allowed' : 'pointer',
                          border: isPrimary ? '2px solid #2563EB' : isAlternate ? '2px solid #93C5FD' : '1px solid #E2E8F0',
                          background: isPrimary ? '#2563EB' : isAlternate ? '#EFF6FF' : '#FFFFFF',
                          color: isPrimary ? '#FFFFFF' : isAlternate ? '#1D4ED8' : full ? '#CBD5E1' : '#0F172A',
                          fontSize: '13.5px', fontWeight: 700
                        }}
                      >
                        {clockLabel(slot.iso)}
                      </button>
                    );
                  })}
                </div>

                {/* What they have chosen so far, said back to them plainly. */}
                <div style={{
                  marginTop: '14px', padding: '13px 15px', borderRadius: '12px',
                  background: primary ? '#F0F9FF' : '#F8FAFC',
                  border: `1px solid ${primary ? '#BAE6FD' : '#E2E8F0'}`
                }}>
                  {primary ? (
                    <>
                      <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#0369A1', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        First choice
                      </div>
                      <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#0F172A', marginTop: '3px' }}>
                        {formatInstantInZone(primary, timezone)}
                      </div>
                      {(() => {
                        const both = formatForBothParties(primary, timezone, talentTimezone, `${talent?.name}'s time`);
                        return both.other ? (
                          <div style={{ fontSize: '12px', color: '#475569', fontWeight: 600, marginTop: '2px' }}>
                            {both.other}
                          </div>
                        ) : null;
                      })()}

                      {alternates.length > 0 && (
                        <div style={{ marginTop: '11px' }}>
                          <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#0369A1', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                            Also works
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {alternates.map(iso => (
                              <button
                                key={iso}
                                onClick={() => toggleAlternate(iso)}
                                style={{
                                  padding: '5px 10px', borderRadius: '999px', border: '1px solid #BAE6FD',
                                  background: '#FFFFFF', color: '#0F172A', fontSize: '12px', fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                {formatInstantInZone(iso, timezone)} ×
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {alternates.length < 2 && (
                        <p style={{ margin: '11px 0 0', fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                          Tap another time to add a backup. Giving us an alternative is usually the
                          difference between confirming today and going back and forth for a week.
                        </p>
                      )}
                    </>
                  ) : (
                    <p style={{ margin: 0, fontSize: '12.5px', color: '#64748B', lineHeight: 1.55 }}>
                      Pick a day, then a time. You can add up to two backups afterwards.
                    </p>
                  )}
                </div>
              </section>

              <section>
                <h3 style={label}>Anything they should know <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}>(optional)</span></h3>
                <textarea
                  value={note}
                  onChange={event => setNote(event.target.value)}
                  rows={3}
                  placeholder="Who will be on the call, what you want to cover, anything they should prepare."
                  style={{
                    width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #CBD5E1',
                    fontSize: '13.5px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
                    lineHeight: 1.6
                  }}
                />
              </section>

            </>
          )}
        </div>

        <footer style={{
          padding: '15px 26px', background: '#FFFFFF', borderTop: '1px solid #E2E8F0',
          display: 'grid', gap: '11px', flexShrink: 0
        }}>
          {/* Pinned to the footer, not left down in the scrolling body under
              the picker. An error nobody scrolls to is an error nobody sees,
              and a drawer that just sits there looks like it is still
              waiting to be filled in. */}
          {error && !sent && (
            <div role="alert" style={{
              padding: '11px 13px', background: '#FEF2F2', border: '1px solid #FECACA',
              color: '#B91C1C', borderRadius: '10px', fontSize: '12.5px', lineHeight: 1.5
            }}>
              {error}
            </div>
          )}

          {sent ? (
            <button
              onClick={onClose}
              style={{
                padding: '12px 18px', borderRadius: '10px', border: 'none',
                background: '#2563EB', fontWeight: 800, fontSize: '13px',
                color: '#FFFFFF', cursor: 'pointer'
              }}
            >
              Done
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={onClose}
                style={{
                  padding: '12px 18px', borderRadius: '10px', border: '1px solid #E2E8F0',
                  background: '#FFFFFF', fontWeight: 700, fontSize: '13px', color: '#475569', cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!primary || submitting || atLimit}
                style={{
                  flex: 1, padding: '12px 18px', borderRadius: '10px', border: 'none',
                  background: (!primary || submitting || atLimit) ? '#CBD5E1' : '#2563EB',
                  fontWeight: 800, fontSize: '13px', color: '#FFFFFF',
                  cursor: (!primary || submitting || atLimit) ? 'not-allowed' : 'pointer'
                }}
              >
                {submitting ? 'Sending…' : 'Send request to Kongila'}
              </button>
            </div>
          )}
        </footer>
      </aside>
    </div>
  );
}
