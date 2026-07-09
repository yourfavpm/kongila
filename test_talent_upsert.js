const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './apps/kongila-web/.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
async function test() {
  const { data, error } = await supabase.from('talent_profiles').upsert([{ id: 'test_upsert_123', user_id: 'test_upsert_123' }]);
  console.log("Upsert Error:", error);
}
test();
