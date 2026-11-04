import test from 'node:test';
import assert from 'node:assert/strict';

import {
  filterProfilePatch,
  validateProfilePatch,
  normaliseSkills,
  isOperationsOnly,
  TALENT_WRITABLE_FIELDS,
  OPERATIONS_ONLY_FIELDS
} from './profileFields.ts';

// ─── The hole this closes ────────────────────────────────────────────────────

test('a candidate cannot set their own grade', () => {
  // The browser upserted the whole row including grade, and RLS is off on
  // talent_profiles in the live database, so this landed.
  const { allowed, refused } = filterProfilePatch(
    { full_name: 'Ada Okafor', grade: 'A+' }, false
  );
  assert.deepEqual(allowed, { full_name: 'Ada Okafor' });
  assert.deepEqual(refused, ['grade']);
});

test('a candidate cannot set their own vetting status or stage', () => {
  const { allowed, refused } = filterProfilePatch(
    { vetting_status: 'Deployed', vetting_stage: 'Final Review', phone: '+234' }, false
  );
  assert.deepEqual(Object.keys(allowed), ['phone']);
  assert.deepEqual(refused.sort(), ['vetting_stage', 'vetting_status']);
});

test('operations can set the judgement fields', () => {
  const { allowed, refused } = filterProfilePatch(
    { grade: 'A+', vetting_status: 'Vetted' }, true
  );
  assert.deepEqual(allowed, { grade: 'A+', vetting_status: 'Vetted' });
  assert.deepEqual(refused, []);
});

test('nobody can move a profile to another person, not even operations', () => {
  // Changing id or user_id reassigns the whole record.
  const asOps = filterProfilePatch({ id: 'other', user_id: 'other' }, true);
  assert.deepEqual(asOps.allowed, {});
  assert.deepEqual(asOps.refused.sort(), ['id', 'user_id']);
});

test('an unrecognised column is reported rather than written', () => {
  const { allowed, unknown } = filterProfilePatch({ is_admin: true, full_name: 'A' }, false);
  assert.deepEqual(allowed, { full_name: 'A' });
  assert.deepEqual(unknown, ['is_admin']);
});

test('undefined values are skipped, so a partial patch stays partial', () => {
  const { allowed } = filterProfilePatch({ full_name: 'A', phone: undefined }, false);
  assert.deepEqual(allowed, { full_name: 'A' });
});

test('null is a real value and clears a field', () => {
  const { allowed } = filterProfilePatch({ phone: null }, false);
  assert.deepEqual(allowed, { phone: null });
});

test('the two field lists do not overlap', () => {
  const overlap = TALENT_WRITABLE_FIELDS.filter(f => (OPERATIONS_ONLY_FIELDS as readonly string[]).includes(f));
  assert.deepEqual(overlap, [], 'a field in both lists would be writable by anyone');
  assert.equal(isOperationsOnly('grade'), true);
  assert.equal(isOperationsOnly('phone'), false);
});

// ─── Validation ──────────────────────────────────────────────────────────────

test('a blank name is refused', () => {
  assert.deepEqual(
    validateProfilePatch({ full_name: '   ' }).map(p => p.field), ['full_name']
  );
});

test('availability beyond a working week is refused', () => {
  assert.equal(validateProfilePatch({ availability_hours: 40 }).length, 0);
  assert.equal(validateProfilePatch({ availability_hours: 400 }).length, 1);
  assert.equal(validateProfilePatch({ availability_hours: -5 }).length, 1);
});

test('a negative salary is refused', () => {
  assert.equal(validateProfilePatch({ salary_expectation: -100 }).length, 1);
});

test('a minimum above the maximum is refused', () => {
  const problems = validateProfilePatch({ salary_min: 5000, salary_max: 1000 });
  assert.equal(problems[0].field, 'salary_min');
});

test('a sensible patch has no problems', () => {
  assert.deepEqual(validateProfilePatch({
    full_name: 'Ada Okafor', phone: '+2348012345678', country: 'Nigeria',
    availability_hours: 40, experience_years: 7,
    salary_min: 2000, salary_max: 3000, salary_expectation: 2500
  }), []);
});

test('a number arriving as a string still validates', () => {
  assert.deepEqual(validateProfilePatch({ experience_years: '7' }), []);
  assert.equal(validateProfilePatch({ experience_years: '700' }).length, 1);
});

test('an empty string is treated as not supplied for numbers', () => {
  assert.deepEqual(validateProfilePatch({ salary_min: '' }), []);
});

test('settings must be an object', () => {
  assert.equal(validateProfilePatch({ settings: 'on' }).length, 1);
  assert.equal(validateProfilePatch({ settings: { email: {} } }).length, 0);
});

// ─── Skills ──────────────────────────────────────────────────────────────────

test('skills are deduplicated regardless of case', () => {
  // Two rows for the same skill gives a candidate double weight anywhere
  // that counts them.
  const { skills } = normaliseSkills(['React', 'react', 'REACT', 'SQL']);
  assert.deepEqual(skills.map(s => s.name), ['React', 'SQL']);
});

test('a skill level outside the three is pulled back to intermediate', () => {
  const { skills } = normaliseSkills([{ name: 'React', level: 'god tier' }]);
  assert.equal(skills[0].level, 'intermediate');
});

test('a claimed level that is legal is kept', () => {
  const { skills } = normaliseSkills([{ name: 'React', level: 'expert' }]);
  assert.equal(skills[0].level, 'expert');
});

test('blank skills are dropped rather than stored', () => {
  const { skills } = normaliseSkills(['React', '', '   ', null]);
  assert.deepEqual(skills.map(s => s.name), ['React']);
});

test('a non-list is refused rather than coerced', () => {
  const { skills, problems } = normaliseSkills('React, SQL');
  assert.deepEqual(skills, []);
  assert.equal(problems[0].field, 'skills');
});

test('an absurd number of skills is capped and reported', () => {
  const { skills, problems } = normaliseSkills(
    Array.from({ length: 80 }, (_, i) => `Skill ${i}`)
  );
  assert.equal(skills.length, 50);
  assert.match(problems[0].message, /more than 50/);
});

test('nothing supplied is not an error', () => {
  assert.deepEqual(normaliseSkills(undefined), { skills: [], problems: [] });
});
