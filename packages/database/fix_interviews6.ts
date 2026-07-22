import { readDbAsync, writeDbAsync } from './index.js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../../apps/kongila-web/.env.local' });
import { createClient } from '@supabase/supabase-js';

async function fix() {
  const db = await readDbAsync();
  
  let inserted = 0;
  for (const t of db.talents) {
      if (t.vettingPipeline && t.vettingPipeline.length > 2) {
          const stage2 = t.vettingPipeline[2];
          if (stage2.interviewDate) {
              console.log("Talent with interview:", t.name, t.email);
              
              const exists = db.interviews.find(iv => iv.talentId === t.id && iv.date === stage2.interviewDate);
              
              if (!exists) {
                  const iv = {
                      id: stage2.interviewId || `int_${Date.now()}_${t.id}`,
                      talentId: t.id,
                      talentName: t.name,
                      talentAvatar: t.avatarUrl || null,
                      clientName: 'Kongila Vetting Panel',
                      title: `Behavioural Interview: ${t.name}`,
                      date: stage2.interviewDate,
                      time: stage2.interviewTime,
                      status: stage2.rescheduleRequested ? 'Reschedule Requested' : 'Scheduled',
                      meetingLink: stage2.meetingLink || null,
                      rescheduleRequested: stage2.rescheduleRequested || false,
                      rescheduleReason: stage2.rescheduleReason || null,
                      proposedNewDate: null,
                      proposedNewTime: null,
                      createdAt: new Date().toISOString()
                  };
                  db.interviews.push(iv as any);
                  console.log("Adding missing interview for", t.name);
                  inserted++;
              }
          }
      }
  }
  
  if (inserted > 0) {
      // Let's force upsert directly using Service Role key if we have it, else warn
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const supabase = createClient(supabaseUrl!, supabaseKey!);
      
      const rows = db.interviews.map((iv: any) => ({
        id: iv.id,
        request_id: iv.requestId || null,
        match_id: iv.matchId || null,
        talent_id: iv.talentId,
        talent_name: iv.talentName,
        talent_avatar: iv.talentAvatar || null,
        client_name: iv.clientName,
        title: iv.title,
        date: iv.date,
        time: iv.time,
        status: iv.status,
        meeting_link: iv.meetingLink || null,
        notes: iv.notes || null,
        talent_notes: iv.talentNotes || null,
        client_rating: iv.clientRating || null,
        client_feedback: iv.clientFeedback || null,
        outcome: iv.outcome || null,
        google_calendar_event_id: iv.googleCalendarEventId || null,
        google_calendar_link: iv.googleCalendarLink || null,
        reschedule_requested: iv.rescheduleRequested || false,
        reschedule_reason: iv.rescheduleReason || null,
        proposed_new_date: iv.proposedNewDate || null,
        proposed_new_time: iv.proposedNewTime || null,
        created_at: iv.createdAt || new Date().toISOString()
      }));
      
      const { error } = await supabase.from('interviews').upsert(rows);
      if (error) {
         console.error('[DB] DIRECT SUPABASE UPSERT FAILED:', error.message);
      } else {
         console.log(`Saved ${inserted} missing interviews directly to Supabase DB!`);
      }
  } else {
      console.log("No missing interviews found.");
  }
}
fix();
