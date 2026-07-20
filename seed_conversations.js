const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://bsmwuofugczuhdbintgs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbXd1b2Z1Z2N6dWhkYmludGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMDAzMTQsImV4cCI6MjA5NDY3NjMxNH0.yhVLhHb0BRfZZjGagF_PwQbYzKVhIOFgAhzoTURvpJc'
);

async function seed() {
  console.log('Seeding talent conversation...');
  
  // Get first talent
  const { data: users, error: err1 } = await supabase.from('users').select('*').eq('role', 'talent').limit(1);
  if (err1 || !users || users.length === 0) {
    console.error('No talent found', err1);
    return;
  }
  
  const talent = users[0];
  console.log(`Found talent: ${talent.id}`);

  // Create conversation
  const convId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
  const { error: err2 } = await supabase.from('conversations').upsert([{
    id: convId,
    type: 'talent_admin',
    participant_ids: [talent.id, 'admin-uuid-001'],
    context_type: 'vetting',
    context_id: talent.id,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString()
  }]);

  if (err2) {
    console.error('Failed to create conv', err2);
    return;
  }

  // Create message
  const { error: err3 } = await supabase.from('messages').upsert([{
    id: '123e4567-e89b-12d3-a456-426614174000',
    conversation_id: convId,
    sender_id: 'admin-uuid-001',
    content: "Hi there! I'm currently reviewing your stage 1 application. Could you please clarify the gap in your employment history between 2023 and 2024? An updated CV or a short explanation here would be great.",
    is_read: false,
    timestamp: new Date(Date.now() - 3600000).toISOString()
  }]);

  if (err3) {
    console.error('Failed to create msg', err3);
    return;
  }

  // Also create a storage bucket if it doesn't exist just in case
  await supabase.storage.createBucket('message-attachments', { public: true });

  console.log('Seed complete!');
}

seed();
