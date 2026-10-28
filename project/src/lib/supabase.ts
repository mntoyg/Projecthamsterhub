import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// LOCAL MODE (default): everything runs in the browser, no backend needed.
// To use Supabase again, set VITE_LOCAL_MODE=false in .env
export const LOCAL_MODE = import.meta.env.VITE_LOCAL_MODE !== 'false';

export const supabase = createClient(
  supabaseUrl ?? 'http://localhost:54321',
  supabaseAnonKey ?? 'public-anon-key',
  {
    auth: { persistSession: false },
  },
);

export const isSupabaseConfigured = !LOCAL_MODE && Boolean(supabaseUrl && supabaseAnonKey);
