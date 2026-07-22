import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: interviews, error: ivError } = await supabase.from('interviews').select('*');
  console.log("INTERVIEWS count:", interviews?.length);
  console.log("INTERVIEWS DATA:", JSON.stringify(interviews, null, 2));
  
  const { data: talents, error: tError } = await supabase.from('talent_profiles').select('*');
  const benita = talents.find(t => t.email === 'benita@getchows.com');
  console.log("Benita Pipeline Stage 2:", JSON.stringify(benita?.vetting_pipeline?.[2], null, 2));
}
check();
