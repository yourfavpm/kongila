const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://bsmwuofugczuhdbintgs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbXd1b2Z1Z2N6dWhkYmludGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMDAzMTQsImV4cCI6MjA5NDY3NjMxNH0.yhVLhHb0BRfZZjGagF_PwQbYzKVhIOFgAhzoTURvpJc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.rpc('get_full_db_state');
  if (data && data.organizations) {
    console.log(data.organizations);
  }
}
check();
