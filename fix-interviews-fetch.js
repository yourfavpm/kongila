const fs = require('fs');

const supabaseUrl = 'https://bsmwuofugczuhdbintgs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbXd1b2Z1Z2N6dWhkYmludGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMDAzMTQsImV4cCI6MjA5NDY3NjMxNH0.yhVLhHb0BRfZZjGagF_PwQbYzKVhIOFgAhzoTURvpJc';

async function fetchSupabase(table, query = '') {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  return res.json();
}

async function updateSupabase(table, id, data) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
     const t = await res.text();
     console.error("Update error for id", id, t);
  }
}

async function run() {
  const talents = await fetchSupabase('talent_profiles', 'select=id,bio,full_name');
  const interviews = await fetchSupabase('interviews', 'status=eq.scheduled&select=*');

  let updatedCount = 0;

  for (const iv of interviews) {
    const talent = talents.find(t => t.id === iv.talent_id);
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
      const stage = vettingPipeline.find((s) => s.interviewId === iv.id || (s.stageName === 'Behavioural Interview' && iv.title.includes('Behavioural')));
      if (stage && stage.status === 'passed') {
        await updateSupabase('interviews', iv.id, { status: 'Completed', outcome: 'Proceed' });
        console.log("Updated IV", iv.id, "for talent", talent.full_name);
        updatedCount++;
      } else {
        const passedCount = vettingPipeline.filter((s) => s.status === 'passed').length;
        if (passedCount >= 5 && iv.title.includes('Interview')) {
           await updateSupabase('interviews', iv.id, { status: 'Completed', outcome: 'Proceed' });
           console.log("Updated IV", iv.id, "for fully vetted talent", talent.full_name);
           updatedCount++;
        }
      }
    }
  }

  console.log(`Updated ${updatedCount} interviews.`);
}

run().catch(console.error);
