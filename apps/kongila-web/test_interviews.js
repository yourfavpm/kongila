import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../../apps/kongila-web/.env.local' });
dotenv.config({ path: '../../apps/admin-panel/.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bsmwuofugczuhdbintgs.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbXd1b2Z1Z2N6dWhkYmludGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMDAzMTQsImV4cCI6MjA5NDY3NjMxNH0.yhVLhHb0BRfZZjGagF_PwQbYzKVhIOFgAhzoTURvpJc';
const supabase = createClient(supabaseUrl, supabaseKey);
async function test() {
    const { data, error } = await supabase.from('interviews').select('*');
    console.log("interviews count:", data?.length, "error:", error);
    if (data && data.length > 0) {
        console.log("first interview:", JSON.stringify(data[0], null, 2));
    }
}
test();
