import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export type EmailOtpPurpose = 'signup' | 'password_reset';

export const EMAIL_OTP_LENGTH = 6;
export const EMAIL_OTP_TTL_MINUTES = 10;
export const EMAIL_OTP_RESEND_COOLDOWN_SECONDS = 60;
export const EMAIL_OTP_MAX_SENDS_PER_HOUR = 5;
export const EMAIL_OTP_MAX_ATTEMPTS = 5;

export function normalizeEmail(email: unknown): string {
  return String(email || '').trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function generateEmailOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(EMAIL_OTP_LENGTH, '0');
}

export function hashEmailOtp(
  email: string,
  purpose: EmailOtpPurpose,
  code: string,
  secret: string
): string {
  return createHmac('sha256', secret)
    .update(`${normalizeEmail(email)}\0${purpose}\0${code}`)
    .digest('hex');
}

export function hashEmailOtpRateLimitBucket(ipAddress: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`email-otp-ip\0${ipAddress}`)
    .digest('hex');
}

export function emailOtpMatches(
  email: string,
  purpose: EmailOtpPurpose,
  code: string,
  secret: string,
  storedHash: string
): boolean {
  if (!/^\d{6}$/.test(code) || !/^[a-f0-9]{64}$/i.test(storedHash)) return false;
  const expected = Buffer.from(hashEmailOtp(email, purpose, code, secret), 'hex');
  const actual = Buffer.from(storedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
