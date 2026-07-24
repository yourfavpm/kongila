const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bsmwuofugczuhdbintgs.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbXd1b2Z1Z2N6dWhkYmludGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMDAzMTQsImV4cCI6MjA5NDY3NjMxNH0.yhVLhHb0BRfZZjGagF_PwQbYzKVhIOFgAhzoTURvpJc');

async function check() {
  const { data, error } = await supabase.from('organizations').select('*').limit(1);
  console.log('Organizations schema:', data ? Object.keys(data[0] || {}) : error);
  
  const { data: reqs, error: reqErr } = await supabase.from('talent_requests').select('*').limit(1);
  console.log('Talent requests:', reqs, reqErr);
}
check();
