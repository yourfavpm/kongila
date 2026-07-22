import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './.env.local' });
dotenv.config({ path: './apps/kongila-web/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: interviews, error: ivError } = await supabase.from('interviews').select('*');
  console.log("INTERVIEWS:", interviews?.length);
  if (ivError) console.error(ivError);
  
  const { data: talents, error: tError } = await supabase.from('talent_profiles').select('id, name, email, vetting_pipeline');
  const talent = talents.find(t => t.email === 'benita@getchows.com' || t.name === 'Benita Eze');
  console.log("TALENT:", talent?.name, talent?.email);
  if (talent && talent.vetting_pipeline) {
      console.log("PIPELINE:", JSON.stringify(talent.vetting_pipeline[2], null, 2));
  }
}
check();
