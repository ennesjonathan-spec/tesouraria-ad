/** Traduz erros do Postgres/Supabase para algo que o tesoureiro entenda. */
export function mensagemErro(erro: unknown): string {
  if (!erro) return 'Ocorreu um erro inesperado.'
  if (typeof erro === 'string') return erro

  const e = erro as { message?: string; code?: string; details?: string; status?: number }
  const bruto = e.message ?? ''

  // Mensagens que as nossas funções do banco já escrevem em português.
  if (/^[A-ZÀ-Ú]/.test(bruto) && /[.!?]$/.test(bruto.trim())) return bruto

  if (e.code === 'PGRST301' || e.status === 401) {
    return 'Sua sessão expirou. Entre novamente.'
  }
  if (e.code === '23505') {
    if (bruto.includes('numero_comprovante')) {
      return 'Este número de comprovante já existe. Tente emitir novamente.'
    }
    if (bruto.includes('client_uuid')) {
      return 'Este lançamento já foi enviado.'
    }
    return 'Já existe um registro com esses dados.'
  }
  if (e.code === '23503') return 'Registro relacionado não encontrado.'
  if (e.code === '23514') return 'Algum valor informado não é aceito pelo sistema.'
  if (e.code === '42501' || /row-level security/i.test(bruto)) {
    return 'Seu perfil de acesso não permite esta ação.'
  }
  if (/Invalid login credentials/i.test(bruto)) return 'E-mail ou senha incorretos.'
  if (/Email not confirmed/i.test(bruto)) {
    return 'Este e-mail ainda não foi confirmado. Verifique sua caixa de entrada.'
  }
  if (/User already registered/i.test(bruto)) return 'Já existe um usuário com este e-mail.'
  if (/Password should be at least/i.test(bruto)) {
    return 'A senha precisa ter pelo menos 6 caracteres.'
  }
  if (/Failed to fetch|NetworkError|network/i.test(bruto)) {
    return 'Sem conexão com a internet no momento.'
  }
  if (/JWT expired/i.test(bruto)) return 'Sua sessão expirou. Entre novamente.'

  return bruto || 'Ocorreu um erro inesperado.'
}

export function estaOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}
