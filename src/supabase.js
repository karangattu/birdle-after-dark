import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ovwktjjeoowlktdfbuuu.supabase.co';
const supabasePublishableKey = 'sb_publishable_B2pz5WTA3UEVUeKACIgmBw_8_r0S3kU';

export function getSupabaseClient() {
  try {
    return createClient(supabaseUrl, supabasePublishableKey);
  } catch {
    return null;
  }
}
