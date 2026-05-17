import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ovwktjjeoowlktdfbuuu.supabase.co';
const supabasePublishableKey = 'sb_publishable_B2pz5WTA3UEVUeKACIgmBw_8_r0S3kU';

let client = null;

export function getSupabaseClient() {
  if (client) return client;
  try {
    client = createClient(supabaseUrl, supabasePublishableKey);
    return client;
  } catch {
    return null;
  }
}