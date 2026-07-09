const { createClient } = require('./apps/kongila-web/node_modules/@supabase/supabase-js');
const fs = require('fs');

async function main() {
  const envFile = fs.readFileSync('apps/admin-panel/.env.local', 'utf8');
  const supabaseUrl = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
  const supabaseKey = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const email = 'admin@kongila.co';
  const password = 'Renewal12345$';
  
  console.log(`Signing up ${email}...`);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: 'Super Admin'
      }
    }
  });
  
  if (error) {
    console.error('Error signing up:', error.message);
    process.exit(1);
  }
  
  console.log('User created successfully!', data.user.id);
  console.log('Now, please run the SQL update command in your Supabase dashboard to elevate this user to admin role:');
  console.log(`UPDATE public.users SET role = 'admin' WHERE email = '${email}';`);
}

main();
