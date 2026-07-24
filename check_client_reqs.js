const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-panel/.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data: orgs } = await supabase.from('organizations').select('*').limit(1);
  if (!orgs || orgs.length === 0) return console.log('No orgs');
  const org = orgs[0];
  console.log('Org:', org.id);
  const { data: profiles, error: pErr } = await supabase.from('client_profiles').select('*').eq('organization_id', org.id);
  console.log('Profiles:', profiles, pErr);
  if (profiles && profiles.length > 0) {
    const orgUserIds = profiles.map(cp => cp.user_id);
    const { data: reqs, error: rErr } = await supabase.from('talent_requests').select('*').in('client_id', orgUserIds);
    console.log('Requests for client:', reqs, rErr);
  }
}
check();
