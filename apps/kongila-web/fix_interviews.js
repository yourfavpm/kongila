import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
  const { data: talents, error: tError } = await supabase.from('talent_profiles').select('*');
  if (tError) {
      console.error(tError);
      return;
  }
  
  const { data: interviews, error: ivError } = await supabase.from('interviews').select('*');
  
  let inserted = 0;
  for (const t of talents) {
      if (t.vetting_pipeline && t.vetting_pipeline[2] && t.vetting_pipeline[2].interviewDate) {
          const stage2 = t.vetting_pipeline[2];
          // Check if an interview already exists for this talent and this date
          const exists = interviews.find(i => i.talent_id === t.id && i.date === stage2.interviewDate);
          if (!exists) {
              console.log(`Missing interview for ${t.name}. Creating...`);
              const iv = {
                  id: stage2.interviewId || `int_${Date.now()}_${t.id}`,
                  talent_id: t.id,
                  talent_name: t.name,
                  talent_avatar: t.avatar_url,
                  client_name: 'Kongila Vetting Panel',
                  title: `Behavioural Interview: ${t.name}`,
                  date: stage2.interviewDate,
                  time: stage2.interviewTime,
                  status: stage2.rescheduleRequested ? 'Reschedule Requested' : 'Scheduled',
                  meeting_link: stage2.meetingLink,
                  reschedule_requested: stage2.rescheduleRequested || false,
                  reschedule_reason: stage2.rescheduleReason || null,
                  proposed_new_date: null,
                  proposed_new_time: null,
                  created_at: new Date().toISOString()
              };
              const { error } = await supabase.from('interviews').insert(iv);
              if (error) {
                  console.error("Failed to insert:", error);
              } else {
                  console.log("Inserted!");
                  inserted++;
              }
          }
      }
  }
  console.log("Fixed missing interviews:", inserted);
}
fix();
