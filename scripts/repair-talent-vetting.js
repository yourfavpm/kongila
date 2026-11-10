#!/usr/bin/env node
/**
 * Kongila — inspect, and optionally repair, a candidate's vetting state.
 *
 * Why this exists.
 *
 * Two faults combined to leave candidates in a state the portals disagreed
 * about, and this reports on both and fixes what it safely can.
 *
 *   1. No pipeline. `ensureVettingPipeline` ran at the end of onboarding and
 *      wrote `vetting_pipeline` directly. On a database where the
 *      2026-11-09c migration has not run that column does not exist, so the
 *      write was rejected, the warning went to a server log, and the
 *      candidate finished onboarding with no pipeline at all. Their
 *      dashboard had no stage to show, Vetting Progress sat at 0 of 7, and
 *      in the admin portal the stage controls had no stage record to act on.
 *
 *   2. A status with nothing behind it. A row carrying
 *      `vetting_status = 'Vetted'` and a grade, but with no pipeline, was
 *      read by the candidate's overview as a finished vetting: "Vetting
 *      Complete - A", beside a Vetting Progress tab correctly reading 0 of 7.
 *      The overview no longer trusts the status on its own, but the row is
 *      still wrong, and an operator looking at the candidate list still sees
 *      a grade nobody awarded.
 *
 * What it does.
 *
 *   Default is a dry run: it prints what it found and what it would change,
 *   and writes nothing. Pass --apply to make the changes.
 *
 *   --create-pipeline   give the candidate the standard seven stages, all
 *                       pending, if they have none. This is what should have
 *                       happened at the end of onboarding.
 *   --reset-grade       put vetting_status back to Applied and grade back to
 *                       Ungraded, for a candidate whose stages show no
 *                       assessment. Refuses when the pipeline shows real
 *                       progress, so a genuinely vetted candidate cannot be
 *                       reset by accident.
 *
 * Usage:
 *   node scripts/repair-talent-vetting.js <email-or-id>
 *   node scripts/repair-talent-vetting.js <email-or-id> --create-pipeline --apply
 *   node scripts/repair-talent-vetting.js <email-or-id> --create-pipeline --reset-grade --apply
 *   node scripts/repair-talent-vetting.js --all            (dry run over every candidate)
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

const STAGE_NAMES = [
  'Application Screening',
  'Skill Assessment',
  'Behavioural Interview',
  'Personality Test',
  'Remote Readiness',
  'Work Simulation',
  'Final Review'
];

function die(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('--')));
const target = args.find(a => !a.startsWith('--'));

const APPLY = flags.has('--apply');
const CREATE_PIPELINE = flags.has('--create-pipeline');
const RESET_GRADE = flags.has('--reset-grade');
const ALL = flags.has('--all');

if (!target && !ALL) {
  die(
    'Usage: node scripts/repair-talent-vetting.js <email-or-id> [--create-pipeline] [--reset-grade] [--apply]\n' +
    '       node scripts/repair-talent-vetting.js --all\n\n' +
    '  Without --apply nothing is written.'
  );
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) die('No SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL found in the environment or .env.');
if (!serviceKey) {
  die(
    'No SUPABASE_SERVICE_ROLE_KEY found. This script needs it: reading and repairing\n' +
    '  talent_profiles requires bypassing RLS. Find it under Project Settings, API,\n' +
    '  service_role in the Supabase dashboard.'
  );
}

// Required after the checks above, so a usage mistake prints a usage message
// rather than a module resolution error. The repo root declares dotenv and
// nothing else, and pnpm does not hoist, so the fallback resolves from
// packages/database, which does declare supabase-js.
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

function defaultPipeline() {
  return STAGE_NAMES.map((stageName, stageIndex) => ({
    stageIndex,
    stageName,
    status: stageIndex === 0 ? 'in_progress' : 'pending'
  }));
}

/** Reads the pipeline from the column if it is there, else from the bio envelope. */
function pipelineOf(row, columnsExist) {
  if (columnsExist && Array.isArray(row.vetting_pipeline) && row.vetting_pipeline.length > 0) {
    return { pipeline: row.vetting_pipeline, from: 'column' };
  }
  try {
    const parsed = JSON.parse(row.bio || '{}');
    const fromEnvelope = parsed?.telemetry?.vettingPipeline;
    if (Array.isArray(fromEnvelope) && fromEnvelope.length > 0) {
      return { pipeline: fromEnvelope, from: 'bio envelope' };
    }
  } catch (e) {
    // A plain-text bio is not an envelope. That is normal, not an error.
  }
  return { pipeline: [], from: 'nowhere' };
}

function settledCount(pipeline) {
  return pipeline.filter(s => s && (s.status === 'passed' || s.status === 'skipped')).length;
}

function touched(pipeline) {
  // Any sign an operator has actually worked this candidate.
  return pipeline.some(s =>
    s && (['passed', 'failed', 'skipped'].includes(s.status) || s.score != null || s.assessmentId || s.interviewId)
  );
}

async function detectColumns() {
  const { error } = await supabase.from('talent_profiles').select('vetting_pipeline').limit(1);
  if (!error) return true;
  const undefinedColumn =
    error.code === '42703' || /does not exist|could not find/i.test(String(error.message || ''));
  if (undefinedColumn) return false;
  die(`Could not read talent_profiles: ${error.message}`);
}

async function loadRows(columnsExist) {
  const columns = columnsExist
    ? 'id, user_id, full_name, vetting_stage, vetting_status, grade, bio, vetting_pipeline'
    : 'id, user_id, full_name, vetting_stage, vetting_status, grade, bio';

  if (ALL) {
    const { data, error } = await supabase.from('talent_profiles').select(columns).order('full_name');
    if (error) die(`Could not list candidates: ${error.message}`);
    return data || [];
  }

  // By profile id first, then by the user's email.
  const byId = await supabase.from('talent_profiles').select(columns).eq('id', target).maybeSingle();
  if (byId.data) return [byId.data];

  const { data: user, error: userError } = await supabase
    .from('users').select('id').ilike('email', target).maybeSingle();
  if (userError) die(`Could not look up that email: ${userError.message}`);
  if (!user) die(`No candidate found for "${target}". Try their talent profile id.`);

  const { data, error } = await supabase.from('talent_profiles').select(columns)
    .or(`id.eq.${user.id},user_id.eq.${user.id}`).limit(1);
  if (error) die(`Could not load that candidate: ${error.message}`);
  if (!data || data.length === 0) die(`"${target}" has a user account but no talent profile.`);
  return data;
}

async function repair(row, columnsExist) {
  const { pipeline, from } = pipelineOf(row, columnsExist);
  const name = row.full_name || row.id;

  console.log(`\n  ${name}`);
  console.log(`    id              ${row.id}`);
  console.log(`    vetting_status  ${row.vetting_status || '(none)'}`);
  console.log(`    grade           ${row.grade || '(none)'}`);
  console.log(`    vetting_stage   ${row.vetting_stage || '(none)'}`);
  console.log(`    pipeline        ${pipeline.length} stages, from ${from}`);
  if (pipeline.length > 0) {
    console.log(`    settled         ${settledCount(pipeline)} of ${pipeline.length}`);
  }

  const problems = [];
  const isVettedish = ['Vetted', 'Matched', 'Deployed'].includes(String(row.vetting_status || ''));
  const hasGrade = row.grade && !/^(ungraded|none|n\/a|pending)$/i.test(String(row.grade));

  if (pipeline.length === 0) {
    problems.push('no vetting pipeline, so nothing can be assessed or advanced');
  }
  if (isVettedish && settledCount(pipeline) < pipeline.length) {
    problems.push(`status is "${row.vetting_status}" but the pipeline is not finished`);
  }
  if (hasGrade && settledCount(pipeline) < pipeline.length) {
    problems.push(`graded "${row.grade}" without a finished assessment`);
  }

  if (problems.length === 0) {
    console.log('    → consistent, nothing to do');
    return { changed: false };
  }
  for (const p of problems) console.log(`    ⚠ ${p}`);

  const patch = {};

  if (CREATE_PIPELINE && pipeline.length === 0) {
    patch.__pipeline = defaultPipeline();
  }

  if (RESET_GRADE && (isVettedish || hasGrade)) {
    if (touched(pipeline)) {
      console.log('    → NOT resetting: this pipeline shows real assessment work. Check it by hand.');
    } else {
      patch.vetting_status = 'Applied';
      patch.grade = 'Ungraded';
      patch.vetting_stage = 'Application Screening';
    }
  }

  if (Object.keys(patch).length === 0) {
    console.log('    → no repair selected. Add --create-pipeline and/or --reset-grade.');
    return { changed: false };
  }

  const planned = [];
  if (patch.__pipeline) planned.push(`create a ${patch.__pipeline.length}-stage pipeline, all pending`);
  if (patch.vetting_status) planned.push('reset status to Applied and grade to Ungraded');
  console.log(`    → would ${planned.join(', and ')}`);

  if (!APPLY) return { changed: false, wouldChange: true };

  // The pipeline goes into both places: the column when it exists, and the
  // bio envelope always, which is what the product falls back to before the
  // 2026-11-09c migration.
  const write = { ...patch };
  delete write.__pipeline;

  if (patch.__pipeline) {
    let envelope;
    try {
      envelope = JSON.parse(row.bio || '{}');
    } catch (e) {
      envelope = {};
    }
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) envelope = {};
    if (!envelope.__kongila) {
      // A plain-text bio becomes an envelope that keeps the text.
      envelope = { __kongila: true, tags: [], scores: {}, telemetry: {}, bio: String(row.bio || '') };
    }
    envelope.telemetry = { ...(envelope.telemetry || {}), vettingPipeline: patch.__pipeline };
    write.bio = JSON.stringify(envelope);
    if (columnsExist) write.vetting_pipeline = patch.__pipeline;
  }

  const { error } = await supabase.from('talent_profiles').update(write).eq('id', row.id);
  if (error) {
    console.log(`    ✗ not saved: ${error.message}`);
    return { changed: false, failed: true };
  }

  // Read back rather than assume.
  const check = await supabase
    .from('talent_profiles')
    .select(columnsExist ? 'vetting_status, grade, vetting_pipeline, bio' : 'vetting_status, grade, bio')
    .eq('id', row.id).maybeSingle();

  const after = pipelineOf(check.data || {}, columnsExist);
  console.log(`    ✓ saved — status ${check.data?.vetting_status}, grade ${check.data?.grade}, `
    + `${after.pipeline.length} stages from ${after.from}`);
  return { changed: true };
}

async function main() {
  console.log(`\n  Kongila candidate vetting repair`);
  console.log(`  project : ${url}`);
  console.log(`  mode    : ${APPLY ? 'APPLY — changes will be written' : 'dry run — nothing will be written'}`);

  const columnsExist = await detectColumns();
  console.log(`  columns : vetting_pipeline ${columnsExist ? 'present' : 'MISSING'}`);
  if (!columnsExist) {
    console.log(
      '            The 2026-11-09c migration has not run on this database. Vetting state\n' +
      '            is being kept in the bio envelope instead, which works, but run\n' +
      '            packages/database/migrations/2026-11-09c_vetting_columns.sql when you can.'
    );
  }

  const rows = await loadRows(columnsExist);
  console.log(`  found   : ${rows.length} candidate${rows.length === 1 ? '' : 's'}`);

  let changed = 0;
  let wouldChange = 0;
  for (const row of rows) {
    const result = await repair(row, columnsExist);
    if (result.changed) changed++;
    if (result.wouldChange) wouldChange++;
  }

  console.log('');
  if (APPLY) {
    console.log(`  ${changed} candidate${changed === 1 ? '' : 's'} repaired.\n`);
  } else if (wouldChange > 0) {
    console.log(`  ${wouldChange} candidate${wouldChange === 1 ? '' : 's'} would change. Re-run with --apply.\n`);
  } else {
    console.log('  Nothing to change.\n');
  }
}

main().catch(err => die(err.message));
