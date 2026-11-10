#!/usr/bin/env node
/**
 * Kongila — why can't this candidate take their assessment?
 *
 * The assessment flow has several places where it fails without saying
 * anything: the portal's "Start Assessment" button returns silently when the
 * assignment is not submittable, the admin's assign call fails if the
 * 2026-11-10 migration has not run, and a stage can point at an assignment
 * row that was never written. From the outside all three look identical —
 * nothing happens.
 *
 * This reports the actual state at every link in the chain, read only. It
 * writes nothing and changes nothing.
 *
 * Usage:
 *   node scripts/diagnose-assessment.js <email-or-talent-id>
 *   node scripts/diagnose-assessment.js --all     (every candidate, summary)
 *
 * Needs SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and
 * SUPABASE_SERVICE_ROLE_KEY in the environment or in .env at the repo root.
 */

const path = require('path');

try {
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
} catch (e) {
  // dotenv is a root dependency; the environment may carry the variables
  // anyway, so this is not fatal.
}

function die(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

const args = process.argv.slice(2);
const ALL = args.includes('--all');
const target = args.find(a => !a.startsWith('--'));

if (!target && !ALL) {
  die('Usage: node scripts/diagnose-assessment.js <email-or-talent-id>\n' +
      '       node scripts/diagnose-assessment.js --all');
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url) die('No SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in the environment or .env.');
if (!serviceKey) die('No SUPABASE_SERVICE_ROLE_KEY. This reads tables RLS protects.');

let createClient;
try {
  ({ createClient } = require('@supabase/supabase-js'));
} catch (e) {
  try {
    ({ createClient } = require(require.resolve('@supabase/supabase-js', {
      paths: [path.resolve(__dirname, '..', 'packages', 'database')]
    })));
  } catch (e2) {
    die('@supabase/supabase-js is not installed. Run pnpm install at the repo root first.');
  }
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const tick = ok => (ok ? '  ok  ' : ' FAIL ');

/** Does a column exist? Asks for it and reads the error. */
async function hasColumn(table, column) {
  const { error } = await supabase.from(table).select(column).limit(1);
  if (!error) return true;
  const undef = error.code === '42703' || /does not exist|could not find/i.test(String(error.message));
  return undef ? false : null; // null = could not tell
}

async function checkSchema() {
  console.log('\n  1. The migration');

  const checks = [
    ['talent_skill_assessments', 'deadline'],
    ['talent_skill_assessments', 'answers'],
    ['talent_skill_assessments', 'submittedAt'],
    ['skill_assessment_results', 'answers'],
    ['skill_assessment_results', 'needsReview'],
    ['work_simulation_tasks', 'id']
  ];

  let missing = 0;
  for (const [table, column] of checks) {
    const present = await hasColumn(table, column);
    if (present === false) missing++;
    console.log(`    ${tick(present === true)} ${table}.${column}`
      + (present === null ? '   (could not tell)' : ''));
  }

  if (missing > 0) {
    console.log(
      `\n    ${missing} missing. Assigning an assessment INSERTs "deadline", so it fails\n` +
      '    outright until this is run:\n' +
      '      packages/database/migrations/2026-11-10_assessment_columns.sql\n' +
      '      packages/database/migrations/2026-11-10b_work_simulation_tasks.sql'
    );
  }
  return missing === 0;
}

async function resolveTalent(ref) {
  const byId = await supabase.from('talent_profiles')
    .select('id, user_id, full_name, vetting_status, vetting_stage').eq('id', ref).maybeSingle();
  if (byId.data) return byId.data;

  const { data: user } = await supabase.from('users').select('id').ilike('email', ref).maybeSingle();
  if (!user) return null;

  const { data } = await supabase.from('talent_profiles')
    .select('id, user_id, full_name, vetting_status, vetting_stage')
    .or(`id.eq.${user.id},user_id.eq.${user.id}`).limit(1);
  return (data || [])[0] || null;
}

function pipelineOf(row) {
  if (Array.isArray(row.vetting_pipeline) && row.vetting_pipeline.length) return row.vetting_pipeline;
  try {
    const parsed = JSON.parse(row.bio || '{}');
    const p = parsed?.telemetry?.vettingPipeline;
    if (Array.isArray(p) && p.length) return p;
  } catch (e) { /* a plain-text bio is not an envelope */ }
  return [];
}

async function checkCandidate(ref) {
  const talent = await resolveTalent(ref);
  if (!talent) { console.log(`\n  No candidate matches "${ref}".`); return; }

  console.log(`\n  2. ${talent.full_name || talent.id}`);
  console.log(`     profile id  ${talent.id}`);
  console.log(`     status      ${talent.vetting_status || '(none)'} · stage ${talent.vetting_stage || '(none)'}`);

  // The pipeline, and what stage 1 points at.
  const cols = await hasColumn('talent_profiles', 'vetting_pipeline');
  const { data: full } = await supabase.from('talent_profiles')
    .select(cols ? 'bio, vetting_pipeline' : 'bio').eq('id', talent.id).maybeSingle();

  const pipeline = pipelineOf(full || {});
  console.log(`\n  3. The pipeline`);
  console.log(`    ${tick(pipeline.length > 0)} ${pipeline.length} stages`
    + (pipeline.length === 0 ? '   <- no pipeline, so no stage can be worked' : ''));

  const stage = pipeline[1]; // Skill Assessment
  if (stage) {
    console.log(`     stage 2 (Skill Assessment): ${stage.status || 'pending'}`
      + (stage.assessmentId ? ` · points at ${stage.assessmentId}` : ' · points at nothing'));
  }

  // The assignment rows.
  console.log(`\n  4. Assignments`);
  const { data: assignments, error: aErr } = await supabase
    .from('talent_skill_assessments').select('*').eq('talentId', talent.id);

  if (aErr) {
    console.log(`    ${tick(false)} could not read them: ${aErr.message}`);
    if (/talentId/.test(String(aErr.message))) {
      console.log('          The column is "talentId" (quoted camelCase). If this failed, the');
      console.log('          table is not the shape the code expects.');
    }
    return;
  }

  if (!assignments || assignments.length === 0) {
    console.log(`    ${tick(false)} none at all`);
    console.log('          Nothing was ever written for this candidate. Assign the assessment');
    console.log('          again from the admin portal — before the fix, assigning only set');
    console.log('          React state and the row was never created.');
  } else {
    for (const a of assignments) {
      console.log(`    ${tick(true)} ${a.id}`);
      console.log(`          assessment ${a.assessmentId} · status ${a.status}`
        + (a.deadline ? ` · due ${String(a.deadline).slice(0, 10)}` : ' · no deadline'));
      if (stage && stage.assessmentId && stage.assessmentId !== a.id) {
        console.log(`          NOTE the stage points at ${stage.assessmentId}, which is not this row.`);
      }
    }
  }

  // The assessment itself has to be published and have questions.
  const ids = [...new Set((assignments || []).map(a => a.assessmentId).filter(Boolean))];
  if (stage?.assessmentId) {
    const match = (assignments || []).find(a => a.id === stage.assessmentId);
    if (match?.assessmentId) ids.push(match.assessmentId);
  }

  console.log(`\n  5. The assessment`);
  if (ids.length === 0) {
    console.log('    (nothing to check — no assignment points at one)');
    return;
  }

  for (const id of [...new Set(ids)]) {
    const { data: asmnt } = await supabase
      .from('assessments').select('id, title, status, categories, passing_score').eq('id', id).maybeSingle();

    if (!asmnt) { console.log(`    ${tick(false)} ${id} does not exist`); continue; }

    const cats = Array.isArray(asmnt.categories) ? asmnt.categories : [];
    const { data: questions } = cats.length
      ? await supabase.from('assessment_questions').select('id, type').in('category_id', cats)
      : { data: [] };

    const published = String(asmnt.status) === 'published';
    const hasQuestions = (questions || []).length > 0;

    console.log(`    ${tick(published)} "${asmnt.title}" is ${asmnt.status}`
      + (published ? '' : '   <- a draft cannot be assigned or sat'));
    console.log(`    ${tick(cats.length > 0)} ${cats.length} categories`);
    console.log(`    ${tick(hasQuestions)} ${(questions || []).length} questions`
      + (hasQuestions ? '' : '   <- nothing to answer, so the runner has nothing to show'));

    if (hasQuestions) {
      const types = {};
      for (const q of questions) types[q.type] = (types[q.type] || 0) + 1;
      console.log(`          ${Object.entries(types).map(([t, n]) => `${n} ${t}`).join(', ')}`);
    }
  }

  // Anything already submitted blocks a retake, by design.
  console.log(`\n  6. Previous submissions`);
  const { data: results } = await supabase
    .from('skill_assessment_results').select('id, score, passed, submittedAt').eq('talentId', talent.id);

  if (!results || results.length === 0) {
    console.log('    none — nothing is blocking a first attempt');
  } else {
    for (const r of results) {
      console.log(`    ${r.id} · score ${r.score ?? '—'} · submitted ${String(r.submittedAt || '').slice(0, 10)}`);
    }
    console.log('          A submitted assessment cannot be sat again. That is deliberate.');
  }
}

async function main() {
  console.log('\n  Kongila assessment diagnosis');
  console.log(`  project : ${url}`);

  const schemaOk = await checkSchema();

  if (ALL) {
    const { data } = await supabase.from('talent_profiles').select('id, full_name').order('full_name').limit(50);
    console.log(`\n  ${(data || []).length} candidates\n`);
    for (const t of data || []) {
      const { data: a } = await supabase
        .from('talent_skill_assessments').select('id, status').eq('talentId', t.id);
      console.log(`    ${(t.full_name || t.id).padEnd(32)} ${(a || []).length} assignment(s)`
        + ((a || []).length ? ` · ${a.map(x => x.status).join(', ')}` : ''));
    }
  } else {
    await checkCandidate(target);
  }

  console.log('');
  if (!schemaOk) {
    console.log('  Start with the migration. Nothing else here can work until it is applied.\n');
  }
}

main().catch(err => die(err.message));
