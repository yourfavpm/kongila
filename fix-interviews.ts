import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: './.env.local' });

const defaultSupabaseUrl = 'https://bsmwuofugczuhdbintgs.supabase.co';
const defaultSupabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbXd1b2Z1Z2N6dWhkYmludGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMDAzMTQsImV4cCI6MjA5NDY3NjMxNH0.yhVLhHb0BRfZZjGagF_PwQbYzKVhIOFgAhzoTURvpJc';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || defaultSupabaseUrl,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || defaultSupabaseAnonKey
);

async function fix() {
  const { data: talents, error: tErr } = await supabase.from('talent_profiles').select('id, bio, full_name');
  if (tErr) throw tErr;

  const { data: interviews, error: iErr } = await supabase.from('interviews').select('*').eq('status', 'scheduled');
  if (iErr) throw iErr;

  let updatedCount = 0;

  for (const iv of interviews) {
    const talent = talents.find((t: any) => t.id === iv.talent_id);
    if (!talent || !talent.bio) continue;

    let telemetry = null;
    let vettingPipeline = null;
    try {
      const parsed = JSON.parse(talent.bio);
      telemetry = parsed.telemetry;
      if (telemetry && telemetry.vettingPipeline) {
        vettingPipeline = telemetry.vettingPipeline;
      } else {
         const parts = talent.bio.split('\n\nBio:');
         if (parts[0]) telemetry = JSON.parse(parts[0].replace('Telemetry:', '').trim());
         vettingPipeline = telemetry?.vettingPipeline;
      }
    } catch (e) {}

    if (vettingPipeline) {
      // Check if this interview's stage is passed
      const stage = vettingPipeline.find((s: any) => s.interviewId === iv.id || (s.stageName === 'Behavioural Interview' && iv.title.includes('Behavioural')));
      if (stage && stage.status === 'passed') {
        const { error: upErr } = await supabase.from('interviews').update({ status: 'Completed', outcome: 'Proceed' }).eq('id', iv.id);
        if (upErr) console.error("Failed to update IV", iv.id, upErr);
        else {
          console.log("Updated IV", iv.id, "for talent", talent.full_name);
          updatedCount++;
        }
      } else {
        // if fully vetted, update all their vetting interviews to completed
        const passedCount = vettingPipeline.filter((s:any) => s.status === 'passed').length;
        if (passedCount >= 5 && iv.title.includes('Interview')) {
           const { error: upErr } = await supabase.from('interviews').update({ status: 'Completed', outcome: 'Proceed' }).eq('id', iv.id);
           if (!upErr) {
             console.log("Updated IV", iv.id, "for fully vetted talent", talent.full_name);
             updatedCount++;
           }
        }
      }
    }
  }

  console.log(`Updated ${updatedCount} interviews.`);
}

fix().catch(console.error);
