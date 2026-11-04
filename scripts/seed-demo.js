#!/usr/bin/env node
/**
 * Kongila — demo data seeder
 *
 * Fills a Supabase project with enough joined-up data to click through the
 * whole product without creating anything by hand: assessments for six
 * roles, candidates at every vetting stage, clients with requests across
 * all four service lines, matches, interviews, offers, contracts,
 * invoices, payouts and support tickets.
 *
 * Usage:
 *   node scripts/seed-demo.js --project=<ref> --confirm
 *   node scripts/seed-demo.js --project=<ref> --confirm --clean
 *   node scripts/seed-demo.js --project=<ref> --confirm --only=assessments,talents
 *
 * The --project ref has to match the one in SUPABASE_URL. That is the
 * whole safety mechanism: this script writes a lot of rows, and the cost
 * of pointing it at the wrong database is a production table full of
 * invented candidates. Typing the ref means you looked.
 *
 * Every row it writes has an id beginning `seed_`, so --clean removes
 * exactly what it created and nothing else.
 *
 * Reads from .env at the repo root:
 *   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const path = require('path');

// dotenv and supabase-js are required lazily, below the safety checks, so a
// missing dependency cannot swallow the "are you sure about this project"
// guard and leave you thinking it ran.
try {
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
} catch {
  // No dotenv: fall back to whatever is already in the environment.
}

// ─── Arguments and safety ────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flag = name => args.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
const has = name => args.includes(`--${name}`);

const CONFIRMED = has('confirm');
const CLEAN = has('clean');
const ONLY = (flag('only') || '').split(',').map(s => s.trim()).filter(Boolean);
const CLAIMED_REF = flag('project');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Add the production project ref here once it exists.
 *
 * Belt as well as braces: --project already forces you to name the target,
 * but a ref in this list is refused outright whatever you type.
 */
const NEVER_SEED = [
  // 'abcdefghijklmnopqrst',  // production
];

function projectRef(url) {
  const match = /https:\/\/([a-z0-9]+)\.supabase\./i.exec(String(url || ''));
  return match ? match[1] : null;
}

function die(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

if (!SUPABASE_URL || !SERVICE_KEY) {
  die('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env at the repo root.');
}

const REF = projectRef(SUPABASE_URL);

if (!REF) die(`Could not read a project ref out of SUPABASE_URL (${SUPABASE_URL}).`);
if (NEVER_SEED.includes(REF)) die(`${REF} is on the never-seed list. Refusing.`);

if (!CLAIMED_REF || !CONFIRMED) {
  console.error(`
  This writes demo data into Supabase project:  ${REF}

  Check that is the project you mean. Then run:

      node scripts/seed-demo.js --project=${REF} --confirm

  Add --clean to remove previously seeded rows instead of writing them.
`);
  process.exit(1);
}

if (CLAIMED_REF !== REF) {
  die(`You named project "${CLAIMED_REF}" but .env points at "${REF}". Refusing.`);
}

let createClient;
try {
  ({ createClient } = require('@supabase/supabase-js'));
} catch {
  die('@supabase/supabase-js is not installed. Run pnpm install at the repo root first.');
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ─── Reporting ───────────────────────────────────────────────────────────────

const report = [];
let failures = 0;

/**
 * Writes one table's rows.
 *
 * A failure is reported and the run carries on. A column mismatch in one
 * area should not stop the other fifteen, and the report at the end tells
 * you exactly which part of the schema has drifted.
 */
async function put(table, rows, conflict = 'id') {
  if (!rows.length) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: conflict });
  if (error) {
    failures += 1;
    report.push({ table, count: 0, status: 'failed', detail: error.message });
    console.log(`  ✗ ${table.padEnd(26)} ${error.message}`);
    return;
  }
  report.push({ table, count: rows.length, status: 'ok' });
  console.log(`  ✓ ${table.padEnd(26)} ${rows.length}`);
}

async function wipe(table, column = 'id') {
  const { error } = await supabase.from(table).delete().like(column, 'seed_%');
  if (error) {
    console.log(`  ✗ ${table.padEnd(26)} ${error.message}`);
    failures += 1;
    return;
  }
  console.log(`  ✓ ${table.padEnd(26)} cleared`);
}

function wants(section) {
  return ONLY.length === 0 || ONLY.includes(section);
}

// ─── Dates, so the data is always relative to today ──────────────────────────

const now = new Date();
const iso = date => date.toISOString();
const daysFromNow = n => {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
};
const monthsAgo = n => {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d;
};
/**
 * talent_requests.id is a uuid while almost every other id on this schema
 * is a varchar carrying a prefixed string. These are fixed so a re-run
 * updates the same rows, and the 5EED prefix makes them findable by eye.
 */
const REQUEST_IDS = {
  backend:  '5eed0001-0000-4000-8000-000000000001',
  frontend: '5eed0001-0000-4000-8000-000000000002',
  analyst:  '5eed0001-0000-4000-8000-000000000003',
  support:  '5eed0001-0000-4000-8000-000000000004',
  va:       '5eed0001-0000-4000-8000-000000000005'
};

const period = date =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
const dateOnly = date => iso(date).slice(0, 10);

// ─── People ──────────────────────────────────────────────────────────────────

const DEMO_PASSWORD = 'KongilaDemo!2026';

const ADMINS = [
  { id: 'seed_admin_super', email: 'demo.super@kongila.test', name: 'Amara Super', role: 'super_admin' },
  { id: 'seed_admin_finance', email: 'demo.finance@kongila.test', name: 'Femi Finance', role: 'finance' },
  { id: 'seed_admin_talent', email: 'demo.talent@kongila.test', name: 'Tola Talent', role: 'talent_manager' },
  { id: 'seed_admin_assessor', email: 'demo.assessor@kongila.test', name: 'Segun Assessor', role: 'skill_assessor' }
];

const CLIENTS = [
  {
    id: 'seed_client_northwind', email: 'demo.northwind@kongila.test',
    name: 'Clara Mensah', company: 'Northwind Logistics', orgId: 'seed_org_northwind',
    country: 'United Kingdom'
  },
  {
    id: 'seed_client_lumen', email: 'demo.lumen@kongila.test',
    name: 'Daniel Price', company: 'Lumen Health', orgId: 'seed_org_lumen',
    country: 'United States'
  }
];

/** One candidate at each vetting stage, so every pipeline column has a card. */
const TALENTS = [
  { id: 'seed_talent_ada', email: 'demo.ada@kongila.test', name: 'Ada Okafor',
    role: 'Backend Engineer', stage: 'Deployed', grade: 'A+', years: 7, rate: 2800,
    skills: ['Node.js', 'PostgreSQL', 'AWS'] },
  { id: 'seed_talent_bola', email: 'demo.bola@kongila.test', name: 'Bola Hassan',
    role: 'Frontend Engineer', stage: 'Deployed', grade: 'A', years: 5, rate: 2400,
    skills: ['React', 'TypeScript', 'CSS'] },
  { id: 'seed_talent_chidi', email: 'demo.chidi@kongila.test', name: 'Chidi Eze',
    role: 'Data Analyst', stage: 'Matched', grade: 'A', years: 4, rate: 2000,
    skills: ['SQL', 'Python', 'Power BI'] },
  { id: 'seed_talent_dayo', email: 'demo.dayo@kongila.test', name: 'Dayo Adeyemi',
    role: 'Customer Support', stage: 'Vetted', grade: 'B', years: 3, rate: 1200,
    skills: ['Zendesk', 'Written English'] },
  { id: 'seed_talent_efe', email: 'demo.efe@kongila.test', name: 'Efe Johnson',
    role: 'Virtual Assistant', stage: 'Review', grade: 'B', years: 2, rate: 900,
    skills: ['Calendar Management', 'Written English'] },
  { id: 'seed_talent_funke', email: 'demo.funke@kongila.test', name: 'Funke Lawal',
    role: 'Accountant', stage: 'Applied', grade: 'B', years: 6, rate: 1800,
    skills: ['Xero', 'Reconciliation'] }
];

/**
 * Creates the sign-in accounts.
 *
 * Without these the rows exist but nobody can log in, which makes the data
 * useless for actually clicking through the product. Email confirmation is
 * set true so there is no inbox step.
 */
async function seedAuthUsers() {
  const everyone = [
    ...ADMINS.map(a => ({ ...a, kind: 'admin' })),
    ...CLIENTS.map(c => ({ ...c, kind: 'client' })),
    ...TALENTS.map(t => ({ ...t, kind: 'talent' }))
  ];

  let created = 0;
  let existing = 0;

  for (const person of everyone) {
    const { error } = await supabase.auth.admin.createUser({
      email: person.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { name: person.name, seeded: true }
    });

    if (!error) { created += 1; continue; }
    if (/already|registered|exists/i.test(error.message)) { existing += 1; continue; }

    failures += 1;
    console.log(`  ✗ auth ${person.email}: ${error.message}`);
  }

  console.log(`  ✓ ${'auth users'.padEnd(26)} ${created} created, ${existing} already there`);
  report.push({ table: 'auth users', count: created, status: 'ok' });
}

// ─── Assessments ─────────────────────────────────────────────────────────────

/**
 * Shared categories, then one role-specific category per role.
 *
 * Questions are real enough to answer. A seeded assessment of "Question 1"
 * through "Question 10" tells you the screen renders and nothing else.
 */
const SHARED_CATEGORIES = [
  {
    id: 'seed_cat_remote', name: 'Remote Readiness', time: 10,
    description: 'Working unsupervised across time zones.',
    tags: ['shared', 'behavioural'],
    questions: [
      { type: 'multiple_choice', text: 'Your internet drops an hour before a client demo. What do you do first?',
        options: ['Wait and hope it returns', 'Message the client and switch to a backup connection',
                  'Start the demo late without warning', 'Ask a colleague to run it instead'],
        answer: 'Message the client and switch to a backup connection', weight: 2, max: 10 },
      { type: 'multiple_choice', text: 'Your client is six hours behind you. When do you schedule a standing daily call?',
        options: ['Start of your day', 'End of your day, which is their morning',
                  'Whenever is convenient that week', 'Their evening'],
        answer: 'End of your day, which is their morning', weight: 2, max: 10 },
      { type: 'short_answer', text: 'Describe your power and internet backup arrangements.',
        expected: 'Names a specific backup: inverter, generator, second ISP or mobile data.',
        weight: 1, max: 10 }
    ]
  },
  {
    id: 'seed_cat_comms', name: 'Written Communication', time: 15,
    description: 'Clear written English under normal working pressure.',
    tags: ['shared'],
    questions: [
      { type: 'essay', text: 'A deliverable will be two days late. Write the message you send the client.',
        expected: 'States the delay, the new date and the reason, without excessive apology.',
        weight: 3, max: 20 },
      { type: 'short_answer', text: 'Rewrite this so a non-technical reader understands it: "The job failed due to a null pointer in the ETL."',
        expected: 'Plain language, no jargon, says what the reader should do.', weight: 2, max: 10 }
    ]
  }
];

const ROLE_CATEGORIES = [
  {
    id: 'seed_cat_backend', name: 'Backend Engineering', time: 30, role: 'Backend Engineer',
    description: 'APIs, data modelling and failure handling.',
    questions: [
      { type: 'multiple_choice', text: 'Which HTTP status fits a request that is valid but refused because of a business rule?',
        options: ['400 Bad Request', '403 Forbidden', '409 Conflict', '500 Internal Server Error'],
        answer: '409 Conflict', weight: 2, max: 10 },
      { type: 'multiple_choice', text: 'A query that was fast on 10,000 rows crawls on 10 million. What do you check first?',
        options: ['Add more memory', 'Read the query plan and the indexes',
                  'Rewrite it in another language', 'Cache the whole table'],
        answer: 'Read the query plan and the indexes', weight: 3, max: 15 },
      { type: 'scenario', text: 'A payment webhook can be delivered twice. How do you make processing it safe?',
        expected: 'Idempotency key or a unique constraint on the event id; the second delivery is a no-op.',
        weight: 3, max: 20 }
    ]
  },
  {
    id: 'seed_cat_frontend', name: 'Frontend Engineering', time: 30, role: 'Frontend Engineer',
    description: 'Interface work, state and accessibility.',
    questions: [
      { type: 'multiple_choice', text: 'What does a React key on a list item actually do?',
        options: ['Styles the item', 'Lets React match elements between renders',
                  'Sorts the list', 'Makes it accessible'],
        answer: 'Lets React match elements between renders', weight: 2, max: 10 },
      { type: 'multiple_choice', text: 'A form is unusable with a keyboard. What is the most likely cause?',
        options: ['Missing labels and focus order', 'The font is too small',
                  'Too many colours', 'It is not responsive'],
        answer: 'Missing labels and focus order', weight: 2, max: 10 },
      { type: 'scenario', text: 'A page shows stale data after a save. Where do you look?',
        expected: 'Cache or local state not invalidated after the write; refetch or update the store.',
        weight: 3, max: 20 }
    ]
  },
  {
    id: 'seed_cat_data', name: 'Data Analysis', time: 30, role: 'Data Analyst',
    description: 'SQL, interpretation and honest reporting.',
    questions: [
      { type: 'multiple_choice', text: 'Which join keeps every row of the left table?',
        options: ['INNER JOIN', 'LEFT JOIN', 'CROSS JOIN', 'FULL JOIN'],
        answer: 'LEFT JOIN', weight: 2, max: 10 },
      { type: 'scenario', text: 'Signups rose 40% but revenue did not move. What do you check?',
        expected: 'Segment the new signups: source quality, conversion rate, plan mix, refunds.',
        weight: 3, max: 20 },
      { type: 'short_answer', text: 'A stakeholder asks for a number you think is misleading. What do you do?',
        expected: 'Give the number with the caveat, and offer the measure that answers their real question.',
        weight: 2, max: 10 }
    ]
  },
  {
    id: 'seed_cat_support', name: 'Customer Support', time: 25, role: 'Customer Support',
    description: 'Handling people who are already annoyed.',
    questions: [
      { type: 'essay', text: 'A customer has been waiting three days for a reply and is angry. Write your first message.',
        expected: 'Acknowledges the wait without over-apologising, gives a concrete next step and a time.',
        weight: 3, max: 20 },
      { type: 'multiple_choice', text: 'You do not know the answer and the customer is waiting. What is best?',
        options: ['Guess, to seem fast', 'Say you are finding out and when you will come back',
                  'Transfer without explaining', 'Close the ticket'],
        answer: 'Say you are finding out and when you will come back', weight: 2, max: 10 }
    ]
  },
  {
    id: 'seed_cat_va', name: 'Virtual Assistance', time: 25, role: 'Virtual Assistant',
    description: 'Calendar, inbox and judgement about priority.',
    questions: [
      { type: 'scenario', text: 'Two meetings are double-booked and both organisers are senior. What do you do?',
        expected: 'Check which is externally facing or harder to move, propose one alternative, tell both.',
        weight: 3, max: 15 },
      { type: 'multiple_choice', text: 'An email looks like it is from your principal asking for a gift card purchase. What do you do?',
        options: ['Buy it quickly', 'Reply asking for details', 'Verify through a known channel before acting',
                  'Forward it to the finance team'],
        answer: 'Verify through a known channel before acting', weight: 3, max: 15 }
    ]
  },
  {
    id: 'seed_cat_accounting', name: 'Accounting', time: 30, role: 'Accountant',
    description: 'Bookkeeping accuracy and reconciliation.',
    questions: [
      { type: 'multiple_choice', text: 'The bank statement shows a payment the ledger does not. What is this called?',
        options: ['An accrual', 'A reconciling item', 'A write-off', 'A provision'],
        answer: 'A reconciling item', weight: 2, max: 10 },
      { type: 'scenario', text: 'A manager asks you to move an expense into next quarter. How do you respond?',
        expected: 'Declines to misstate the period, explains the rule, offers to document the reason if legitimate.',
        weight: 3, max: 20 }
    ]
  }
];

function assessmentRows() {
  const categories = [];
  const questions = [];
  const assessments = [];

  const all = [...SHARED_CATEGORIES, ...ROLE_CATEGORIES];

  for (const category of all) {
    const questionIds = category.questions.map((_, index) => `${category.id}_q${index + 1}`);

    categories.push({
      id: category.id,
      name: category.name,
      description: category.description,
      time_limit_minutes: category.time,
      is_reusable: true,
      tags: JSON.stringify(category.tags || ['role']),
      questions: JSON.stringify(questionIds),
      created_by: 'seed_admin_assessor',
      created_at: iso(monthsAgo(2))
    });

    category.questions.forEach((question, index) => {
      questions.push({
        id: questionIds[index],
        category_id: category.id,
        type: question.type,
        question_text: question.text,
        options: question.options ? JSON.stringify(question.options) : null,
        correct_answer: question.answer ? JSON.stringify(question.answer) : null,
        expected_answer: question.expected || null,
        scoring_weight: question.weight,
        max_score: question.max
      });
    });
  }

  for (const category of ROLE_CATEGORIES) {
    const used = [category.id, 'seed_cat_remote', 'seed_cat_comms'];
    assessments.push({
      id: `seed_assessment_${category.role.toLowerCase().replace(/\s+/g, '_')}`,
      title: `${category.role} — Kongila vetting`,
      description: `Technical, communication and remote-readiness assessment for ${category.role} candidates.`,
      role_targeted: category.role,
      total_time_limit_minutes: category.time + 25,
      passing_score: 70,
      categories: JSON.stringify(used),
      category_overrides: JSON.stringify([]),
      status: 'published',
      created_by: 'seed_admin_assessor',
      created_at: iso(monthsAgo(2))
    });
  }

  return { categories, questions, assessments };
}

// ─── The run ─────────────────────────────────────────────────────────────────

async function clean() {
  console.log(`\nRemoving seeded rows from ${REF}\n`);

  // Children before parents, so foreign keys do not block the delete.
  const order = [
    'invoice_line_items', 'kongila_payroll_entries', 'kongila_payroll_runs',
    'talent_payouts', 'payments', 'invoices',
    'contract_signatures', 'document_signatures', 'contracts', 'offers',
    'interviews', 'matches', 'assessment_assignments', 'assessment_questions',
    'assessment_categories', 'assessments', 'support_messages', 'support_tickets',
    'messages', 'conversations', 'documents', 'talent_skills', 'skills',
    'talent_profiles', 'client_profiles', 'organizations',
    'notifications', 'audit_logs', 'users'
  ];

  for (const table of order) await wipe(table);

  // talent_requests ids are uuids rather than seed_ strings, so they need
  // their own pass.
  const { error } = await supabase
    .from('talent_requests').delete().in('id', Object.values(REQUEST_IDS));
  console.log(error
    ? `  ✗ ${'talent_requests'.padEnd(26)} ${error.message}`
    : `  ✓ ${'talent_requests'.padEnd(26)} cleared`);

  console.log('\nAuth accounts are left alone; delete them in the Supabase dashboard if you want them gone.\n');
}

async function seed() {
  console.log(`\nSeeding ${REF}\n`);

  if (wants('auth')) await seedAuthUsers();

  // ── People and organisations ──────────────────────────────────────────────
  if (wants('people')) {
    await put('users', [
      // password_hash is NOT NULL on this table and is a leftover from
      // before Supabase Auth. The real credential lives in auth.users; this
      // placeholder exists so the row is insertable and so nobody mistakes
      // it for a hash worth attacking.
      ...ADMINS.map(a => ({
        id: a.id, email: a.email, name: a.name, role: a.role, status: 'active',
        password_hash: 'managed_by_supabase_auth', email_verified: true,
        created_at: iso(monthsAgo(6))
      })),
      ...CLIENTS.map(c => ({
        id: c.id, email: c.email, name: c.name, role: 'client', status: 'active',
        password_hash: 'managed_by_supabase_auth', email_verified: true,
        created_at: iso(monthsAgo(4))
      })),
      ...TALENTS.map(t => ({
        id: t.id, email: t.email, name: t.name, role: 'talent', status: 'active',
        password_hash: 'managed_by_supabase_auth', email_verified: true,
        created_at: iso(monthsAgo(3))
      }))
    ]);

    await put('organizations', CLIENTS.map(c => ({
      id: c.orgId, name: c.company, country: c.country,
      industry: 'Technology', company_size: '50-200',
      contact_email: c.email, created_by: c.id, status: 'active',
      created_at: iso(monthsAgo(4))
    })));

    // client_profiles carries the link to the organisation and little
    // else. The company name is organizations.name; there is no
    // company_name column here.
    await put('client_profiles', CLIENTS.map(c => ({
      id: `seed_cp_${c.orgId.replace('seed_org_', '')}`,
      user_id: c.id, organization_id: c.orgId,
      position: 'Operations Director', phone: '+44 20 7946 0100',
      permission_level: 'admin'
    })));

    await put('talent_profiles', TALENTS.map(t => ({
      id: `seed_tp_${t.id.replace('seed_talent_', '')}`,
      user_id: t.id, full_name: t.name, country: 'Nigeria',
      timezone: 'GMT+1 (Lagos)', level: t.years > 5 ? 'Senior' : 'Mid',
      availability_hours: 40, experience_years: t.years,
      salary_expectation: t.rate, salary_min: t.rate - 300, salary_max: t.rate + 400,
      status: t.stage === 'Deployed' ? 'assigned' : 'active',
      vetting_status: t.stage, grade: t.grade,
      bio: `${t.role} with ${t.years} years of experience, working remotely from Lagos.`,
      date_joined: iso(monthsAgo(3))
    })));
  }

  // ── Skills ────────────────────────────────────────────────────────────────
  if (wants('skills')) {
    const names = [...new Set(TALENTS.flatMap(t => t.skills))];
    const skillId = name => `seed_skill_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;

    await put('skills', names.map(name => ({ id: skillId(name), name })));
    await put('talent_skills', TALENTS.flatMap(t =>
      t.skills.map(skill => ({
        id: `seed_ts_${t.id.replace('seed_talent_', '')}_${skillId(skill)}`,
        talent_id: `seed_tp_${t.id.replace('seed_talent_', '')}`,
        skill_id: skillId(skill),
        level: t.years > 5 ? 'expert' : 'intermediate'
      }))
    ));
  }

  // ── Assessments ───────────────────────────────────────────────────────────
  if (wants('assessments')) {
    const { categories, questions, assessments } = assessmentRows();
    await put('assessment_categories', categories);
    await put('assessment_questions', questions);
    await put('assessments', assessments);

    // Assignments at every state, so the admin queue has something in each.
    const states = [
      { talent: 'ada', role: 'backend_engineer', status: 'completed', score: 88 },
      { talent: 'bola', role: 'frontend_engineer', status: 'completed', score: 76 },
      { talent: 'chidi', role: 'data_analyst', status: 'in_progress', score: null },
      { talent: 'dayo', role: 'customer_support', status: 'completed', score: 64 },
      { talent: 'efe', role: 'virtual_assistant', status: 'not_started', score: null },
      { talent: 'funke', role: 'accountant', status: 'not_started', score: null }
    ];

    await put('assessment_assignments', states.map(s => ({
      id: `seed_assign_${s.talent}`,
      assessment_id: `seed_assessment_${s.role}`,
      talent_id: `seed_tp_${s.talent}`,
      status: s.status,
      start_time: s.status === 'not_started' ? null : iso(daysFromNow(-12)),
      end_time: s.status === 'completed' ? iso(daysFromNow(-12)) : null,
      score: s.score
    })));
  }

  // ── Compliance templates ──────────────────────────────────────────────────
  if (wants('compliance')) {
    await put('documents', [
      { id: 'seed_doc_nda', name: 'Mutual Non-Disclosure Agreement', type: 'NDA',
        status: 'pending_signature', is_mandatory: true, is_template: true, is_hidden: false,
        user_id: null, uploaded_at: iso(monthsAgo(6)),
        description: 'Signed by every candidate before they are put in front of a client.' },
      { id: 'seed_doc_agreement', name: 'Contractor Agreement', type: 'agreement',
        status: 'pending_signature', is_mandatory: true, is_template: true, is_hidden: false,
        user_id: null, uploaded_at: iso(monthsAgo(6)),
        description: 'The master terms between Kongila and the contractor.' },
      { id: 'seed_doc_ethics', name: 'IT and Ethics Policy', type: 'IT_Ethics_Policy',
        status: 'pending_signature', is_mandatory: true, is_template: true, is_hidden: false,
        user_id: null, uploaded_at: iso(monthsAgo(6)),
        description: 'Acceptable use, data handling and conflict of interest.' },

      // A current CV plus two superseded versions, so the version history
      // screen has a chain to show.
      { id: 'seed_doc_cv_ada_v1', user_id: 'seed_talent_ada', name: 'Ada Okafor CV.pdf',
        type: 'CV', status: 'uploaded', version_number: 1, is_current: false,
        superseded_by_id: 'seed_doc_cv_ada_v3', uploaded_at: iso(monthsAgo(8)) },
      { id: 'seed_doc_cv_ada_v2', user_id: 'seed_talent_ada', name: 'Ada Okafor CV.pdf',
        type: 'CV', status: 'uploaded', version_number: 2, is_current: false,
        superseded_by_id: 'seed_doc_cv_ada_v3', uploaded_at: iso(monthsAgo(4)) },
      { id: 'seed_doc_cv_ada_v3', user_id: 'seed_talent_ada', name: 'Ada Okafor CV.pdf',
        type: 'CV', status: 'uploaded', version_number: 3, is_current: true,
        uploaded_at: iso(monthsAgo(1)) },

      // One valid certification, one expiring inside the warning window,
      // one already lapsed, so the nightly expiry pass has all three cases.
      { id: 'seed_doc_cert_valid', user_id: 'seed_talent_ada', name: 'AWS Solutions Architect',
        certification_name: 'AWS Solutions Architect', issuing_body: 'Amazon Web Services',
        type: 'certification', status: 'uploaded', is_current: true,
        issue_date: dateOnly(monthsAgo(10)), expiry_date: dateOnly(daysFromNow(400)),
        uploaded_at: iso(monthsAgo(10)) },
      { id: 'seed_doc_cert_soon', user_id: 'seed_talent_bola', name: 'Scrum Master',
        certification_name: 'Professional Scrum Master I', issuing_body: 'Scrum.org',
        type: 'certification', status: 'uploaded', is_current: true,
        issue_date: dateOnly(monthsAgo(22)), expiry_date: dateOnly(daysFromNow(12)),
        uploaded_at: iso(monthsAgo(22)) },
      { id: 'seed_doc_cert_expired', user_id: 'seed_talent_chidi', name: 'Power BI Analyst',
        certification_name: 'Microsoft Power BI Data Analyst', issuing_body: 'Microsoft',
        type: 'certification', status: 'uploaded', is_current: true,
        issue_date: dateOnly(monthsAgo(26)), expiry_date: dateOnly(daysFromNow(-45)),
        uploaded_at: iso(monthsAgo(26)) }
    ]);

    // The two deployed candidates have signed everything; the rest have not,
    // so the compliance gate actually refuses somebody.
    await put('document_signatures', ['ada', 'bola'].flatMap(who =>
      ['seed_doc_nda', 'seed_doc_agreement', 'seed_doc_ethics'].map(doc => ({
        id: `seed_sig_${who}_${doc.replace('seed_doc_', '')}`,
        document_id: doc,
        talent_id: `seed_tp_${who}`,
        signer_name: TALENTS.find(t => t.id === `seed_talent_${who}`).name,
        signed_at: iso(monthsAgo(2))
      }))
    ));
  }

  // ── Requests across all four service lines ────────────────────────────────
  if (wants('requests')) {
    // talent_requests keeps the intake detail in a jsonb `payload` column.
    // There are no flat role_title or budget columns on this table.
    const request = (id, clientId, serviceType, title, status, payload, daysAgo) => ({
      id, client_id: clientId, service_type: serviceType, title, status,
      role_description: payload.description,
      payload: JSON.stringify({ ...payload, serviceType, roleTitle: payload.roleTitle }),
      created_at: iso(daysFromNow(-daysAgo))
    });

    await put('talent_requests', [
      request(REQUEST_IDS.backend, 'seed_client_northwind', 'Managed Workforce',
        'Backend Engineer', 'Onboarding', {
          roleTitle: 'Backend Engineer', numOfTalents: 1,
          budgetMinUsd: 2500, budgetMaxUsd: 3200, urgencyLevel: 'Standard',
          description: 'Backend engineer to own the logistics API, managed by Kongila.'
        }, 90),
      request(REQUEST_IDS.frontend, 'seed_client_lumen', 'Outsource Talent',
        'Frontend Engineer', 'Onboarding', {
          roleTitle: 'Frontend Engineer', numOfTalents: 1,
          budgetMinUsd: 2000, budgetMaxUsd: 2600, urgencyLevel: 'ASAP',
          description: 'React engineer for the patient portal.'
        }, 60),
      request(REQUEST_IDS.analyst, 'seed_client_northwind', 'Hire Talent',
        'Data Analyst', 'Client Interview', {
          roleTitle: 'Data Analyst', numOfTalents: 1,
          budgetMinUsd: 1800, budgetMaxUsd: 2400, urgencyLevel: 'Standard',
          description: 'Permanent analyst hire, employed directly by Northwind.'
        }, 21),
      request(REQUEST_IDS.support, 'seed_client_lumen', 'Project Execution',
        'Support Migration', 'Candidates Ready', {
          roleTitle: 'Support Migration', numOfTalents: 2,
          budgetMinUsd: 8000, budgetMaxUsd: 14000, urgencyLevel: 'Standard',
          description: 'Migrate three years of support history into a new helpdesk.'
        }, 10),
      request(REQUEST_IDS.va, 'seed_client_northwind', 'Outsource Talent',
        'Virtual Assistant', 'New Request', {
          roleTitle: 'Virtual Assistant', numOfTalents: 1,
          budgetMinUsd: 800, budgetMaxUsd: 1200, urgencyLevel: 'Standard',
          description: 'Inbox and calendar support for two directors.'
        }, 2)
    ]);

    await put('matches', [
      { id: 'seed_match_ada', request_id: REQUEST_IDS.backend, talent_id: 'seed_tp_ada',
        status: 'accepted', score: 92 },
      { id: 'seed_match_bola', request_id: REQUEST_IDS.frontend, talent_id: 'seed_tp_bola',
        status: 'accepted', score: 88 },
      { id: 'seed_match_chidi', request_id: REQUEST_IDS.analyst, talent_id: 'seed_tp_chidi',
        status: 'shortlisted', score: 84 },
      { id: 'seed_match_dayo', request_id: REQUEST_IDS.support, talent_id: 'seed_tp_dayo',
        status: 'shortlisted', score: 71 }
    ]);
  }

  // ── Interviews ────────────────────────────────────────────────────────────
  if (wants('interviews')) {
    // The column is scheduled_time. There is no scheduled_at, and the
    // separate date and time columns are what several screens read.
    const interview = (id, talentId, clientId, requestId, status, when, tz, minutes, title) => ({
      id, talent_id: talentId, client_id: clientId, request_id: requestId,
      title, status, interview_type: 'video',
      scheduled_time: iso(when),
      date: dateOnly(when), time: iso(when).slice(11, 16),
      duration_minutes: minutes,
      scheduled_timezone: tz, client_timezone: tz, talent_timezone: 'Africa/Lagos',
      created_at: iso(daysFromNow(-5))
    });

    await put('interviews', [
      interview('seed_int_chidi', 'seed_tp_chidi', 'seed_client_northwind', REQUEST_IDS.analyst,
        'Proposed', daysFromNow(3), 'Europe/London', 45, 'Data Analyst — first conversation'),
      interview('seed_int_dayo', 'seed_tp_dayo', 'seed_client_lumen', REQUEST_IDS.support,
        'Scheduled', daysFromNow(1), 'America/New_York', 30, 'Support migration — scoping call'),
      interview('seed_int_bola', 'seed_tp_bola', 'seed_client_lumen', REQUEST_IDS.frontend,
        'Completed', daysFromNow(-30), 'America/New_York', 60, 'Frontend Engineer — technical')
    ]);
  }

  // ── Contracts, one per service line ───────────────────────────────────────
  if (wants('contracts')) {
    await put('contracts', [
      { id: 'seed_contract_ada', talent_id: 'seed_tp_ada', client_id: 'seed_client_northwind',
        service_type: 'Managed Workforce', rate_type: 'Monthly', rate_amount: 2800,
        currency: 'USD', payment_terms_days: 30, status: 'active',
        start_date: dateOnly(monthsAgo(3)), billing_model: 'recurring_monthly',
        billed_through: period(monthsAgo(1)), signed_at: iso(monthsAgo(3)) },
      { id: 'seed_contract_bola', talent_id: 'seed_tp_bola', client_id: 'seed_client_lumen',
        service_type: 'Outsource Talent', rate_type: 'Monthly', rate_amount: 2400,
        currency: 'USD', payment_terms_days: 14, status: 'active',
        start_date: dateOnly(daysFromNow(-45)), billing_model: 'recurring_monthly',
        billed_through: null, signed_at: iso(daysFromNow(-45)) },
      { id: 'seed_contract_chidi', talent_id: 'seed_tp_chidi', client_id: 'seed_client_northwind',
        service_type: 'Hire Talent', rate_type: 'Monthly', rate_amount: 2000,
        currency: 'USD', payment_terms_days: 14, status: 'pending_signatures',
        start_date: dateOnly(daysFromNow(14)), billing_model: 'placement_fee',
        placement_fee_usd: 7200 },
      { id: 'seed_contract_project', talent_id: 'seed_tp_dayo', client_id: 'seed_client_lumen',
        service_type: 'Project Execution', rate_type: 'Monthly', rate_amount: 0,
        currency: 'USD', payment_terms_days: 30, status: 'active',
        start_date: dateOnly(daysFromNow(-20)), end_date: dateOnly(daysFromNow(40)),
        billing_model: 'project_fee', project_fee_usd: 11000 }
    ]);
  }

  // ── Fees, so billing and payroll can actually run ─────────────────────────
  if (wants('fees')) {
    await put('fee_config', [
      { id: 'fee_placement', service_line: 'placement', client_fee_pct: 0.20, talent_commission_pct: 0 },
      { id: 'fee_outsourcing', service_line: 'outsourcing', client_fee_pct: 0.15, talent_commission_pct: 0.10 },
      { id: 'fee_managed_workforce', service_line: 'managed_workforce', client_fee_pct: 0.25, talent_commission_pct: 0.10 },
      { id: 'fee_project', service_line: 'project', client_fee_pct: 0.30, talent_commission_pct: 0.15 }
    ], 'service_line');
    console.log('    (demo margins, not Kongila\'s real commercial terms)');
  }

  // ── Invoices at each status, including one properly overdue ───────────────
  if (wants('invoices')) {
    const lastMonth = period(monthsAgo(1));
    const twoMonths = period(monthsAgo(2));

    await put('invoices', [
      { id: 'seed_inv_paid', invoice_number: `KNG-INV-${twoMonths.replace('-', '')}-0001`,
        client_id: 'seed_client_northwind', contract_id: 'seed_contract_ada',
        period: twoMonths, service_line: 'managed_workforce',
        amount: 3500, subtotal_usd: 3500, tax_amount_usd: 0, total_usd: 3500,
        total_amount_usd: 3500, currency: 'USD', usd_rate: 1, rate_source: 'same_currency',
        status: 'paid', payment_terms_days: 30,
        issued_at: iso(monthsAgo(2)), sent_at: iso(monthsAgo(2)),
        due_date: iso(daysFromNow(-28)), created_at: iso(monthsAgo(2)) },

      { id: 'seed_inv_overdue', invoice_number: `KNG-INV-${lastMonth.replace('-', '')}-0001`,
        client_id: 'seed_client_northwind', contract_id: 'seed_contract_ada',
        period: lastMonth, service_line: 'managed_workforce',
        amount: 3500, subtotal_usd: 3500, tax_amount_usd: 0, total_usd: 3500,
        total_amount_usd: 3500, currency: 'USD', usd_rate: 1, rate_source: 'same_currency',
        // Left at 'sent' with a past due date, so the nightly pass has
        // something real to move to overdue the first time you run it.
        status: 'sent', payment_terms_days: 30,
        issued_at: iso(monthsAgo(1)), sent_at: iso(monthsAgo(1)),
        due_date: iso(daysFromNow(-9)), created_at: iso(monthsAgo(1)) },

      { id: 'seed_inv_disputed', invoice_number: `KNG-INV-${lastMonth.replace('-', '')}-0002`,
        client_id: 'seed_client_lumen', contract_id: 'seed_contract_bola',
        period: lastMonth, service_line: 'outsourcing',
        amount: 2760, subtotal_usd: 2760, tax_amount_usd: 0, total_usd: 2760,
        total_amount_usd: 2760, currency: 'USD', usd_rate: 1, rate_source: 'same_currency',
        status: 'sent', payment_terms_days: 14, is_disputed: true,
        dispute_reason: 'Two days of the period were covered by our own team.',
        issued_at: iso(monthsAgo(1)), sent_at: iso(monthsAgo(1)),
        due_date: iso(daysFromNow(-4)), created_at: iso(monthsAgo(1)) },

      { id: 'seed_inv_draft', client_id: 'seed_client_lumen', contract_id: 'seed_contract_project',
        service_line: 'project',
        amount: 11000, subtotal_usd: 11000, tax_amount_usd: 0, total_usd: 11000,
        total_amount_usd: 11000, currency: 'USD', usd_rate: 1, rate_source: 'same_currency',
        status: 'draft', payment_terms_days: 30, created_at: iso(daysFromNow(-3)) }
    ]);

    await put('invoice_line_items', [
      { id: 'seed_ili_paid', invoice_id: 'seed_inv_paid', quantity: 1,
        description: `Ada Okafor — managed workforce, ${twoMonths}`,
        unit_amount: 3500, amount: 3500 },
      { id: 'seed_ili_overdue', invoice_id: 'seed_inv_overdue', quantity: 1,
        description: `Ada Okafor — managed workforce, ${lastMonth}`,
        unit_amount: 3500, amount: 3500 },
      { id: 'seed_ili_disputed', invoice_id: 'seed_inv_disputed', quantity: 1,
        description: `Bola Hassan — outsourcing, ${lastMonth}`,
        unit_amount: 2760, amount: 2760 },
      { id: 'seed_ili_draft', invoice_id: 'seed_inv_draft', quantity: 1,
        description: 'Support history migration — fixed project fee',
        unit_amount: 11000, amount: 11000 }
    ]);

    await put('talent_payouts', [
      { id: 'seed_payout_paid', talent_id: 'seed_tp_ada', contract_id: 'seed_contract_ada',
        invoice_id: 'seed_inv_paid', period: twoMonths,
        gross_amount: 2800, commission_pct: 0.10, net_amount: 2520, amount: 2520,
        net_amount_usd: 2520, currency: 'USD', usd_rate: 1, rate_source: 'same_currency',
        status: 'paid', paid_at: iso(daysFromNow(-25)), created_at: iso(monthsAgo(2)) },
      { id: 'seed_payout_pending', talent_id: 'seed_tp_ada', contract_id: 'seed_contract_ada',
        invoice_id: 'seed_inv_overdue', period: lastMonth,
        gross_amount: 2800, commission_pct: 0.10, net_amount: 2520, amount: 2520,
        net_amount_usd: 2520, currency: 'USD', usd_rate: 1, rate_source: 'same_currency',
        // Pending against an unpaid invoice, so approving it is correctly
        // blocked until the client settles.
        status: 'pending', created_at: iso(monthsAgo(1)) }
    ]);
  }

  // ── Support and messages ──────────────────────────────────────────────────
  if (wants('support')) {
    await put('support_tickets', [
      { id: 'seed_tkt_open', client_id: 'seed_client_northwind',
        subject: 'Invoice query for last month', category: 'Billing Issue',
        description: 'The November invoice looks higher than the agreed rate.',
        status: 'Open', priority: 'High',
        created_at: iso(daysFromNow(-3)), last_activity: iso(daysFromNow(-3)) },
      { id: 'seed_tkt_progress', talent_id: 'seed_tp_bola',
        subject: 'Cannot upload my renewed certificate', category: 'Technical Support',
        description: 'The upload fails at 80% every time.',
        status: 'In Progress', priority: 'Medium',
        created_at: iso(daysFromNow(-6)), last_activity: iso(daysFromNow(-1)) },
      { id: 'seed_tkt_resolved', talent_id: 'seed_tp_ada',
        subject: 'Payout date confirmation', category: 'Guidance',
        description: 'Wanted to confirm when October payouts land.',
        status: 'Resolved', priority: 'Low',
        created_at: iso(daysFromNow(-20)), last_activity: iso(daysFromNow(-18)) }
    ]);

    await put('support_messages', [
      { id: 'seed_smsg_1', ticket_id: 'seed_tkt_progress',
        sender_name: 'Bola Hassan', sender_role: 'talent', is_support: false,
        text: 'It gets to 80% and then says upload failed. Tried twice on two networks.',
        timestamp: iso(daysFromNow(-6)), created_at: iso(daysFromNow(-6)) },
      { id: 'seed_smsg_2', ticket_id: 'seed_tkt_progress',
        sender_name: 'Tola Talent', sender_role: 'admin', is_support: true,
        text: 'Thanks Bola. What size is the file? Anything over 5MB is rejected.',
        timestamp: iso(daysFromNow(-1)), created_at: iso(daysFromNow(-1)) }
    ]);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const written = report.filter(r => r.status === 'ok').reduce((sum, r) => sum + r.count, 0);

  console.log(`\n  ${written} rows written across ${report.filter(r => r.status === 'ok').length} tables.`);

  if (failures > 0) {
    console.log(`  ${failures} table${failures === 1 ? '' : 's'} failed. Those are listed above.`);
    console.log('  A failure usually means that migration has not been run on this project yet.');
  }

  console.log(`
  Sign in with any of these. Password for all of them: ${DEMO_PASSWORD}

    Admin portal
      ${ADMINS.map(a => `${a.email}  (${a.role})`).join('\n      ')}

    Client portal
      ${CLIENTS.map(c => `${c.email}  (${c.company})`).join('\n      ')}

    Talent portal
      ${TALENTS.map(t => `${t.email}  (${t.role}, ${t.stage})`).join('\n      ')}

  Things worth trying, which the data is set up for:
    - Payroll: generate the run for ${period(monthsAgo(1))}. Two people, one prorated.
    - Billing: generate drafts. The placement and project contracts bill
      differently from the two monthly ones.
    - Overdue: run the nightly cron. seed_inv_overdue moves to overdue;
      the disputed one deliberately does not.
    - Compliance: try to extend an offer to Chidi, who has signed nothing.
    - Payouts: try to approve seed_payout_pending. Its invoice is unpaid.
    - Documents: Ada has three CV versions; Chidi has a lapsed certificate.
`);
}

(async () => {
  try {
    if (CLEAN) await clean();
    else await seed();
    process.exit(failures > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n  The seeder stopped:', error.message, '\n');
    process.exit(1);
  }
})();
