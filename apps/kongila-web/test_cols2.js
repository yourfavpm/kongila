import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCols() {
  const cols = ['interview_date', 'interview_time', 'scheduled_at', 'start_time', 'end_time', 'match_id', 'date', 'time', 'talent_name', 'client_name'];
  
  const validCols = [];
  for (const col of cols) {
      const { error } = await supabase.from('interviews').select(col).limit(1);
      if (!error) {
          validCols.push(col);
      }
  }
  console.log("Valid columns:", validCols);
}
testCols();
