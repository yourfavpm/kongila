import { readDbAsync, writeDbAsync } from './index.js';

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
                  db.interviews.push(iv);
                  console.log("Adding missing interview for", t.name);
                  inserted++;
              }
          }
      }
  }
  
  if (inserted > 0) {
      await writeDbAsync(db);
      console.log(`Saved ${inserted} missing interviews to DB!`);
  } else {
      console.log("No missing interviews found.");
  }
}
fix();
