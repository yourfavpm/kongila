import crypto from 'crypto';

/**
 * Signed team invitations.
 *
 * The invite link used to carry orgId and permissionLevel as plain query
 * parameters, and signup wrote both straight into client_profiles. Anyone who
 * knew or guessed an organisation id could join it at Full Access by editing
 * the URL.
 *
 * The link now carries one opaque token. Its contents are readable, which is
 * fine, but they cannot be changed without the secret, and it stops working
 * after a week.
 *
 * Server-side only. Do not import this into a component: it reads a secret
 * and uses node crypto.
 */

export interface InvitePayload {
  orgId: string;
  email: string;
  permissionLevel: string;
  name?: string;
  jobTitle?: string;
  /** Unix seconds. */
  exp: number;
}

const DEFAULT_TTL_DAYS = 7;

function getSecret(): string {
  const secret = process.env.INVITE_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    // Deliberately fatal. A missing secret must not fall back to an
    // unsigned or predictably signed token.
    throw new Error(
      'INVITE_TOKEN_SECRET is not set, or is shorter than 32 characters. ' +
        'Team invitations cannot be issued or accepted without it.'
    );
  }
  return secret;
}

function hmac(body: string): string {
  return crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
}

export function signInvite(
  payload: Omit<InvitePayload, 'exp'>,
  ttlDays: number = DEFAULT_TTL_DAYS
): string {
  const full: InvitePayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlDays * 24 * 60 * 60
  };
  const body = Buffer.from(JSON.stringify(full)).toString('base64url');
  return `${body}.${hmac(body)}`;
}

export type VerifyResult =
  | { ok: true; payload: InvitePayload }
  | { ok: false; reason: string };

export function verifyInvite(token: unknown): VerifyResult {
  if (typeof token !== 'string' || !token.includes('.')) {
    return { ok: false, reason: 'This invitation link is not valid.' };
  }

  const [body, signature] = token.split('.');
  if (!body || !signature) {
    return { ok: false, reason: 'This invitation link is not valid.' };
  }

  const expected = hmac(body);
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  // Constant-time compare so the endpoint cannot be used as an oracle.
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    return { ok: false, reason: 'This invitation link is not valid.' };
  }

  let payload: InvitePayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'This invitation link is not valid.' };
  }

  if (!payload?.orgId || !payload?.email || !payload?.permissionLevel) {
    return { ok: false, reason: 'This invitation link is not valid.' };
  }

  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: 'This invitation has expired. Ask for a new one.' };
  }

  return { ok: true, payload };
}
