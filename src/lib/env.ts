/**
 * Configuração de ambiente.
 * As duas chaves ficam no .env (copie de .env.example). A chave anônima do
 * Supabase pode ir para o navegador — quem protege os dados é a RLS, não o
 * sigilo dessa chave. A service_role NUNCA entra neste aplicativo.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const SUPABASE_URL = (url ?? '').trim()
export const SUPABASE_ANON_KEY = (anonKey ?? '').trim()

export const configurado = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

export const BUCKET_LOGO = 'igreja'
