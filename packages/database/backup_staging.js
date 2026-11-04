/**
 * Kongila — data backup
 *
 * Writes every row of every table to JSON, one file per table, into
 * backups/<timestamp>/. Uses the service role key over HTTPS, so it needs no
 * Postgres client and no database password.
 *
 * This is a DATA backup, not a full dump. It does not capture the schema,
 * sequences, functions, policies, storage objects or auth users. The schema
 * lives in packages/database/supabase_migration.sql and the policies in
 * packages/database/migrations/, so between them you can rebuild. Auth users
 * are not included, which means a restored database has rows for people who
 * cannot sign in until they are recreated.
 *
 * For a real backup, use the Supabase CLI:
 *   supabase db dump -f backups/schema.sql
 *   supabase db dump --data-only -f backups/data.sql
 *
 * Usage, from the repo root:
 *   node packages/database/backup_staging.js
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

// Ordered so a naive restore inserts parents before children. Keep this list
// in step with packages/database/supabase_migration.sql.
const TABLES = [
  // identity and access
  'users', 'roles', 'user_roles', 'organizations', 'client_profiles',
  // talent
  'talent_profiles', 'talents', 'skills', 'talent_skills',
  // vetting
  'assessments', 'assessment_categories', 'assessment_questions',
  'assessment_assignments', 'skill_assessment_results', 'talent_skill_assessments',
  // requests
  'talent_requests', 'service_requests', 'client_requests', 'request_activity_logs',
  // hiring chain
  'matches', 'interviews', 'offers', 'contracts',
  // delivery
  'projects', 'tasks', 'assignments',
  // finance
  'invoices', 'payments', 'talent_payouts',
  // documents, messaging, support, logs
  'documents', 'conversations', 'messages', 'notifications',
  'support_tickets', 'support_messages', 'audit_logs', 'agent_logs',
  'workflow_instances',
  // remotan
  'remotan_workspaces', 'workspace_members', 'workspace_invitations',
  'workspace_messages', 'remotan_projects', 'remotan_tasks', 'time_logs',
  'payroll_entries', 'performance_review_cycles', 'remotan_performance_reviews',
  'calendar_events', 'academy_resources', 'academy_enrollments',
  'compliance_records', 'gdpr_consent_records', 'remotan_agent_logs',
];

const PAGE = 1000;

async function dumpTable(name) {
  const rows = [];
  let from = 0;

  for (;;) {
    const { data, error } = await db.from(name).select('*').range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = path.join('backups', stamp);
  fs.mkdirSync(dir, { recursive: true });

  console.log(`Backing up ${url}`);
  console.log(`  → ${dir}\n`);

  const summary = {};
  const failed = [];

  for (const table of TABLES) {
    try {
      const rows = await dumpTable(table);
      fs.writeFileSync(path.join(dir, `${table}.json`), JSON.stringify(rows, null, 2));
      summary[table] = rows.length;
      if (rows.length) console.log(`  ${table.padEnd(32)} ${rows.length}`);
    } catch (err) {
      failed.push({ table, error: err.message });
      console.warn(`  ${table.padEnd(32)} FAILED: ${err.message}`);
    }
  }

  const total = Object.values(summary).reduce((a, b) => a + b, 0);

  fs.writeFileSync(
    path.join(dir, '_manifest.json'),
    JSON.stringify(
      {
        takenAt: new Date().toISOString(),
        project: url,
        tableOrder: TABLES,
        rowCounts: summary,
        totalRows: total,
        failed,
        note:
          'Data only. Schema is in packages/database/supabase_migration.sql, ' +
          'policies in packages/database/migrations/. Auth users are NOT included, ' +
          'so restored people cannot sign in until their auth accounts are recreated.',
      },
      null,
      2
    )
  );

  console.log(`\n${total} rows across ${Object.keys(summary).length} tables.`);
  if (failed.length) {
    console.log(`${failed.length} table(s) failed, listed in _manifest.json.`);
  }
  console.log('Restore order is tableOrder in _manifest.json. Parents before children.');
}

main().catch((err) => {
  console.error('\nBackup failed:', err.message);
  process.exit(1);
});
