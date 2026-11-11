import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EMAIL_OTP_LENGTH,
  emailOtpMatches,
  generateEmailOtp,
  hashEmailOtp,
  hashEmailOtpRateLimitBucket
} from './emailOtpCrypto.ts';

test('email OTPs are six digit strings, including leading zeroes', () => {
  for (let i = 0; i < 100; i++) {
    assert.match(generateEmailOtp(), new RegExp(`^\\d{${EMAIL_OTP_LENGTH}}$`));
  }
});

test('OTP hashes are bound to normalized email and purpose', () => {
  const hash = hashEmailOtp(' Person@example.com ', 'signup', '004201', 'a sufficiently long secret');

  assert.equal(
    emailOtpMatches('person@example.com', 'signup', '004201', 'a sufficiently long secret', hash),
    true
  );
  assert.equal(
    emailOtpMatches('other@example.com', 'signup', '004201', 'a sufficiently long secret', hash),
    false
  );
  assert.equal(
    emailOtpMatches('person@example.com', 'password_reset', '004201', 'a sufficiently long secret', hash),
    false
  );
  assert.equal(
    emailOtpMatches('person@example.com', 'signup', '004202', 'a sufficiently long secret', hash),
    false
  );
});

test('OTP matching rejects malformed codes and hashes', () => {
  assert.equal(emailOtpMatches('person@example.com', 'signup', '4201', 'secret', 'bad-hash'), false);
});

test('IP rate-limit buckets are keyed without storing the raw address', () => {
  const first = hashEmailOtpRateLimitBucket('192.0.2.1', 'secret');
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, hashEmailOtpRateLimitBucket('192.0.2.1', 'secret'));
  assert.notEqual(first, hashEmailOtpRateLimitBucket('192.0.2.2', 'secret'));
});
