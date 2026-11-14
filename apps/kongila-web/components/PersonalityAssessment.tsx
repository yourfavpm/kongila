import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../lib/apiFetch';
import { PERSONALITY_QUESTIONS } from '../lib/personalityQuestions';

const SCALE = [
  { value: 1, label: 'Very inaccurate' },
  { value: 2, label: 'Moderately inaccurate' },
  { value: 3, label: 'Neither' },
  { value: 4, label: 'Moderately accurate' },
  { value: 5, label: 'Very accurate' }
];

export default function PersonalityAssessment({ onClose, onComplete }: {
  onClose: () => void;
  onComplete: (pipeline: any[]) => void;
}) {
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pages = Math.ceil(PERSONALITY_QUESTIONS.length / 10);
  const pageQuestions = useMemo(() => PERSONALITY_QUESTIONS.slice(page * 10, page * 10 + 10), [page]);
  const requestClose = () => {
    if (saving) return;
    if (Object.keys(answers).length > 0 && !window.confirm('Close the assessment? Your unsubmitted answers will be lost.')) return;
    onClose();
  };
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') requestCloseRef.current(); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const unanswered = pageQuestions.some((_, index) => !answers[String(page * 10 + index + 1)]);
  const submit = async () => {
    if (saving || Object.keys(answers).length !== PERSONALITY_QUESTIONS.length) return;
    setSaving(true);
    setError('');
    try {
      const response = await apiFetch('/api/vetting/personality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Your assessment could not be submitted.');
      onComplete(data.pipeline || []);
    } catch (cause: any) {
      setError(cause?.message || 'Your assessment could not be submitted. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="personality-assessment-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) requestClose(); }}>
      <section className="personality-assessment" role="dialog" aria-modal="true" aria-labelledby="personality-title">
        <header className="personality-assessment__header">
          <div>
            <div className="personality-assessment__eyebrow">IPIP-50 · BIG FIVE SELF-REFLECTION</div>
            <h2 id="personality-title">A little about how you see yourself</h2>
            <p>Respond based on how you generally feel or act. There are no right or wrong answers.</p>
          </div>
          <button type="button" className="personality-assessment__close" aria-label="Close assessment" disabled={saving} onClick={requestClose}>×</button>
        </header>

        <div className="personality-assessment__progress" aria-label={`Page ${page + 1} of ${pages}`}>
          <div><span>Part {page + 1} of {pages}</span><strong>{Math.round(((page + 1) / pages) * 100)}%</strong></div>
          <div className="personality-assessment__track"><span style={{ width: `${((page + 1) / pages) * 100}%` }} /></div>
        </div>

        <div className="personality-assessment__scale-hint">How accurately does each statement describe you?</div>
        <div className="personality-assessment__questions">
          {pageQuestions.map((question, index) => {
            const id = String(page * 10 + index + 1);
            return (
              <fieldset className="personality-assessment__question" key={id}>
                <legend><span>{page * 10 + index + 1}</span>{question}</legend>
                <div className="personality-assessment__answers">
                  {SCALE.map(option => (
                    <label className={`personality-assessment__answer ${answers[id] === option.value ? 'is-selected' : ''}`} key={option.value}>
                      <input
                        type="radio"
                        name={`ipip-${id}`}
                        value={option.value}
                        checked={answers[id] === option.value}
                        onChange={() => setAnswers(previous => ({ ...previous, [id]: option.value }))}
                      />
                      <span className="personality-assessment__answer-dot" />
                      <span className="personality-assessment__answer-label">{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>

        <p className="personality-assessment__disclaimer">This profile describes self-reported preferences. It is not a diagnosis or a pass/fail result. Trait scores are normalized response scores, not percentiles or rankings, and are reviewed separately from other assessment scores. IPIP items are public domain.</p>
        {error && <div className="personality-assessment__error" role="alert">{error}</div>}
        <footer className="personality-assessment__footer">
          <button type="button" className="personality-assessment__back" disabled={page === 0 || saving} onClick={() => setPage(current => Math.max(0, current - 1))}>Back</button>
          <div className="personality-assessment__footer-actions">
            <span>{Object.keys(answers).length} of {PERSONALITY_QUESTIONS.length} answered</span>
            {page < pages - 1 ? (
              <button type="button" className="personality-assessment__primary" disabled={unanswered} onClick={() => setPage(current => Math.min(pages - 1, current + 1))}>Continue</button>
            ) : (
              <button type="button" className="personality-assessment__primary" disabled={unanswered || saving} onClick={submit}>{saving ? 'Submitting…' : 'Submit assessment'}</button>
            )}
          </div>
        </footer>
      </section>
      <style jsx>{`
        .personality-assessment-backdrop{position:fixed;inset:0;z-index:10000;background:rgba(12,24,43,.62);display:flex;align-items:center;justify-content:center;padding:20px}
        .personality-assessment{width:min(820px,100%);max-height:min(92vh,920px);overflow:auto;background:#fff;color:#14213d;border:1px solid #e3e9f1;border-radius:20px;box-shadow:0 24px 80px rgba(5,20,40,.25);padding:28px 34px;animation:personality-enter .2s ease-out}
        .personality-assessment__header{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.personality-assessment__eyebrow{font-size:11px;font-weight:800;letter-spacing:.09em;color:#1769c2}.personality-assessment h2{font-size:clamp(22px,3vw,30px);line-height:1.15;margin:9px 0;color:#14213d}.personality-assessment__header p{font-size:14px;line-height:1.55;color:#64748b;margin:0;max-width:620px}.personality-assessment__close{width:38px;height:38px;flex:none;border:1px solid #e5eaf1;border-radius:50%;background:#fff;color:#53647a;font-size:25px;line-height:1;cursor:pointer}.personality-assessment__close:disabled{opacity:.5;cursor:wait}
        .personality-assessment__progress{margin:23px 0 18px}.personality-assessment__progress>div:first-child{display:flex;justify-content:space-between;color:#64748b;font-size:12px;margin-bottom:8px}.personality-assessment__progress strong{color:#14213d}.personality-assessment__track{height:6px;background:#e8eef5;border-radius:9px;overflow:hidden}.personality-assessment__track span{display:block;height:100%;background:#1769c2;transition:width .25s ease}.personality-assessment__scale-hint{font-size:12px;color:#64748b;background:#f6f8fb;padding:10px 12px;border-radius:8px;margin-bottom:7px}
        .personality-assessment__questions{display:flex;flex-direction:column}.personality-assessment__question{margin:0;padding:15px 2px 13px;border:0;border-bottom:1px solid #edf1f6;min-width:0}.personality-assessment__question legend{float:left;width:100%;display:flex;align-items:flex-start;gap:10px;font-size:14px;line-height:1.45;font-weight:650;color:#263850;padding:0 0 12px}.personality-assessment__question legend span{display:inline-flex;align-items:center;justify-content:center;flex:none;width:23px;height:23px;border-radius:7px;background:#f0f5fb;color:#57708d;font-size:11px;font-weight:800}.personality-assessment__answers{clear:both;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.personality-assessment__answer{min-height:40px;border:1px solid #e4eaf1;border-radius:8px;display:flex;align-items:center;justify-content:center;gap:7px;padding:7px 5px;cursor:pointer;color:#596b81;font-size:11px;text-align:center;transition:background .15s,border-color .15s,color .15s}.personality-assessment__answer:hover{border-color:#8eb8e6;background:#f7fbff}.personality-assessment__answer.is-selected{border-color:#1769c2;background:#eff6ff;color:#154f8d;font-weight:750}.personality-assessment__answer input{position:absolute;opacity:0;width:1px;height:1px}.personality-assessment__answer input:focus-visible+.personality-assessment__answer-dot{outline:3px solid #95c4f3;outline-offset:2px}.personality-assessment__answer-dot{width:12px;height:12px;border:1.5px solid #9aaabe;border-radius:50%;flex:none}.personality-assessment__answer.is-selected .personality-assessment__answer-dot{border:4px solid #1769c2;background:#fff}.personality-assessment__answer-label{line-height:1.25}
        .personality-assessment__disclaimer{color:#64748b;background:#f7f9fc;border-left:3px solid #8eb8e6;padding:10px 12px;font-size:11px;line-height:1.5;margin:15px 0 0}.personality-assessment__error{color:#9f2d2d;background:#fff2f1;border:1px solid #ffd5d1;padding:10px 12px;margin-top:12px;border-radius:8px;font-size:13px}.personality-assessment__footer{display:flex;justify-content:space-between;align-items:center;margin-top:18px}.personality-assessment__back,.personality-assessment__primary{min-height:44px;padding:0 18px;border-radius:8px;font-weight:750;cursor:pointer}.personality-assessment__back{border:1px solid #dfe6ee;background:#fff;color:#52647a}.personality-assessment__primary{border:1px solid #1769c2;background:#1769c2;color:#fff}.personality-assessment__primary:disabled{opacity:.45;cursor:not-allowed}.personality-assessment__footer-actions{display:flex;align-items:center;gap:14px}.personality-assessment__footer-actions>span{font-size:12px;color:#64748b}
        @keyframes personality-enter{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){.personality-assessment,.personality-assessment__track span{animation:none;transition:none}}
        @media(max-width:640px){.personality-assessment-backdrop{padding:0;align-items:flex-end}.personality-assessment{width:100%;max-height:96dvh;border-radius:18px 18px 0 0;padding:20px 16px}.personality-assessment__question legend{font-size:13px}.personality-assessment__answers{gap:4px}.personality-assessment__answer{min-height:55px;flex-direction:column;gap:4px;padding:5px 2px}.personality-assessment__answer-label{font-size:9px}.personality-assessment__footer-actions{gap:7px}.personality-assessment__footer-actions>span{font-size:10px}.personality-assessment__back,.personality-assessment__primary{padding:0 12px}}
      `}</style>
    </div>
  );
}
