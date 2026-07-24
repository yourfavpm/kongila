const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

if (fs.existsSync('.env.local')) {
  const content = fs.readFileSync('.env.local', 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        process.env[key] = value;
      }
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Seeding roles...");
  const roles = [
    { id: 'super_admin', name: 'super_admin' },
    { id: 'admin', name: 'admin' },
    { id: 'account_manager', name: 'account_manager' },
    { id: 'operations_manager', name: 'operations_manager' },
    { id: 'ops_manager', name: 'ops_manager' },
    { id: 'talent_manager', name: 'talent_manager' },
    { id: 'client', name: 'client' },
    { id: 'talent', name: 'talent' }
  ];

  for (const role of roles) {
    const { data, error } = await supabase.from('roles').upsert(role, { onConflict: 'id' });
    if (error) {
      console.error(`Failed to seed role ${role.id}:`, error.message);
    } else {
      console.log(`Successfully seeded/verified role ${role.id}`);
    }
  }

  // Also seed user_roles for any existing users in the public.users table!
  const { data: users } = await supabase.from('users').select('*');
  if (users) {
    for (const u of users) {
      if (u.role) {
        const { error: urErr } = await supabase.from('user_roles').upsert({
          id: `ur_${u.id}`,
          user_id: u.id,
          role_id: u.role
        }, { onConflict: 'id' });
        if (urErr) {
          console.error(`Failed to seed user_role for user ${u.id}:`, urErr.message);
        } else {
          console.log(`Successfully seeded user_role for user ${u.id} as ${u.role}`);
        }
      }
    }
  }

  process.exit(0);
}

run();
