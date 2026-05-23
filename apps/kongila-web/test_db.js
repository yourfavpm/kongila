const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

if (fs.existsSync('.env.local')) {
  const content = fs.readFileSync('.env.local', 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        process.env[key] = value;
      }
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function probeColumns(table, keys) {
  console.log(`\nProbing columns for "${table}":`);
  const missing = [];
  const existing = [];
  
  for (const key of keys) {
    // Try to insert a dummy object with just this key
    const obj = { id: 'probe_id_9999' };
    obj[key] = (key === 'id') ? 'probe_id_9999' : (key.includes('id') ? 'probe_id_9999' : 'test');
    
    const { error } = await supabase.from(table).insert(obj);
    if (error && error.message.includes(`column '${key}'`) || (error && error.message.includes(`column "${key}"`)) || (error && error.message.includes(`column of '${table}'`))) {
      missing.push(key);
    } else {
      existing.push(key);
    }
  }
  console.log('Existing/Valid:', existing);
  console.log('Missing/Invalid:', missing);
}

async function run() {
  await probeColumns('talent_profiles', [
    'experience_years', 'experienceYears',
    'salary_expectation', 'salaryExpectation',
    'vetting_stage', 'vettingStage',
    'vetting_status', 'vettingStatus',
    'full_name', 'name',
    'avatar_url', 'avatar',
    'government_id_url', 'governmentId',
    'proof_of_address_url', 'proofOfAddress',
    'profile_integrity_progress', 'profileIntegrityProgress',
    'date_joined', 'dateJoined',
    'vetting_scores', 'vettingScores',
    'tags', 'title', 'level'
  ]);
  
  await probeColumns('service_requests', [
    'client_id', 'clientId',
    'client_name', 'clientName',
    'service_type', 'serviceType',
    'description', 'roleDescription',
    'required_skills', 'requiredSkills',
    'duration', 'commitment_level', 'commitmentLevel',
    'num_of_talents', 'numberOfHires',
    'timezone', 'start_date', 'startDate',
    'budget', 'priority', 'status', 'created_at', 'createdAt'
  ]);

  await probeColumns('contracts', [
    'match_id', 'matchId',
    'client_id', 'clientId',
    'client_name', 'clientName',
    'talent_id', 'talentId',
    'talent_name', 'talentName',
    'role', 'salary', 'start_date', 'startDate',
    'status', 'signed_at', 'signedAt',
    'rate_type', 'rateType',
    'rate_amount', 'rateAmount',
    'total_earned', 'totalEarned',
    'invoiced_balance', 'invoicedBalance',
    'next_payout', 'nextPayout',
    'next_payout_date', 'nextPayoutDate',
    'end_date', 'endDate',
    'engagement_model', 'engagementModel',
    'rating', 'quality_of_work', 'qualityOfWork',
    'communication', 'timeliness', 'performance_score', 'performanceScore'
  ]);
  
  process.exit(0);
}

run();
