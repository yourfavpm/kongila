import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser } from '@kongila/database';

/**
 * Drafting the wording of a role, so a client is not staring at an empty box.
 *
 * A client who cannot describe the role in writing still knows exactly who
 * they want, and the brief is what the matching engine scores against — a
 * two-line description produces a two-line shortlist. This turns what they
 * already typed into something a candidate can read, and proposes the skills
 * the matcher needs.
 *
 * Rules it works under:
 *
 *   - It never invents a requirement. The prompt says so, and the client
 *     sees and edits everything before it is saved. An invented "5 years of
 *     Kubernetes" in a brief becomes a filter that silently removes good
 *     candidates, and nobody would ever know it had been made up.
 *   - It only ever sees what the client typed. No candidate data, no other
 *     client's brief, nothing from the database.
 *   - The key stays on the server. OPENAI_API_KEY has no NEXT_PUBLIC_
 *     prefix for that reason; calling this from an API route rather than the
 *     browser is what keeps it out of the bundle.
 *   - Unconfigured is not an error. It returns 503 and says so, the same way
 *     email does, so the form can hide the button instead of offering a
 *     feature that cannot work.
 *
 * POST { kind, roleTitle, seniority?, serviceType?, context?, skills? }
 */

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';

/** What a client may ask for. Anything else is a caller bug, not a prompt. */
const KINDS = new Set(['description', 'responsibilities', 'skills', 'tidy']);

/** Caps what we send, so a pasted novel cannot run up a bill. */
const MAX_CONTEXT = 2000;

export function openAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function instructionFor(kind: string): string {
  switch (kind) {
    case 'responsibilities':
      return 'Write 4 to 6 short bullet points describing what this person will actually do day to day. '
        + 'One line each, starting with a verb. Return only the bullets, one per line, no numbering, no heading.';
    case 'skills':
      return 'Propose 5 to 8 skills a candidate would need. Prefer named tools, languages and practices over '
        + 'vague qualities. Return only a comma-separated list on a single line, nothing else.';
    case 'tidy':
      return 'Rewrite what the client wrote so it reads clearly and professionally. Keep every requirement they '
        + 'stated and do not add any. Keep it to the same length or shorter. Return only the rewritten text.';
    case 'description':
    default:
      return 'Write a single paragraph of 60 to 100 words describing this role for a candidate to read. '
        + 'Say what the role is for and what the person would own. Return only the paragraph.';
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  // Clients write briefs; operations write them on a client's behalf.
  if (actor.kind === 'talent') return res.status(403).json({ error: 'Not authorised' });

  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return res.status(503).json({
      error: 'Drafting is not configured on this deployment. Set OPENAI_API_KEY.',
      configured: false
    });
  }

  const body = (req.body || {}) as Record<string, any>;
  const kind = String(body.kind || 'description');
  if (!KINDS.has(kind)) {
    return res.status(400).json({ error: 'kind must be description, responsibilities, skills or tidy.' });
  }

  const roleTitle = String(body.roleTitle || '').trim();
  if (!roleTitle && kind !== 'tidy') {
    return res.status(422).json({ error: 'Give the role a title first — everything else is written from it.' });
  }

  const context = String(body.context || '').trim().slice(0, MAX_CONTEXT);
  if (kind === 'tidy' && !context) {
    return res.status(422).json({ error: 'There is nothing to tidy up yet.' });
  }

  const facts = [
    roleTitle ? `Role title: ${roleTitle}` : null,
    body.seniority ? `Seniority: ${String(body.seniority).slice(0, 60)}` : null,
    body.serviceType ? `Engagement: ${String(body.serviceType).slice(0, 60)}` : null,
    Array.isArray(body.skills) && body.skills.length
      ? `Skills already listed: ${body.skills.slice(0, 20).join(', ')}`
      : null,
    context ? `What the client wrote:\n${context}` : null
  ].filter(Boolean).join('\n');

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        max_tokens: 500,
        messages: [
          {
            role: 'system',
            content:
              'You help a client describe a role they are hiring for through Kongila, a remote-work '
              + 'hiring platform. Write in plain British English, in the client\'s own voice, for a '
              + 'candidate to read.\n\n'
              + 'Never invent a requirement, a tool, a years-of-experience figure, a salary or a '
              + 'company detail the client has not given you. An invented requirement becomes a filter '
              + 'that removes good candidates and nobody will ever know it was made up. If you have too '
              + 'little to go on, write less rather than filling the gap.\n\n'
              + 'No preamble, no sign-off, no markdown headings, no asterisks. Return only what was asked for.'
          },
          { role: 'user', content: `${instructionFor(kind)}\n\n${facts}` }
        ]
      })
    });

    const payload: any = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail = payload?.error?.message || `The drafting service returned ${response.status}.`;
      console.error('[ai/draft-role] failed:', detail);
      return res.status(502).json({ error: detail });
    }

    const text = String(payload?.choices?.[0]?.message?.content || '').trim();
    if (!text) return res.status(502).json({ error: 'The drafting service returned nothing.' });

    // Skills come back as a line the form can use directly, so the client
    // is not asked to split a sentence into chips themselves.
    if (kind === 'skills') {
      const skills = text
        .replace(/^[-•\s]+/gm, '')
        .split(/[,\n]/)
        .map(skill => skill.trim())
        .filter(Boolean)
        .slice(0, 12);
      return res.status(200).json({ kind, skills, text });
    }

    if (kind === 'responsibilities') {
      const bullets = text
        .split('\n')
        .map(line => line.replace(/^[-•*\d.)\s]+/, '').trim())
        .filter(Boolean)
        .slice(0, 8);
      return res.status(200).json({ kind, bullets, text: bullets.map(b => `• ${b}`).join('\n') });
    }

    return res.status(200).json({ kind, text });
  } catch (error: any) {
    console.error('[ai/draft-role] threw:', error?.message || error);
    return res.status(502).json({ error: 'The drafting service could not be reached.' });
  }
}
