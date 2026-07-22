import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: talents } = await supabase.from('talent_profiles').select('id, name, email, vetting_pipeline');
  for (const t of talents) {
      if (t.vetting_pipeline && t.vetting_pipeline.length > 2) {
          const stage2 = t.vetting_pipeline[2];
          if (stage2.interviewDate) {
              console.log("Talent with interview:", t.name, t.email);
              console.log("Stage 2:", JSON.stringify(stage2, null, 2));
              
              const iv = {
                  id: stage2.interviewId || `int_${Date.now()}_${t.id}`,
                  talent_id: t.id,
                  talent_name: t.name,
                  talent_avatar: t.avatar_url || null,
                  client_name: 'Kongila Vetting Panel',
                  title: `Behavioural Interview: ${t.name}`,
                  date: stage2.interviewDate,
                  time: stage2.interviewTime,
                  status: stage2.rescheduleRequested ? 'Reschedule Requested' : 'Scheduled',
                  meeting_link: stage2.meetingLink || null,
                  reschedule_requested: stage2.rescheduleRequested || false,
                  reschedule_reason: stage2.rescheduleReason || null,
                  proposed_new_date: null,
                  proposed_new_time: null,
                  created_at: new Date().toISOString()
              };
              const { error } = await supabase.from('interviews').insert(iv);
              if (error) {
                  console.error("Failed to insert:", error.message);
              } else {
                  console.log("Inserted missing interview for", t.name);
              }
          }
      }
  }
}
check();
