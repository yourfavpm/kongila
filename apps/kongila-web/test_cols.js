import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCols() {
  const cols = ['id', 'request_id', 'match_id', 'talent_id', 'talent_name', 'talent_avatar', 'client_name', 'title', 'date', 'time', 'status', 'meeting_link', 'notes', 'talent_notes', 'client_rating', 'client_feedback', 'outcome', 'google_calendar_event_id', 'google_calendar_link', 'reschedule_requested', 'reschedule_reason', 'proposed_new_date', 'proposed_new_time', 'created_at'];
  
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
