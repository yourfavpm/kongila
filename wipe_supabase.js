const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './apps/admin-panel/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function wipeDummyData() {
  console.log("Wiping dummy talents from Supabase...");
  // Dummy IDs start with 'talent_' or 'usr_' or 'client_' etc.
  const { data: talents } = await supabase.from('talent_profiles').select('id');
  if (talents) {
    for (const t of talents) {
      if (t.id.startsWith('talent_') || t.id.startsWith('linkedin_') || t.id.startsWith('google_')) {
        await supabase.from('talent_profiles').delete().eq('id', t.id);
        console.log('Deleted dummy talent:', t.id);
      }
    }
  }

  console.log("Wiping dummy clients...");
  const { data: clients } = await supabase.from('client_profiles').select('id');
  if (clients) {
    for (const c of clients) {
      if (c.id.startsWith('client_') || c.id.startsWith('clp_')) {
        await supabase.from('client_profiles').delete().eq('id', c.id);
        console.log('Deleted dummy client:', c.id);
      }
    }
  }

  console.log("Wipe completed.");
}

wipeDummyData();
