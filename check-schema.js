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
  if (!res.ok) {
     return res.text();
  }
  return res.json();
}

async function run() {
  const orgs = await fetchSupabase('organizations', 'select=*&limit=1');
  console.log("Orgs structure:");
  console.log(orgs);
}

run().catch(console.error);
