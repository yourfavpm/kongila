const { createClient } = require('./apps/kongila-web/node_modules/@supabase/supabase-js');
const fs = require('fs');

// Usage: node seed_admin.js [email] [password] [name]
// Defaults to admin@kongila.co / Renewal12345$ if not provided.

async function main() {
  let supabaseUrl, supabaseKey;

  try {
    const envFile = fs.readFileSync('apps/admin-panel/.env.local', 'utf8');
    supabaseUrl = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
    supabaseKey = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
  } catch {
    // Fall back to hardcoded values if .env.local is absent
    supabaseUrl = 'https://bsmwuofugczuhdbintgs.supabase.co';
    supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbXd1b2Z1Z2N6dWhkYmludGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMDAzMTQsImV4cCI6MjA5NDY3NjMxNH0.yhVLhHb0BRfZZjGagF_PwQbYzKVhIOFgAhzoTURvpJc';
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const email    = process.argv[2] || 'admin@kongila.co';
  const password = process.argv[3] || 'Renewal12345$';
  const name     = process.argv[4] || 'Super Admin';

  console.log(`\nProvisioning admin account for: ${email}`);

  // 1. Sign up (or silently continue if user already exists)
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } }
  });

  let userId;
  if (signUpError) {
    if (signUpError.message.toLowerCase().includes('already registered')) {
      console.log('Auth user already exists — looking up existing id...');
      // Sign in to get the id
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        console.error('Could not sign in to retrieve user id:', signInError.message);
        process.exit(1);
      }
      userId = signInData.user.id;
      await supabase.auth.signOut();
    } else {
      console.error('Sign-up error:', signUpError.message);
      process.exit(1);
    }
  } else {
    userId = signUpData.user.id;
    console.log('Auth user created, id:', userId);
  }

  // 2. Upsert into public.users with role = 'admin'
  const { error: upsertError } = await supabase.from('users').upsert(
    {
      id: userId,
      email,
      password_hash: 'managed_by_supabase_auth',
      role: 'admin',
      status: 'active',
      email_verified: true,
    },
    { onConflict: 'id' }
  );

  if (upsertError) {
    console.error('Failed to upsert into public.users:', upsertError.message);
    console.log('\nRun this SQL manually in your Supabase SQL editor:');
    console.log(`INSERT INTO public.users (id, email, password_hash, role, status, email_verified)`);
    console.log(`VALUES ('${userId}', '${email}', 'managed_by_supabase_auth', 'admin', 'active', true)`);
    console.log(`ON CONFLICT (id) DO UPDATE SET role = 'admin', status = 'active';`);
    process.exit(1);
  }

  console.log(`\n✓ Admin account ready.`);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  Role:     admin`);
  console.log(`\nYou can now sign in to the admin panel.`);
}

main();
