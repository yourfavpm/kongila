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

async function run() {
  const orgs = await fetchSupabase('organizations', 'select=*');
  const clients = await fetchSupabase('client_profiles', 'select=*');
  const users = await fetchSupabase('users', 'select=*');

  console.log("Orgs Count:", orgs.length);
  console.log("Clients Count:", clients.length);
  console.log("Users Count:", users.length);
  
  if (clients.length > 0) {
     console.log("Latest Client:", clients[clients.length - 1]);
  }
}

run().catch(console.error);
