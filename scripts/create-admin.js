#!/usr/bin/env node
/**
 * Kongila — create or repair an administrator account.
 *
 * Administrators are created deliberately, by a person, with this. There is
 * no self-service route and there must not be: `/api/account/provision`
 * accepts the roles client and talent only, and the admin login's old
 * auto-provisioning, which handed admin to any @kongila.co signup and
 * super_admin to admin@kongila.co, was removed on purpose. Anyone who could
 * register an address on that domain became an administrator.
 *
 * What it does, in order:
 *
 *   1. Creates the Supabase Auth user, with the email already confirmed so
 *      there is no verification step to clear before signing in.
 *   2. Writes the matching `public.users` row with the role, which is what
 *      every API route reads through getRequestUser. Without this row the
 *      account authenticates and then every route answers 401, because a
 *      user with no row has no role.
 *   3. Links a `user_roles` row when a matching `roles` row already exists,
 *      so the account also appears in the admin portal's role listings. It
 *      does not invent role taxonomy.
 *
 * Idempotent. Run it again for an account that already exists and it resets
 * the password and repairs the role rather than failing.
 *
 * Usage:
 *   node scripts/create-admin.js <email> <password> [role]
 *
 *   node scripts/create-admin.js admin@kongila.io 'S0me-Long-Passphrase'
 *   node scripts/create-admin.js ops@kongila.io 'another one' ops_manager
 *
 * Role defaults to super_admin. The password is an argument rather than
 * something written into this file, so a real credential never ends up in
 * git. Quote it: shells eat $ and !.
 *
 * Needs SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and
 * SUPABASE_SERVICE_ROLE_KEY in the environment or in .env at the repo root.
 * The service role key bypasses RLS, which is why this is a script somebody
 * runs and not an endpoint.
 */

const path = require('path');

try {
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
  require('dotenv').config({ path: path.resolve(__dirname, '..', 'apps', 'admin-panel', '.env.local') });
} catch (e) {
  // dotenv is a root dependency; if it is missing the environment may still
  // carry the variables, so this is not fatal.
}

// Matches ADMIN_PORTAL_ROLES in packages/database/index.ts, which is what
// decides whether a session counts as an administrator. A role outside this
// set authenticates and is then refused by every admin route, which is a
// confusing way to find out you made a typo.
const ADMIN_ROLES = [
  'super_admin',
  'superadmin',
  'admin',
  'account_manager',
  'operations_manager',
  'ops_manager',
  'talent_manager',
  'finance'
];

function die(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

const [, , emailArg, passwordArg, roleArg] = process.argv;

if (!emailArg || !passwordArg) {
  die(
    'Usage: node scripts/create-admin.js <email> <password> [role]\n' +
    `  Roles: ${ADMIN_ROLES.join(', ')}`
  );
}

const email = String(emailArg).trim().toLowerCase();
const password = String(passwordArg);
// normalizeRoleValue in packages/database/index.ts lowercases and turns
// spaces and hyphens into underscores. Do the same here so the row matches
// what the server will look for.
const role = String(roleArg || 'super_admin').trim().toLowerCase().replace(/[\s-]+/g, '_');

if (!ADMIN_ROLES.includes(role)) {
  die(`"${role}" is not an admin role. One of: ${ADMIN_ROLES.join(', ')}`);
}
if (password.length < 8) {
  die('That password is shorter than Supabase Auth will accept.');
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) die('No SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL found in the environment or .env.');
if (!serviceKey) {
  die(
    'No SUPABASE_SERVICE_ROLE_KEY found. This script needs it: creating an auth\n' +
    '  user and writing public.users both require bypassing RLS. Find it under\n' +
    '  Project Settings, API, service_role in the Supabase dashboard.'
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

/** Walks the Auth user list to find an existing account by email. */
async function findAuthUser(targetEmail) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Could not list auth users: ${error.message}`);
    const found = (data?.users || []).find(
      u => String(u.email || '').toLowerCase() === targetEmail
    );
    if (found) return found;
    if (!data?.users || data.users.length < 200) return null;
  }
  return null;
}

async function main() {
  console.log(`\n  Kongila admin provisioning`);
  console.log(`  project : ${url}`);
  console.log(`  account : ${email}`);
  console.log(`  role    : ${role}\n`);

  // ── 1. The auth user ──────────────────────────────────────────────────────
  let authUser = null;
  let created = false;

  const { data: createData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    // No confirmation email to chase. An unconfirmed address can sign in on
    // some project settings and not others, and "it says invalid login" is a
    // miserable way to spend an afternoon.
    email_confirm: true,
    user_metadata: { name: 'Kongila Administrator', role }
  });

  if (createError) {
    const alreadyExists = /already.*registered|already.*exists|email.*taken/i.test(createError.message);
    if (!alreadyExists) throw new Error(`Could not create the auth user: ${createError.message}`);

    console.log('  • auth user already exists, resetting its password');
    authUser = await findAuthUser(email);
    if (!authUser) {
      throw new Error(
        'Supabase says that email is taken but it is not in the user list. ' +
        'Check whether it was deleted recently, or look for it in the dashboard.'
      );
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(authUser.id, {
      password,
      email_confirm: true,
      user_metadata: { ...(authUser.user_metadata || {}), role }
    });
    if (updateError) throw new Error(`Could not reset the password: ${updateError.message}`);
  } else {
    authUser = createData.user;
    created = true;
    console.log('  • auth user created');
  }

  if (!authUser?.id) throw new Error('No auth user id came back. Nothing further was written.');

  // ── 2. The public.users row ───────────────────────────────────────────────
  //
  // This is the row that matters. getRequestUser verifies the token, reads
  // this row for the role, and returns null when there is no role, which
  // every route turns into a 401. An auth user with no row here can sign in
  // and do nothing.
  //
  // password_hash is NOT NULL and Supabase Auth holds the real credential, so
  // it carries the same marker provisioning uses for every other account.
  const { data: existingRow } = await supabase
    .from('users').select('id, role, status').eq('id', authUser.id).maybeSingle();

  const { error: rowError } = await supabase.from('users').upsert(
    {
      id: authUser.id,
      email,
      name: 'Kongila Administrator',
      password_hash: 'auth_managed',
      role,
      status: 'active',
      email_verified: true
    },
    { onConflict: 'id' }
  );
  if (rowError) throw new Error(`Could not write public.users: ${rowError.message}`);

  if (existingRow) {
    console.log(`  • public.users updated (was role "${existingRow.role}", status "${existingRow.status}")`);
  } else {
    console.log('  • public.users row created');
  }

  // ── 3. The role link, only if the taxonomy already has it ─────────────────
  const { data: roleRow } = await supabase
    .from('roles').select('id, name').ilike('name', role).maybeSingle();

  if (!roleRow) {
    console.log(`  • no "${role}" row in the roles table, so no user_roles link (not needed to sign in)`);
  } else {
    const { data: link } = await supabase
      .from('user_roles').select('id').eq('user_id', authUser.id).eq('role_id', roleRow.id).maybeSingle();

    if (link) {
      console.log('  • user_roles link already present');
    } else {
      const { error: linkError } = await supabase
        .from('user_roles').insert({ user_id: authUser.id, role_id: roleRow.id });
      if (linkError) console.log(`  • user_roles link not written: ${linkError.message}`);
      else console.log('  • user_roles link created');
    }
  }

  // ── Verify, rather than assume ────────────────────────────────────────────
  const { data: check } = await supabase
    .from('users').select('id, email, role, status, email_verified').eq('id', authUser.id).maybeSingle();

  console.log('\n  Result');
  console.log(`    auth id        ${authUser.id}`);
  console.log(`    email          ${check?.email}`);
  console.log(`    role           ${check?.role}`);
  console.log(`    status         ${check?.status}`);
  console.log(`    email verified ${check?.email_verified}`);

  const ok = check && check.role === role && String(check.status).toLowerCase() === 'active';
  if (!ok) {
    die('The row does not read back as expected. Check it in the dashboard before signing in.');
  }

  console.log(
    `\n  ${created ? 'Created' : 'Repaired'}. Sign in at the admin portal (port 3002).` +
    '\n  Every call it makes carries this account\'s token and is checked server side.\n'
  );
}

main().catch(err => die(err.message));
