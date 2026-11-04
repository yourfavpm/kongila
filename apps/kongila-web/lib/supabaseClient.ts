import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// No fallback on purpose. These used to default to the staging project, so a
// deploy with missing variables connected to staging and looked like it worked.
// A build without them should fail here, loudly, not point at the wrong database.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase is not configured: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must both be set at build time.'
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      // Avoid auth lock timeouts when session restore overlaps with sign-in.
      lockAcquireTimeout: 10000,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
