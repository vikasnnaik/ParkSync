import { createClient } from '@supabase/supabase-js';

const getEnvVar = (key) => {
  if (typeof process !== 'undefined' && process.env) {
    if (process.env[`NEXT_PUBLIC_${key}`]) return process.env[`NEXT_PUBLIC_${key}`];
    if (process.env[`VITE_${key}`]) return process.env[`VITE_${key}`];
  }
  return '';
};

const supabaseUrl =
  getEnvVar('SUPABASE_URL') ||
  'https://mzxzhqichpyrknhvobcd.supabase.co';

const supabasePublishableKey =
  getEnvVar('SUPABASE_PUBLISHABLE_KEY') ||
  getEnvVar('SUPABASE_ANON_KEY') ||
  'sb_publishable_Amde4sXXAkfxuLTTrTfxLw_ix2pGQy1';

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
