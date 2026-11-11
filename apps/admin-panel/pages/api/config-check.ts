import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * What configuration the running server can actually see.
 *
 * "The variables are set" and "the process that is serving this request can
 * read them" are different claims, and only the second one matters. A value
 * present in .env.local proves nothing about a deployment, a value set on one
 * Vercel project proves nothing about the four others pointing at the same
 * repository, and a value added after a build proves nothing until the next
 * one. Every one of those looks identical from the outside: a feature that
 * says it is not configured while you are looking at the configuration.
 *
 * This answers it directly. Open it on whichever deployment is misbehaving
 * and it reports what that server sees.
 *
 * It returns booleans and value lengths. Never a value, never a fragment of
 * one — a diagnostic that leaks a key is a worse problem than the one it was
 * written to solve. Length is included because an empty string and a pasted
 * value with quotes around it both fail in ways that look like absence.
 */

/** Reports presence and shape, never content. */
function describe(name: string): {
  set: boolean;
  length: number;
  looksQuoted: boolean;
  hasWhitespaceEdges: boolean;
} {
  const raw = process.env[name];
  const value = typeof raw === 'string' ? raw : '';
  return {
    set: value.length > 0,
    length: value.length,
    // dotenv strips matching quotes, but a value pasted into a dashboard
    // field keeps them, and then the key sent to the provider is wrong.
    looksQuoted: /^["'].*["']$/.test(value),
    hasWhitespaceEdges: value !== value.trim()
  };
}

const REQUIRED = {
  supabase: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
  email: ['RESEND_API_KEY', 'RESEND_FROM'],
  links: ['NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_ADMIN_URL']
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');

  const groups = Object.fromEntries(
    Object.entries(REQUIRED).map(([group, names]) => [
      group,
      Object.fromEntries(names.map(n => [n, describe(n)]))
    ])
  ) as Record<string, Record<string, ReturnType<typeof describe>>>;

  const missing: string[] = [];
  const suspect: string[] = [];
  for (const names of Object.values(groups)) {
    for (const [name, info] of Object.entries(names)) {
      if (!info.set) missing.push(name);
      else if (info.looksQuoted || info.hasWhitespaceEdges) suspect.push(name);
    }
  }

  const emailReady = groups.email.RESEND_API_KEY.set && groups.email.RESEND_FROM.set;

  return res.status(200).json({
    // Which deployment answered. With several Vercel projects on one
    // repository, this is usually the whole answer.
    deployment: {
      vercel: Boolean(process.env.VERCEL),
      environment: process.env.VERCEL_ENV || 'local',
      branch: process.env.VERCEL_GIT_COMMIT_REF || null,
      commit: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null,
      project: process.env.VERCEL_PROJECT_PRODUCTION_URL || null
    },
    emailReady,
    missing,
    suspect,
    groups,
    meaning: missing.length === 0 && suspect.length === 0
      ? 'This server can see everything it needs. If a feature still says it is not configured, it is not this server answering that request.'
      : missing.length > 0
        ? `This server cannot see: ${missing.join(', ')}. Set them on the Vercel project named above, for the environment named above, then redeploy — a running deployment does not pick up variables added after it was built.`
        : `Set, but malformed: ${suspect.join(', ')}. Quotes or stray spaces are kept by dashboard fields and sent verbatim.`
  });
}
