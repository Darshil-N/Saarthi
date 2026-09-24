import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

if (!import.meta.env.VITE_SUPABASE_URL) {
  console.warn('⚠️ Missing VITE_SUPABASE_URL environment variable. Using placeholder.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
