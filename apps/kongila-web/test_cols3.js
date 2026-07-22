import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCols() {
  const cols = ['scheduled_time', 'duration_minutes', 'admin_outcome', 'client_notes', 'client_id'];
  
  const validCols = [];
  for (const col of cols) {
      const { error } = await supabase.from('interviews').select(col).limit(1);
      if (!error) {
          validCols.push(col);
      } else {
          console.error("Error for", col, error.message);
      }
  }
  console.log("Valid columns:", validCols);
}
testCols();
