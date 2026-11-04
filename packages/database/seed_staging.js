/**
 * Kongila — staging seed
 *
 * Creates real, loggable accounts and the data behind them:
 *   3 client companies with a contact each
 *   12 talents spread across all seven vetting stages
 *   4 talent requests, matches against them, 2 interviews, 1 offer
 *
 * Why Node and not SQL: rows in public.users cannot sign in. The portals
 * authenticate through Supabase Auth, so each person needs an auth.users
 * record too, and only the admin API creates that correctly (it handles the
 * identities row and password hashing that change between GoTrue versions).
 *
 * Safe to run more than once. Accounts are looked up by email before being
 * created, and every table write is an upsert on a deterministic id.
 *
 * Usage, from the repo root:
 *   SEED_CONFIRM=staging node packages/database/seed_staging.js
 *
 * Needs in .env at the repo root:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY     (bypasses RLS; never ship this to a browser)
 *
 * Every seeded account uses the password below. Fine for staging. If this
 * script is ever pointed at production, that is a breach, which is what the
 * SEED_CONFIRM guard is for.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const PASSWORD = 'KongilaStaging!2026';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

if (process.env.SEED_CONFIRM !== 'staging') {
  console.error(
    'Refusing to run without SEED_CONFIRM=staging.\n' +
    'This writes test people with a shared known password. Confirm the target:\n' +
    `  ${url}\n` +
    'is staging, then re-run with SEED_CONFIRM=staging.'
  );
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

const CLIENTS = [
  {
    key: 'meridian',
    org: { name: 'Meridian Health Group', industry: 'Healthcare', size: '51-200', country: 'United Kingdom', website: 'https://meridianhealth.example.com' },
    contact: { email: 'rachel.okonkwo@meridianhealth.example.com', name: 'Rachel Okonkwo', position: 'Head of Engineering', phone: '+44 20 7946 0812' },
  },
  {
    key: 'northbridge',
    org: { name: 'Northbridge Logistics', industry: 'Logistics', size: '201-500', country: 'Canada', website: 'https://northbridge.example.com' },
    contact: { email: 'daniel.meier@northbridge.example.com', name: 'Daniel Meier', position: 'Operations Director', phone: '+1 416 555 0147' },
  },
  {
    key: 'lumen',
    org: { name: 'Lumen Financial', industry: 'Fintech', size: '11-50', country: 'United States', website: 'https://lumenfinancial.example.com' },
    contact: { email: 'priya.raman@lumenfinancial.example.com', name: 'Priya Raman', position: 'COO', phone: '+1 415 555 0192' },
  },
];

// Twelve talents, one or two at each of the seven vetting stages, so every
// screen in the pipeline has something to render.
const TALENTS = [
  { key: 't01', name: 'Chidi Anya',        email: 'chidi.anya@example.com',        title: 'Senior Full-Stack Engineer', years: 6, rate: 4500, tz: 'GMT+1 (Lagos)',    country: 'Nigeria',     stage: 'Final Review',           status: 'Vetted',  grade: 'A+', avail: 40, skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL'] },
  { key: 't02', name: 'Amara Obi',         email: 'amara.obi@example.com',         title: 'Product Designer',           years: 5, rate: 3200, tz: 'GMT+1 (Lagos)',    country: 'Nigeria',     stage: 'Final Review',           status: 'Vetted',  grade: 'A',  avail: 40, skills: ['Figma', 'Design Systems', 'User Research'] },
  { key: 't03', name: 'Kwame Mensah',      email: 'kwame.mensah@example.com',      title: 'DevOps Engineer',            years: 7, rate: 5000, tz: 'GMT+0 (Accra)',    country: 'Ghana',       stage: 'Work Simulation',        status: 'Review',  grade: 'A',  avail: 40, skills: ['AWS', 'Terraform', 'Kubernetes', 'CI/CD'] },
  { key: 't04', name: 'Zainab Bello',      email: 'zainab.bello@example.com',      title: 'Data Analyst',               years: 4, rate: 2800, tz: 'GMT+1 (Abuja)',    country: 'Nigeria',     stage: 'Work Simulation',        status: 'Review',  grade: 'B',  avail: 30, skills: ['SQL', 'Python', 'Power BI', 'dbt'] },
  { key: 't05', name: 'Wanjiru Kamau',     email: 'wanjiru.kamau@example.com',     title: 'Backend Engineer',           years: 5, rate: 3800, tz: 'GMT+3 (Nairobi)',  country: 'Kenya',       stage: 'Remote Readiness',       status: 'Review',  grade: 'A',  avail: 40, skills: ['Go', 'PostgreSQL', 'gRPC', 'Docker'] },
  { key: 't06', name: 'Tunde Adeyemi',     email: 'tunde.adeyemi@example.com',     title: 'QA Engineer',                years: 3, rate: 2200, tz: 'GMT+1 (Ibadan)',   country: 'Nigeria',     stage: 'Remote Readiness',       status: 'Review',  grade: 'B',  avail: 40, skills: ['Playwright', 'Jest', 'Test Automation'] },
  { key: 't07', name: 'Fatou Ndiaye',      email: 'fatou.ndiaye@example.com',      title: 'Frontend Engineer',          years: 4, rate: 3000, tz: 'GMT+0 (Dakar)',    country: 'Senegal',     stage: 'Personality Test',       status: 'Review',  grade: 'A',  avail: 40, skills: ['React', 'TypeScript', 'Tailwind', 'Next.js'] },
  { key: 't08', name: 'Emeka Nwosu',       email: 'emeka.nwosu@example.com',       title: 'Customer Success Manager',   years: 6, rate: 2600, tz: 'GMT+1 (Lagos)',    country: 'Nigeria',     stage: 'Behavioural Interview',  status: 'Review',  grade: 'B',  avail: 40, skills: ['Account Management', 'Zendesk', 'Onboarding'] },
  { key: 't09', name: 'Thandiwe Dube',     email: 'thandiwe.dube@example.com',     title: 'Project Manager',            years: 8, rate: 4200, tz: 'GMT+2 (Johannesburg)', country: 'South Africa', stage: 'Behavioural Interview', status: 'Review', grade: 'A', avail: 40, skills: ['Agile', 'Jira', 'Stakeholder Management'] },
  { key: 't10', name: 'Ibrahim Sani',      email: 'ibrahim.sani@example.com',      title: 'Mobile Engineer',            years: 4, rate: 3400, tz: 'GMT+1 (Kano)',     country: 'Nigeria',     stage: 'Skill Assessment',       status: 'Applied', grade: 'B',  avail: 40, skills: ['React Native', 'Swift', 'Kotlin'] },
  { key: 't11', name: 'Grace Achieng',     email: 'grace.achieng@example.com',     title: 'Technical Writer',           years: 5, rate: 2400, tz: 'GMT+3 (Nairobi)',  country: 'Kenya',       stage: 'Skill Assessment',       status: 'Applied', grade: 'B',  avail: 25, skills: ['Documentation', 'API Reference', 'Markdown'] },
  { key: 't12', name: 'Oluwaseun Fashola', email: 'oluwaseun.fashola@example.com', title: 'Junior Data Engineer',       years: 2, rate: 1800, tz: 'GMT+1 (Lagos)',    country: 'Nigeria',     stage: 'Application Screening',  status: 'Applied', grade: 'B',  avail: 40, skills: ['Python', 'Airflow', 'SQL'] },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findOrCreateAuthUser(email, name, role) {
  // listUsers pages at 50 by default; the seed set is small but page anyway.
  let page = 1;
  while (page <= 20) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (data.users.length < 200) break;
    page += 1;
  }

  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name, role },
  });
  if (error) throw error;
  return data.user.id;
}

async function upsert(table, rows, onConflict = 'id', ignoreDuplicates = false) {
  const { error } = await db.from(table).upsert(rows, { onConflict, ignoreDuplicates });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`  ${table}: ${rows.length}${ignoreDuplicates ? ' (existing rows left alone)' : ''}`);
}

const daysFromNow = (n) => new Date(Date.now() + n * 86400000).toISOString();
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

// Mirrors packages/matching-engine so seeded scores are consistent with what
// the engine would produce, rather than invented numbers.
function matchScore(required, talentSkills, grade, availability) {
  const hits = required.filter((s) =>
    talentSkills.map((t) => t.toLowerCase()).includes(s.toLowerCase())
  ).length;
  const skillFit = Math.round((hits / required.length) * 100);
  const base = { 'A+': 92, A: 85, B: 72, Reject: 40 }[grade] || 70;
  const score = Math.round(
    skillFit * 0.4 + base * 0.2 + base * 0.15 + availability * 0.15 + base * 0.1
  );
  return {
    score: Math.min(100, Math.max(0, score)),
    breakdown: {
      skillFit,
      behaviorFit: base,
      personalityFit: base,
      availability,
      pastPerformance: base,
    },
  };
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Seeding ${url}\n`);

  // --- clients -------------------------------------------------------------
  console.log('Clients');
  const clientIds = {};
  const orgRows = [];
  const userRows = [];
  const profileRows = [];

  for (const c of CLIENTS) {
    const uid = await findOrCreateAuthUser(c.contact.email, c.contact.name, 'client');
    clientIds[c.key] = uid;
    const orgId = `org_${c.key}`;

    userRows.push({
      id: uid,
      email: c.contact.email,
      password_hash: 'auth_managed',
      role: 'client',
      status: 'active',
      email_verified: true,
      name: c.contact.name,
    });
    orgRows.push({
      id: orgId,
      name: c.org.name,
      industry: c.org.industry,
      company_size: c.org.size,
      country: c.org.country,
      website: c.org.website,
      contact_email: c.contact.email,
      contact_phone: c.contact.phone,
      created_by: uid,
      status: 'active',
      multi_user_enabled: false,
    });
    profileRows.push({
      id: `cp_${c.key}`,
      user_id: uid,
      organization_id: orgId,
      position: c.contact.position,
      phone: c.contact.phone,
    });
  }

  // --- talents -------------------------------------------------------------
  console.log('Talents');
  const talentUserIds = {};
  const talentProfileRows = [];

  for (const t of TALENTS) {
    const uid = await findOrCreateAuthUser(t.email, t.name, 'talent');
    talentUserIds[t.key] = uid;

    userRows.push({
      id: uid,
      email: t.email,
      password_hash: 'auth_managed',
      role: 'talent',
      status: 'active',
      email_verified: true,
      name: t.name,
    });
    talentProfileRows.push({
      id: `talent_${t.key}`,
      user_id: uid,
      full_name: t.name,
      country: t.country,
      level: t.title,
      availability_hours: t.avail,
      salary_expectation: t.rate,
      salary_min: Math.round(t.rate * 0.85),
      salary_max: Math.round(t.rate * 1.15),
      experience_years: t.years,
      status: 'active',
      timezone: t.tz,
      vetting_stage: t.stage,
      vetting_status: t.status,
      grade: t.grade,
      bio: `${t.title} with ${t.years} years of experience. Works ${t.tz}. Core skills: ${t.skills.join(', ')}.`,
      profile_integrity_progress: t.status === 'Vetted' ? 100 : 60 + t.years * 4,
      date_joined: daysAgo(90 - t.years * 3),
    });
  }

  // users must land before anything referencing them
  await upsert('users', userRows);
  await upsert('organizations', orgRows);
  await upsert('client_profiles', profileRows);
  await upsert('talent_profiles', talentProfileRows);

  // --- skills --------------------------------------------------------------
  console.log('Skills');
  const allSkills = [...new Set(TALENTS.flatMap((t) => t.skills))];
  const skillId = (name) => `skill_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
  // Insert only the skills that are missing. A plain upsert on name would try
  // to rewrite the id of any skill that already exists, and talent_skills has
  // a foreign key pointing at those ids, so Postgres rejects it.
  await upsert(
    'skills',
    allSkills.map((name) => ({ id: skillId(name), name })),
    'name',
    true
  );

  const { data: liveSkills } = await db.from('skills').select('id, name');
  const skillByName = Object.fromEntries((liveSkills || []).map((s) => [s.name, s.id]));

  await upsert(
    'talent_skills',
    TALENTS.flatMap((t) =>
      t.skills
        .filter((s) => skillByName[s])
        .map((s) => ({
          id: `ts_${t.key}_${skillId(s)}`,
          talent_id: `talent_${t.key}`,
          skill_id: skillByName[s],
          level: t.years >= 5 ? 'expert' : t.years >= 3 ? 'intermediate' : 'beginner',
        }))
    )
  );

  // --- requests ------------------------------------------------------------
  // talent_requests.id is a uuid and the whole request lives in a jsonb
  // payload. The existing matches_client_read policy joins on
  // payload->>'id', so the payload carries the id as well.
  console.log('Requests');
  const REQUESTS = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      client: 'meridian',
      service_type: 'Hire Talent',
      title: 'Senior Full-Stack Engineer',
      status: 'Candidates Ready',
      skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL'],
      budget: 5000, hires: 1, duration: '12 months', created: 21,
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      client: 'northbridge',
      service_type: 'Managed Workforce',
      title: 'Data and Reporting Pod',
      status: 'Sourcing Talent',
      skills: ['SQL', 'Python', 'Power BI'],
      budget: 9000, hires: 3, duration: '6 months', created: 9,
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      client: 'lumen',
      service_type: 'Hire Talent',
      title: 'Product Designer',
      status: 'Client Interview',
      skills: ['Figma', 'Design Systems', 'User Research'],
      budget: 3500, hires: 1, duration: 'Ongoing', created: 30,
    },
    {
      id: '44444444-4444-4444-8444-444444444444',
      client: 'lumen',
      service_type: 'Project Execution',
      title: 'Cloud Migration',
      status: 'New Request',
      skills: ['AWS', 'Terraform', 'Kubernetes'],
      budget: 12000, hires: 2, duration: '4 months', created: 2,
    },
  ];

  await upsert(
    'talent_requests',
    REQUESTS.map((r) => ({
      id: r.id,
      client_id: clientIds[r.client],
      service_type: r.service_type,
      status: r.status,
      title: r.title,
      role_description: `${r.title} for ${CLIENTS.find((c) => c.key === r.client).org.name}. ${r.hires} hire(s), ${r.duration}.`,
      created_at: daysAgo(r.created),
      payload: {
        id: r.id,
        title: r.title,
        serviceType: r.service_type,
        requiredSkills: r.skills,
        numberOfHires: r.hires,
        duration: r.duration,
        budget: r.budget,
        commitmentLevel: 'Full-time',
        timezone: 'Client timezone overlap, 4 hours minimum',
        priority: r.hires > 1 ? 'High' : 'Medium',
        startDate: daysFromNow(21).slice(0, 10),
      },
    }))
  );

  // --- matches -------------------------------------------------------------
  console.log('Matches');
  const matchRows = [];
  const pairings = [
    { req: REQUESTS[0], talents: ['t01', 't05', 't07'], statuses: ['shortlisted', 'proposed', 'proposed'] },
    { req: REQUESTS[1], talents: ['t04', 't12', 't11'], statuses: ['proposed', 'proposed', 'proposed'] },
    { req: REQUESTS[2], talents: ['t02'],               statuses: ['shortlisted'] },
    { req: REQUESTS[3], talents: ['t03'],               statuses: ['proposed'] },
  ];

  for (const p of pairings) {
    p.talents.forEach((tk, i) => {
      const t = TALENTS.find((x) => x.key === tk);
      const { score, breakdown } = matchScore(p.req.skills, t.skills, t.grade, t.avail * 2.5);
      matchRows.push({
        id: `match_${p.req.id.slice(0, 8)}_${tk}`,
        request_id: p.req.id,
        talent_id: `talent_${tk}`,
        score,
        breakdown,
        status: p.statuses[i],
        created_at: daysAgo(p.req.created - 2),
      });
    });
  }
  await upsert('matches', matchRows);

  // --- interviews ----------------------------------------------------------
  console.log('Interviews');
  await upsert('interviews', [
    {
      id: 'int_meridian_chidi',
      request_id: REQUESTS[0].id,
      match_id: `match_${REQUESTS[0].id.slice(0, 8)}_t01`,
      talent_id: talentUserIds.t01,
      client_id: clientIds.meridian,
      title: 'Technical interview — Senior Full-Stack Engineer',
      scheduled_time: daysFromNow(3),
      duration_minutes: 45,
      status: 'confirmed',
      interview_type: 'video',
      talent_name: 'Chidi Anya',
      client_name: 'Meridian Health Group',
      created_at: daysAgo(4),
    },
    {
      id: 'int_lumen_amara',
      request_id: REQUESTS[2].id,
      match_id: `match_${REQUESTS[2].id.slice(0, 8)}_t02`,
      talent_id: talentUserIds.t02,
      client_id: clientIds.lumen,
      title: 'Portfolio review — Product Designer',
      scheduled_time: daysAgo(2),
      duration_minutes: 60,
      status: 'Completed',
      interview_type: 'video',
      talent_name: 'Amara Obi',
      client_name: 'Lumen Financial',
      client_rating: 5,
      client_feedback: 'Strong systems thinking. Walked through two case studies end to end.',
      admin_outcome: 'Proceed to Hire',
      created_at: daysAgo(10),
    },
  ]);

  // --- offer ---------------------------------------------------------------
  // offers.request_id references service_requests, not talent_requests, so it
  // is left null here. That mismatch is on the day 5 list.
  console.log('Offers');
  await upsert('offers', [
    {
      id: 'offer_lumen_amara',
      match_id: `match_${REQUESTS[2].id.slice(0, 8)}_t02`,
      client_id: clientIds.lumen,
      talent_id: talentUserIds.t02,
      initiated_by: 'client',
      entry_point: 'post_interview',
      status: 'sent_to_talent',
      role_title: 'Product Designer',
      service_type: 'Hire Talent',
      engagement_type: 'full_time',
      hours_per_week: 40,
      proposed_start_date: daysFromNow(28).slice(0, 10),
      contract_duration_type: 'ongoing',
      payment_model: 'flat_rate',
      proposed_rate_usd: 3300,
      payment_period: 'monthly',
      payment_due_day: 25,
      remotan_enabled: false,
      sent_to_talent_at: daysAgo(1),
      talent_response_deadline: daysFromNow(6),
    },
  ]);

  // --- notifications -------------------------------------------------------
  console.log('Notifications');
  await upsert('notifications', [
    { id: 'notif_amara_offer', user_id: talentUserIds.t02, type: 'offer', message: 'Lumen Financial has sent you an offer for Product Designer.', status: 'unread', read: false, created_at: daysAgo(1) },
    { id: 'notif_chidi_interview', user_id: talentUserIds.t01, type: 'interview', message: 'Your interview with Meridian Health Group is confirmed.', status: 'unread', read: false, created_at: daysAgo(4) },
    { id: 'notif_rachel_shortlist', user_id: clientIds.meridian, type: 'match', message: '3 candidates are ready to review for Senior Full-Stack Engineer.', status: 'unread', read: false, created_at: daysAgo(6) },
  ]);

  console.log('\nDone.');
  console.log(`\nSign in with any of these. Password for all: ${PASSWORD}`);
  console.log('\n  Clients');
  CLIENTS.forEach((c) => console.log(`    ${c.contact.email}  (${c.org.name})`));
  console.log('\n  Talents');
  TALENTS.forEach((t) => console.log(`    ${t.email.padEnd(40)} ${t.stage}`));
}

main().catch((err) => {
  console.error('\nSeed failed:', err.message);
  process.exit(1);
});
