#!/usr/bin/env node
/**
 * Kongila — why is every screen empty?
 *
 * Both portals get their data from one place: readDbAsync, called by
 * /api/resources. That function reads every table inside a single try/catch,
 * and on any throw it returns an empty database rather than failing. That is
 * the right behaviour for a network blip and the worst possible behaviour for
 * debugging, because one broken table looks exactly like an account with no
 * data in it.
 *
 * This walks the same path readDbAsync does and reports each step, so the
 * failing one is named instead of guessed at. It reads and changes nothing.
 *
 * Usage:
 *   node scripts/diagnose-data.js
 *
 * Needs SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and
 * SUPABASE_SERVICE_ROLE_KEY in the environment or in .env at the repo root.
 */

const path = require('path');

try {
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
} catch (e) {
  // dotenv is a root dependency; the environment may carry the variables anyway.
}

function die(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url) die('No SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in the environment or .env.');
if (!serviceKey) die('No SUPABASE_SERVICE_ROLE_KEY.');

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

const ok = n => (n ? '  ok  ' : ' FAIL ');

/** Every table readDbAsync reads, in the order it reads them. */
const TABLES = [
  'users', 'organizations', 'client_profiles', 'talent_profiles', 'skills',
  'talent_skills', 'documents', 'talent_requests', 'matches', 'projects',
  'tasks', 'contracts', 'assignments', 'invoices', 'payments', 'talent_payouts',
  'messages', 'notifications', 'audit_logs', 'agent_logs', 'support_tickets',
  'support_messages', 'interviews', 'request_activity_logs', 'conversations',
  'assessments', 'assessment_categories', 'assessment_questions',
  'assessment_assignments', 'skill_assessment_results', 'talent_skill_assessments',
  'roles', 'user_roles',
  // Added 2026-11-10. The newest thing in the read, so the first suspect.
  'work_simulation_tasks'
];

async function countOf(table) {
  try {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    if (error) return { error: error.message, code: error.code };
    return { count: count ?? 0 };
  } catch (err) {
    // A throw here, rather than an error object, is what collapses
    // readDbAsync into its catch and empties every screen.
    return { threw: true, error: err?.message || String(err) };
  }
}

async function main() {
  console.log('\n  Kongila data diagnosis');
  console.log(`  project : ${url}\n`);

  // ── 1. The RPC the read prefers ────────────────────────────────────────
  console.log('  1. get_full_db_state (the fast path)');
  let rpcKeys = null;
  try {
    const { data, error } = await supabase.rpc('get_full_db_state');
    if (error) {
      console.log(`    ${ok(false)} ${error.message}`);
      console.log('          Not fatal: the read falls back to querying each table.');
    } else if (!data || typeof data !== 'object') {
      console.log(`    ${ok(false)} returned nothing usable`);
    } else {
      rpcKeys = Object.keys(data);
      console.log(`    ${ok(true)} returned ${rpcKeys.length} tables`);
      const empty = rpcKeys.filter(k => Array.isArray(data[k]) && data[k].length === 0);
      if (empty.length > 0) {
        console.log(`          empty in the RPC: ${empty.join(', ')}`);
      }
    }
  } catch (err) {
    console.log(`    ${ok(false)} threw: ${err?.message || err}`);
  }

  // ── 2. Every table, one at a time ──────────────────────────────────────
  console.log('\n  2. Each table');
  const broken = [];
  const threw = [];
  for (const table of TABLES) {
    const r = await countOf(table);
    if (r.threw) {
      threw.push(table);
      console.log(`    ${ok(false)} ${table.padEnd(30)} THREW: ${r.error}`);
    } else if (r.error) {
      broken.push(table);
      console.log(`    ${ok(false)} ${table.padEnd(30)} ${r.error}`);
    } else {
      console.log(`    ${ok(true)} ${table.padEnd(30)} ${r.count} row(s)`);
    }
  }

  // ── 3. What it means ───────────────────────────────────────────────────
  console.log('\n  3. Reading of it');

  if (threw.length > 0) {
    console.log(`    These threw rather than returning an error: ${threw.join(', ')}`);
    console.log('    A throw inside readDbAsync is caught at the top and the whole');
    console.log('    function returns an empty database, which is why every screen is');
    console.log('    blank rather than just the part that uses these.');
  }

  if (broken.includes('work_simulation_tasks')) {
    console.log('    work_simulation_tasks is unreadable. Run:');
    console.log('      packages/database/migrations/2026-11-10b_work_simulation_tasks.sql');
    console.log('    The read no longer depends on it, so this alone should not empty');
    console.log('    the portals once the current code is deployed.');
  }

  const core = ['users', 'talent_profiles', 'talent_requests'];
  const coreBroken = core.filter(t => broken.includes(t) || threw.includes(t));
  if (coreBroken.length > 0) {
    console.log(`    Core tables are unreadable: ${coreBroken.join(', ')}.`);
    console.log('    Check the service role key and RLS policies on those tables.');
  }

  if (broken.length === 0 && threw.length === 0) {
    console.log('    Every table reads. If the portals are still empty, the problem is');
    console.log('    after the read — scoping, or the browser request. Next step:');
    console.log('      1. Sign in, open the browser network tab');
    console.log('      2. Find the request to /api/resources?names=...');
    console.log('      3. Report its status code and the first line of its response');
    console.log('    A 401 means the session token is not reaching the route; a 500');
    console.log('    means the server log has the real error in it.');
  }

  console.log('');
}

main().catch(err => die(err?.message || String(err)));
