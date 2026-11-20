import { apiFetch } from '../lib/apiFetch';
import React, { useEffect, useMemo, useState } from 'react';
import { GlassCard } from '@kongila/ui';
import { formatDate } from '@kongila/utils';
import { documentToHtml, isHtml, textToHtml } from '@kongila/contracts';

/**
 * Contract templates, as their own module.
 *
 * This used to be a tab inside the contracts screen, which put the wording a
 * contract is made of behind the queue of contracts already made from it.
 * Operators looking for "where do I change what the contract says" did not
 * find it, and the list cleared itself whenever the contracts screen
 * re-synced. It now loads its own data and answers one question: for each
 * service line, what will the client sign and what will the candidate sign.
 *
 * Every service line needs TWO published templates. The client signs a
 * document about the service and the fee; the candidate signs a different
 * one about the work and the pay. A line missing either cannot generate a
 * contract, so the gaps are shown as gaps rather than as an empty table.
 */

const SERVICE_LINES: { key: string; label: string; blurb: string }[] = [
  { key: 'placement', label: 'Direct Hire / Placement', blurb: 'One-off placement fee, then the client employs directly.' },
  { key: 'outsourcing', label: 'Talent Outsourcing', blurb: 'Kongila contracts the talent and bills the client monthly.' },
  { key: 'managed_workforce', label: 'Managed Workforce', blurb: 'A team of seats, managed and billed per seat.' },
  { key: 'project', label: 'Project Execution', blurb: 'A deliverable, billed against milestones.' }
];

const AUDIENCES: { key: 'client' | 'talent'; label: string; note: string }[] = [
  { key: 'client', label: 'Client contract', note: 'Signed by the client. Carries the service fee.' },
  { key: 'talent', label: 'Candidate contract', note: 'Signed by the candidate. Carries the pay, never the margin.' }
];

const EMPTY_FORM = { id: '', name: '', serviceType: 'placement', audience: 'client', body: '', version: 1, status: 'draft' };

export default function TemplatesManager({ permissions = [] }: any) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [tokens, setTokens] = useState<any[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string[]>([]);
  const [busy, setBusy] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [showEditor, setShowEditor] = useState(false);
  const [preview, setPreview] = useState<any | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [editorPreview, setEditorPreview] = useState(false);

  const canEdit = (permissions || []).includes('contracts.manage');

  const load = async () => {
    try {
      const response = await apiFetch('/api/contracts/templates');
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not load contract templates.');
      setTemplates(body.templates || []);
      setTokens(body.tokens || []);
      setLoadError('');
    } catch (error: any) {
      setLoadError(error?.message || 'Could not load contract templates.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  /**
   * Templates keyed by service line and audience, published first.
   *
   * A line can hold several: one published, older ones archived, a draft
   * being worked on. The card shows the published one and counts the rest.
   */
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const template of templates) {
      const line = String(template.serviceType || 'any');
      const audience = String(template.audience || 'client');
      const key = `${line}:${audience}`;
      (map[key] = map[key] || []).push(template);
    }
    const rank = (status: string) => ({ published: 0, draft: 1, archived: 2 } as any)[String(status).toLowerCase()] ?? 3;
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => rank(a.status) - rank(b.status) || Number(b.version || 0) - Number(a.version || 0));
    }
    return map;
  }, [templates]);

  const unassigned = useMemo(
    () => templates.filter(t => !SERVICE_LINES.some(line => line.key === String(t.serviceType))),
    [templates]
  );

  const gaps = useMemo(() => {
    const missing: string[] = [];
    for (const line of SERVICE_LINES) {
      for (const audience of AUDIENCES) {
        const rows = grouped[`${line.key}:${audience.key}`] || [];
        if (!rows.some(row => String(row.status).toLowerCase() === 'published')) {
          missing.push(`${line.label} — ${audience.label.toLowerCase()}`);
        }
      }
    }
    return missing;
  }, [grouped]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const post = async (payload: any, failure: string) => {
    const response = await apiFetch('/api/contracts/templates', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error || failure);
    return body;
  };

  const restoreDefaults = async () => {
    setBusy('restore'); setNotice([]);
    try {
      const body = await post({ action: 'restoreDefaults' }, 'The templates were not restored.');
      await load();
      const lines: string[] = [];
      if (body.created?.length) lines.push(`Restored: ${body.created.join(', ')}.`);
      if (body.skipped?.length) lines.push(`Left alone, because they already exist: ${body.skipped.join(', ')}.`);
      lines.push(...(body.warnings || []));
      setNotice(lines);
    } catch (error: any) {
      setNotice([error?.message || 'The templates were not restored.']);
    } finally { setBusy(''); }
  };

  const publish = async (template: any) => {
    const confirmed = window.confirm(
      `Publish "${template.name}"?\n\n`
      + 'Every contract generated for this service line, for this party, will be made from it. '
      + 'Whatever is published for the same line and party now will be archived. '
      + 'Make sure the wording has been reviewed.'
    );
    if (!confirmed) return;
    setBusy(template.id); setNotice([]);
    try {
      const body = await post({ action: 'publish', id: template.id }, 'That template was not published.');
      await load();
      setNotice([`"${template.name}" is published.`, ...(body.warnings || [])]);
    } catch (error: any) {
      setNotice([error?.message || 'That template was not published.']);
    } finally { setBusy(''); }
  };

  const archive = async (template: any) => {
    const published = String(template.status).toLowerCase() === 'published';
    const confirmed = window.confirm(
      `Archive "${template.name}"?\n\n`
      + (published
        ? 'It is the published template, so this service line will have nothing to generate from until another is published. '
        : '')
      + 'Contracts already generated keep their own copy of the wording and are not affected.'
    );
    if (!confirmed) return;
    setBusy(template.id); setNotice([]);
    try {
      const body = await post({ action: 'archive', id: template.id }, 'That template was not archived.');
      await load();
      setNotice([`"${template.name}" is archived.`, ...(body.warnings || [])]);
    } catch (error: any) {
      setNotice([error?.message || 'That template was not archived.']);
    } finally { setBusy(''); }
  };

  const duplicate = (template: any) => {
    setForm({
      id: '', name: `${template.name} (copy)`, serviceType: template.serviceType || 'placement',
      audience: template.audience || 'client', body: template.body || '', version: 1, status: 'draft'
    });
    setShowEditor(true);
  };

  /**
   * Placeholders nothing will fill.
   *
   * The server refuses these too. Saying so here saves the round trip and,
   * more to the point, catches it before somebody publishes a document that
   * would reach a client with literal {{text}} in it.
   */
  const unknownTokensIn = (body: string) => {
    const known = new Set(tokens.map((token: any) => token.token));
    if (known.size === 0) return [];
    const unknown = new Set<string>();
    for (const match of String(body || '').matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)) {
      const token = String(match[1]).toLowerCase();
      if (!known.has(token)) unknown.add(token);
    }
    return [...unknown];
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const unknown = unknownTokensIn(form.body);
    if (unknown.length > 0 && form.status === 'published') {
      window.alert(
        `This template uses ${unknown.length === 1 ? 'a placeholder' : 'placeholders'} nothing will `
        + `fill in: ${unknown.map(t => `{{${t}}}`).join(', ')}. A contract would go out with that text in it.`);
      return;
    }
    setSaving(true);
    try {
      await post({
        id: form.id || undefined,
        name: form.name,
        serviceType: form.serviceType,
        audience: form.audience,
        body: form.body,
        status: form.status
      }, 'That template was not saved.');
      await load();
      setShowEditor(false);
      setNotice([`"${form.name}" saved.`]);
    } catch (error: any) {
      window.alert(error?.message || 'That template was not saved.');
    } finally { setSaving(false); }
  };

  // ── Rendering ──────────────────────────────────────────────────────────────

  const statusChipColour = (status: string) => {
    const key = String(status).toLowerCase();
    if (key === 'published') return { bg: '#ECFDF5', fg: '#065F46', border: '#A7F3D0' };
    if (key === 'archived') return { bg: '#F1F5F9', fg: '#475569', border: '#CBD5E1' };
    return { bg: '#FFFBEB', fg: '#92400E', border: '#FDE68A' };
  };

  const templateRow = (template: any) => {
    const colour = statusChipColour(template.status);
    return (
      <div key={template.id} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        padding: '10px 12px', borderRadius: 8, background: 'var(--bg-secondary)',
        border: '1px solid var(--border-glass)', flexWrap: 'wrap'
      }}>
        <div style={{ minWidth: 200, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{template.name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
            v{template.version} · updated {formatDate(template.updatedAt)}
            {template.updatedBy ? ` · by ${template.updatedBy}` : ''}
          </div>
        </div>
        <span style={{
          padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
          background: colour.bg, color: colour.fg, border: `1px solid ${colour.border}`
        }}>{String(template.status).toLowerCase()}</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setPreview(template)} className="btn-secondary"
            style={{ padding: '4px 10px', fontSize: 11, borderRadius: 6 }}>Preview</button>
          {canEdit && (
            <>
              <button type="button" onClick={() => { setForm({ ...EMPTY_FORM, ...template }); setShowEditor(true); }}
                className="btn-secondary" style={{ padding: '4px 10px', fontSize: 11, borderRadius: 6 }}>Edit</button>
              <button type="button" onClick={() => duplicate(template)} className="btn-secondary"
                style={{ padding: '4px 10px', fontSize: 11, borderRadius: 6 }}>Duplicate</button>
              {String(template.status).toLowerCase() !== 'published' && (
                <button type="button" onClick={() => publish(template)} disabled={busy === template.id}
                  style={{
                    padding: '4px 12px', fontSize: 11, borderRadius: 6, border: 'none',
                    background: 'var(--kongila-blue)', color: '#fff', fontWeight: 700,
                    cursor: busy === template.id ? 'wait' : 'pointer'
                  }}>{busy === template.id ? 'Publishing…' : 'Publish'}</button>
              )}
              {String(template.status).toLowerCase() !== 'archived' && (
                <button type="button" onClick={() => archive(template)} disabled={busy === template.id}
                  className="btn-secondary" style={{ padding: '4px 10px', fontSize: 11, borderRadius: 6 }}>Archive</button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const slot = (line: { key: string; label: string }, audience: { key: string; label: string; note: string }) => {
    const all = grouped[`${line.key}:${audience.key}`] || [];
    const rows = showArchived ? all : all.filter(row => String(row.status).toLowerCase() !== 'archived');
    const archivedCount = all.length - all.filter(row => String(row.status).toLowerCase() !== 'archived').length;
    const hasPublished = all.some(row => String(row.status).toLowerCase() === 'published');

    return (
      <div key={audience.key} style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>{audience.label}</span>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{audience.note}</span>
          {!hasPublished && (
            <span style={{
              fontSize: 11, fontWeight: 700, color: '#92400E', background: '#FFFBEB',
              border: '1px solid #FDE68A', borderRadius: 999, padding: '1px 8px'
            }}>Nothing published</span>
          )}
        </div>
        {rows.length === 0 ? (
          <div style={{
            padding: '12px', borderRadius: 8, border: '1px dashed var(--border-glass)',
            fontSize: 12, color: 'var(--text-muted)', display: 'flex',
            justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap'
          }}>
            <span>
              No {audience.key === 'talent' ? 'candidate' : 'client'} template for this service line.
              Contracts cannot be generated for it.
              {archivedCount > 0 ? ` ${archivedCount} archived.` : ''}
            </span>
            {canEdit && (
              <button type="button" className="btn-secondary" style={{ padding: '4px 10px', fontSize: 11, borderRadius: 6 }}
                onClick={() => {
                  setForm({ ...EMPTY_FORM, serviceType: line.key, audience: audience.key, name: `${line.label} — ${audience.label}` });
                  setShowEditor(true);
                }}>Write one</button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{rows.map(templateRow)}</div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ maxWidth: 620 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Contract templates</h1>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            The wording every contract is generated from. Each service line needs two published
            templates: one the client signs, one the candidate signs. Editing a published template
            raises its version; contracts already signed keep the wording they were made with.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={showArchived} onChange={event => setShowArchived(event.target.checked)} />
            Show archived
          </label>
          {canEdit && (
            <>
              <button type="button" onClick={restoreDefaults} disabled={busy === 'restore'} className="btn-secondary"
                style={{ fontSize: 13, height: 36, padding: '0 16px', borderRadius: 8 }}>
                {busy === 'restore' ? 'Restoring…' : 'Restore standard set'}
              </button>
              <button type="button" onClick={() => { setForm(EMPTY_FORM); setShowEditor(true); }} className="btn-primary"
                style={{ fontSize: 13, height: 36, padding: '0 16px', borderRadius: 8 }}>+ New template</button>
            </>
          )}
        </div>
      </div>

      {loadError && (
        <div role="alert" style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', borderRadius: 10, padding: 12, marginBottom: 14 }}>
          {loadError}
        </div>
      )}

      {notice.length > 0 && (
        <div role="status" style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 10, padding: '12px 14px', marginBottom: 14, color: '#075985', fontSize: 13, lineHeight: 1.6 }}>
          {notice.map((line, index) => <div key={index}>{line}</div>)}
          <button type="button" onClick={() => setNotice([])} className="btn-secondary" style={{ marginTop: 8, padding: '4px 10px', fontSize: 11 }}>Dismiss</button>
        </div>
      )}

      {!loading && gaps.length > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 14px', marginBottom: 18, color: '#92400E', fontSize: 12.5, lineHeight: 1.6 }}>
          <strong>{gaps.length} of 8 documents {gaps.length === 1 ? 'is' : 'are'} not published.</strong>{' '}
          A contract cannot be generated for a service line until both its documents are published:{' '}
          {gaps.join('; ')}.
          {templates.length === 0 ? ' Restore the standard set to start from the shipped wording.' : ''}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading templates…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {SERVICE_LINES.map(line => (
            <GlassCard key={line.key} style={{ padding: 18 }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{line.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{line.blurb}</div>
              </div>
              {AUDIENCES.map(audience => slot(line, audience))}
            </GlassCard>
          ))}

          {unassigned.length > 0 && (
            <GlassCard style={{ padding: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Not tied to a service line</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 14px' }}>
                These are used only when the service line they are needed for has nothing published.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{unassigned.map(templateRow)}</div>
            </GlassCard>
          )}
        </div>
      )}

      {preview && (
        <div className="modal-overlay" onClick={event => { if (event.target === event.currentTarget) setPreview(null); }}>
          <div className="modal-content" style={{ padding: 28, maxWidth: 820, width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12 }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{preview.name}</h2>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                  v{preview.version} · {String(preview.status).toLowerCase()} ·{' '}
                  {String(preview.audience || 'client') === 'talent' ? 'signed by the candidate' : 'signed by the client'}
                </div>
              </div>
              <button type="button" onClick={() => setPreview(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 10 }}>
              Laid out as the contract will be. Placeholders are shown as they are written; they are
              filled in from the offer and the fee rules when a contract is generated.
            </div>
            {/* Safe by construction: documentToHtml re-renders from the
                parsed blocks, so only the documented subset can ever reach
                here. A body carrying a script tag renders without it
                because the parser never produced one. */}
            <div
              className="kongila-document"
              style={{
                maxHeight: '58vh', overflow: 'auto', background: '#FFFFFF',
                border: '1px solid var(--border-glass)', borderRadius: 8, padding: '22px 26px',
                fontSize: 13, lineHeight: 1.65, color: '#14213D'
              }}
              dangerouslySetInnerHTML={{ __html: documentToHtml(preview.body || '') }}
            />
          </div>
        </div>
      )}

      {showEditor && (
        <div className="modal-overlay" onClick={event => { if (event.target === event.currentTarget) setShowEditor(false); }}>
          <div className="modal-content" style={{ padding: 32, maxWidth: 840, width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>{form.id ? `Edit template (v${form.version})` : 'New template'}</h2>
              <button type="button" onClick={() => setShowEditor(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
            </div>
            <form onSubmit={save}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
                <div>
                  <label className="form-label">Name</label>
                  <input type="text" className="kongila-input" value={form.name} required
                    onChange={event => setForm({ ...form, name: event.target.value })}
                    style={{ width: '100%', padding: 10, borderRadius: 8 }} />
                </div>
                <div>
                  <label className="form-label">Service line</label>
                  <select className="kongila-input" value={form.serviceType}
                    onChange={event => setForm({ ...form, serviceType: event.target.value })}
                    style={{ width: '100%', padding: 10, borderRadius: 8 }}>
                    {SERVICE_LINES.map(line => <option key={line.key} value={line.key}>{line.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Signed by</label>
                  <select className="kongila-input" value={form.audience}
                    onChange={event => setForm({ ...form, audience: event.target.value })}
                    style={{ width: '100%', padding: 10, borderRadius: 8 }}>
                    <option value="client">The client</option>
                    <option value="talent">The candidate</option>
                  </select>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.5 }}>
                    Sending either party the other's document is how a candidate learns the margin.
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label className="form-label">Body</label>
                {tokens.length > 0 && (
                  <details style={{ marginBottom: 8 }}>
                    <summary style={{ fontSize: 12, color: 'var(--kongila-blue)', cursor: 'pointer', fontWeight: 600 }}>
                      Placeholders you can use ({tokens.length})
                    </summary>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {tokens.map((token: any) => (
                        <button key={token.token} type="button" title={`${token.label} — e.g. ${token.example}`}
                          onClick={() => setForm({ ...form, body: `${form.body}{{${token.token}}}` })}
                          style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border-glass)', background: 'var(--bg-secondary)', fontSize: 11, fontFamily: 'monospace', cursor: 'pointer' }}>
                          {`{{${token.token}}}`}
                        </button>
                      ))}
                    </div>
                  </details>
                )}
                <p style={{ fontSize: 12, color: '#64748B', marginTop: 0 }}>
                  Only publish wording that has been reviewed. The shipped drafts are a clause set and
                  a structure, not legal advice.
                </p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => setEditorPreview(value => !value)}
                    className="btn-secondary" style={{ padding: '4px 12px', fontSize: 11.5, borderRadius: 6 }}>
                    {editorPreview ? 'Edit the markup' : 'Preview'}
                  </button>
                  {!isHtml(form.body || '') && String(form.body || '').trim() && (
                    <button type="button"
                      onClick={() => setForm({ ...form, body: textToHtml(form.body) })}
                      className="btn-secondary" style={{ padding: '4px 12px', fontSize: 11.5, borderRadius: 6 }}>
                      Convert to formatted HTML
                    </button>
                  )}
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {isHtml(form.body || '') ? 'Formatted' : 'Plain text'} ·{' '}
                    headings, paragraphs, lists, tables, bold and rules. Anything else is ignored.
                  </span>
                </div>

                {editorPreview ? (
                  <div
                    className="kongila-document"
                    style={{
                      minHeight: 320, maxHeight: '46vh', overflow: 'auto', background: '#FFFFFF',
                      border: '1px solid var(--border-glass)', borderRadius: 8, padding: '20px 24px',
                      fontSize: 13, lineHeight: 1.65, color: '#14213D'
                    }}
                    dangerouslySetInnerHTML={{ __html: documentToHtml(form.body || '') }}
                  />
                ) : (
                  <textarea className="kongila-input" rows={16} value={form.body} required
                    onChange={event => setForm({ ...form, body: event.target.value })}
                    style={{ width: '100%', padding: 12, borderRadius: 8, fontFamily: 'monospace', fontSize: 13 }} />
                )}
                {unknownTokensIn(form.body).length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 10px' }}>
                    Nothing will fill in {unknownTokensIn(form.body).map(t => `{{${t}}}`).join(', ')}. It would
                    reach the signer as written.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={form.status === 'published'}
                    onChange={event => setForm({ ...form, status: event.target.checked ? 'published' : 'draft' })} />
                  Publish — contracts for this line and party will be generated from it
                </label>
                <div style={{ flex: 1 }} />
                <button type="button" className="btn-secondary" onClick={() => setShowEditor(false)} style={{ padding: '8px 18px', borderRadius: 8 }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ padding: '8px 24px', borderRadius: 8 }}>
                  {saving ? 'Saving…' : 'Save template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
