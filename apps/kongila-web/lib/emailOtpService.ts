import {
  EMAIL_OTP_MAX_ATTEMPTS,
  EMAIL_OTP_MAX_SENDS_PER_HOUR,
  EMAIL_OTP_RESEND_COOLDOWN_SECONDS,
  EMAIL_OTP_TTL_MINUTES,
  emailOtpMatches,
  generateEmailOtp,
  hashEmailOtp,
  hashEmailOtpRateLimitBucket,
  isValidEmail,
  normalizeEmail,
  type EmailOtpPurpose
} from '@kongila/database';
import { getSupabaseClient } from '@kongila/database';
import { emailConfigurationMissing, emailIsConfigured, sendEmail } from '@kongila/notifications';

type ServiceResult = {
  ok: boolean;
  status: number;
  error?: string;
  message?: string;
  userId?: string;
};

const GENERIC_OTP_MESSAGE =
  'If the address is eligible, a six-digit code is on its way. Check your inbox and spam folder.';

function otpSecret(): string {
  const secret = process.env.OTP_HASH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('OTP_HASH_SECRET must be set to a random value of at least 32 characters.');
  }
  return secret;
}

function validPurpose(value: unknown): value is EmailOtpPurpose {
  return value === 'signup' || value === 'password_reset';
}

function fail(status: number, error: string): ServiceResult {
  return { ok: false, status, error };
}

async function findApplicationUser(email: string): Promise<{ id: string } | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('[auth-email-otp] account lookup failed:', error.message);
    throw new Error('Could not check the account. Please try again.');
  }
  return data;
}

export async function sendEmailOtp(input: {
  email: unknown;
  purpose: unknown;
  ipAddress: string;
}): Promise<ServiceResult> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) return fail(400, 'Enter a valid email address.');
  if (!validPurpose(input.purpose)) return fail(400, 'Unsupported verification request.');
  if (!emailIsConfigured()) {
    const missing = emailConfigurationMissing();
    console.error(`[auth-email-otp] email sender is missing ${missing.join(', ')} on this web deployment.`);
    return fail(503, `Email verification is unavailable on this web deployment. Missing: ${missing.join(', ')}. Check this app's /api/config-check and redeploy after correcting its server environment.`);
  }

  let secret: string;
  try {
    secret = otpSecret();
  } catch (error) {
    console.error('[auth-email-otp] OTP secret configuration error:', (error as Error).message);
    return fail(503, 'Email verification is not configured. Contact support.');
  }

  try {
    const supabase = getSupabaseClient();
    const rateLimitAt = new Date();
    const { data: ipAllowed, error: ipLimitError } = await supabase.rpc(
      'consume_auth_email_otp_ip_limit',
      {
        p_ip_hash: hashEmailOtpRateLimitBucket(input.ipAddress, secret),
        p_now: rateLimitAt.toISOString(),
        p_limit: 20,
        p_window_seconds: 3600
      }
    );
    if (ipLimitError) {
      console.error('[auth-email-otp] IP rate limit failed:', ipLimitError.message);
      return fail(503, 'Email verification is unavailable. Apply the email OTP migration and try again.');
    }
    if (!ipAllowed) return fail(429, 'Too many codes were requested. Try again later.');

    const user = await findApplicationUser(email);
    const shouldSend = input.purpose === 'signup' ? !user : Boolean(user);
    if (!shouldSend) return { ok: true, status: 200, message: GENERIC_OTP_MESSAGE };

    const now = new Date();
    const nowIso = now.toISOString();
    const { data: existing, error: lookupError } = await supabase
      .from('auth_email_otp_challenges')
      .select('id, send_count, send_window_started_at, last_sent_at')
      .eq('email', email)
      .eq('purpose', input.purpose)
      .maybeSingle();

    if (lookupError) {
      console.error('[auth-email-otp] challenge lookup failed:', lookupError.message);
      return fail(503, 'Email verification storage is unavailable. Apply the email OTP migration and try again.');
    }

    if (existing?.last_sent_at) {
      const lastSentAt = new Date(existing.last_sent_at).getTime();
      if (Number.isFinite(lastSentAt)
        && now.getTime() - lastSentAt < EMAIL_OTP_RESEND_COOLDOWN_SECONDS * 1000) {
        return fail(429, 'Please wait one minute before requesting another code.');
      }
    }

    const windowStartedAt = existing?.send_window_started_at
      ? new Date(existing.send_window_started_at)
      : now;
    const withinWindow = Number.isFinite(windowStartedAt.getTime())
      && now.getTime() - windowStartedAt.getTime() < 60 * 60 * 1000;
    const sendCount = withinWindow ? Number(existing?.send_count || 0) : 0;
    if (sendCount >= EMAIL_OTP_MAX_SENDS_PER_HOUR) {
      return fail(429, 'Too many codes were requested. Try again in an hour.');
    }

    const code = generateEmailOtp();
    const codeHash = hashEmailOtp(email, input.purpose, code, secret);
    const expiresAt = new Date(now.getTime() + EMAIL_OTP_TTL_MINUTES * 60 * 1000).toISOString();
    const nextWindowStart = withinWindow ? windowStartedAt.toISOString() : nowIso;
    const { error: saveError } = await supabase
      .from('auth_email_otp_challenges')
      .upsert({
        id: existing?.id,
        email,
        purpose: input.purpose,
        code_hash: codeHash,
        attempts: 0,
        send_window_started_at: nextWindowStart,
        send_count: sendCount + 1,
        last_sent_at: nowIso,
        expires_at: expiresAt,
        consumed_at: null,
        created_at: existing?.id ? undefined : nowIso,
        updated_at: nowIso
      }, { onConflict: 'email,purpose' });

    if (saveError) {
      console.error('[auth-email-otp] challenge save failed:', saveError.message);
      return fail(503, 'Could not start email verification. Apply the email OTP migration and try again.');
    }

    const isSignup = input.purpose === 'signup';
    const sent = await sendEmail({
      to: email,
      subject: isSignup ? 'Verify your Kongila email' : 'Your Kongila password reset code',
      body: `Your Kongila ${isSignup ? 'email verification' : 'password reset'} code is:\n\n${code}\n\n`
        + `This code expires in ${EMAIL_OTP_TTL_MINUTES} minutes and can only be used once. `
        + 'If you did not request it, you can ignore this email.',
      html: `<p>Use this six-digit code to ${isSignup ? 'verify your email address' : 'reset your password'}:</p>`
        + `<p style="font-size:32px;font-weight:800;letter-spacing:8px;color:#0047CC">${code}</p>`
        + `<p>This code expires in ${EMAIL_OTP_TTL_MINUTES} minutes and can only be used once. `
        + 'If you did not request it, you can ignore this email.</p>'
    });

    if (!sent.success) {
      const { error: invalidateError } = await supabase
        .from('auth_email_otp_challenges')
        .update({ consumed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('email', email)
        .eq('purpose', input.purpose)
        .eq('code_hash', codeHash);
      if (invalidateError) {
        console.error('[auth-email-otp] could not invalidate unsent code:', invalidateError.message);
      }
      return fail(502, sent.error || 'The email provider did not accept the message. Please try again.');
    }

    return { ok: true, status: 200, message: GENERIC_OTP_MESSAGE };
  } catch (error) {
    console.error('[auth-email-otp] could not send code:', (error as Error).message);
    return fail(500, 'Could not send the verification code. Please try again.');
  }
}

async function consumeEmailOtp(email: string, purpose: EmailOtpPurpose, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  const supabase = getSupabaseClient();
  const { data: challenge, error: lookupError } = await supabase
    .from('auth_email_otp_challenges')
    .select('id, code_hash, expires_at, attempts, consumed_at')
    .eq('email', email)
    .eq('purpose', purpose)
    .maybeSingle();

  if (lookupError) {
    console.error('[auth-email-otp] challenge lookup failed:', lookupError.message);
    throw new Error('Could not verify the code. Please request a new one.');
  }

  if (!challenge || challenge.consumed_at
    || new Date(challenge.expires_at).getTime() <= Date.now()
    || Number(challenge.attempts) >= EMAIL_OTP_MAX_ATTEMPTS) {
    return false;
  }

  const secret = otpSecret();
  const matches = emailOtpMatches(email, purpose, code, secret, String(challenge.code_hash || ''));
  if (!matches) {
    const { error: attemptError } = await supabase
      .from('auth_email_otp_challenges')
      .update({
        attempts: Number(challenge.attempts) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', challenge.id)
      .eq('attempts', challenge.attempts)
      .is('consumed_at', null);
    if (attemptError) {
      console.error('[auth-email-otp] failed-attempt count update failed:', attemptError.message);
    }
    return false;
  }

  const now = new Date().toISOString();
  const { data: consumed, error: consumeError } = await supabase
    .from('auth_email_otp_challenges')
    .update({ consumed_at: now, updated_at: now })
    .eq('id', challenge.id)
    .eq('code_hash', challenge.code_hash)
    .eq('attempts', challenge.attempts)
    .is('consumed_at', null)
    .gt('expires_at', now)
    .lt('attempts', EMAIL_OTP_MAX_ATTEMPTS)
    .select('id')
    .maybeSingle();

  if (consumeError) {
    console.error('[auth-email-otp] code consumption failed:', consumeError.message);
    throw new Error('Could not verify the code. Please request a new one.');
  }
  return Boolean(consumed);
}

export async function createAccountWithEmailOtp(input: {
  email: unknown;
  code: unknown;
  password: unknown;
  role: unknown;
  name: unknown;
  companyName?: unknown;
}): Promise<ServiceResult> {
  const email = normalizeEmail(input.email);
  const code = String(input.code || '').trim();
  const password = String(input.password || '');
  const name = String(input.name || '').trim();
  const role = String(input.role || '');
  const companyName = String(input.companyName || '').trim();

  if (!isValidEmail(email)) return fail(400, 'Enter a valid email address.');
  if (!/^\d{6}$/.test(code)) return fail(400, 'Enter the six-digit code from your email.');
  if (password.length < 8) return fail(400, 'Use a password with at least 8 characters.');
  if (name.length < 2 || name.length > 200) return fail(400, 'Enter your name.');
  if (role !== 'client' && role !== 'talent') return fail(400, 'Only client and talent accounts can be created here.');
  if (companyName.length > 200) return fail(400, 'Company name is too long.');

  try {
    const existing = await findApplicationUser(email);
    if (existing) return fail(409, 'This email already has an account. Sign in or reset your password.');

    const verified = await consumeEmailOtp(email, 'signup', code);
    if (!verified) return fail(400, 'That code is invalid or expired. Request a new code and try again.');

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        role,
        ...(role === 'client' && companyName ? { company_name: companyName } : {})
      }
    });

    if (error || !data?.user) {
      console.error('[auth-email-otp] verified account creation failed:', error?.message || 'No user returned');
      return fail(409, 'The account could not be created. If you already registered, sign in or reset your password.');
    }

    return { ok: true, status: 201, userId: data.user.id };
  } catch (error) {
    console.error('[auth-email-otp] signup failed:', (error as Error).message);
    return fail(500, (error as Error).message || 'Could not create the account. Please try again.');
  }
}

export async function resetAccountPasswordWithEmailOtp(input: {
  email: unknown;
  code: unknown;
  password: unknown;
}): Promise<ServiceResult> {
  const email = normalizeEmail(input.email);
  const code = String(input.code || '').trim();
  const password = String(input.password || '');

  if (!isValidEmail(email)) return fail(400, 'Enter a valid email address.');
  if (!/^\d{6}$/.test(code)) return fail(400, 'Enter the six-digit code from your email.');
  if (password.length < 8) return fail(400, 'Use a password with at least 8 characters.');

  try {
    const user = await findApplicationUser(email);
    if (!user) return fail(400, 'That code is invalid or expired. Request a new code and try again.');

    const verified = await consumeEmailOtp(email, 'password_reset', code);
    if (!verified) return fail(400, 'That code is invalid or expired. Request a new code and try again.');

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.admin.updateUserById(user.id, { password });
    if (error) {
      console.error('[auth-email-otp] password update failed:', error.message);
      return fail(500, 'The password could not be changed. Request a new code and try again.');
    }

    return { ok: true, status: 200 };
  } catch (error) {
    console.error('[auth-email-otp] password reset failed:', (error as Error).message);
    return fail(500, 'Could not reset the password. Please try again.');
  }
}
