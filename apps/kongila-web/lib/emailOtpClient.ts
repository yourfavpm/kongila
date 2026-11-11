export type EmailOtpPurpose = 'signup' | 'password_reset';

async function postJson(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error || 'The request could not be completed.');
  return result;
}

export function requestEmailOtp(email: string, purpose: EmailOtpPurpose): Promise<{ message: string }> {
  return postJson('/api/auth/email-otp/send', { email, purpose });
}

export function createAccountWithEmailOtp(input: {
  email: string;
  code: string;
  password: string;
  role: 'client' | 'talent';
  name: string;
  companyName?: string;
}) {
  return postJson('/api/auth/email-otp/signup', input);
}

export function resetPasswordWithEmailOtp(input: {
  email: string;
  code: string;
  password: string;
}) {
  return postJson('/api/auth/email-otp/reset-password', input);
}
