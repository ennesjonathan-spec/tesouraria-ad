import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL, configurado } from './env'

/**
 * Cliente único. Sessão persistida no localStorage e renovada sozinha, para o
 * tesoureiro não precisar entrar de novo a cada culto.
 */
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL || 'https://exemplo.supabase.co',
  SUPABASE_ANON_KEY || 'chave-nao-configurada',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'tesouraria-ad-124',
    },
    global: {
      headers: { 'x-application-name': 'tesouraria-ad-balneario-central' },
    },
  },
)

export { configurado }
