const supabaseUrl = 'https://bsmwuofugczuhdbintgs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbXd1b2Z1Z2N6dWhkYmludGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMDAzMTQsImV4cCI6MjA5NDY3NjMxNH0.yhVLhHb0BRfZZjGagF_PwQbYzKVhIOFgAhzoTURvpJc';

async function fetchSupabase(table, query = '') {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
  });
  return { table, ok: res.ok, status: res.status };
}

async function run() {
  const tr = await fetchSupabase('talent_requests', 'limit=1');
  const sr = await fetchSupabase('service_requests', 'limit=1');
  console.log("talent_requests:", tr);
  console.log("service_requests:", sr);
}

run().catch(console.error);
