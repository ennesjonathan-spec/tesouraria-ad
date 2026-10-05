import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { limparTudo } from '@/lib/idb'
import { lerMeuPerfil } from '@/data/repo'
import type { PerfilAcesso, Profile } from '@/domain/types'

interface AuthCtx {
  sessao: Session | null
  perfil: Profile | null
  carregando: boolean
  erroPerfil: string | null
  entrar: (email: string, senha: string) => Promise<void>
  sair: () => Promise<void>
  recarregarPerfil: () => Promise<void>
  podeLancar: boolean
  ehAdmin: boolean
  nivel: PerfilAcesso | null
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Profile | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erroPerfil, setErroPerfil] = useState<string | null>(null)

  const buscarPerfil = useCallback(async (userId: string) => {
    try {
      const p = await lerMeuPerfil(userId)
      setPerfil(p)
      setErroPerfil(
        p
          ? p.ativo
            ? null
            : 'Seu acesso foi desativado. Procure o tesoureiro responsável.'
          : 'Seu usuário ainda não tem perfil liberado. Peça ao tesoureiro para liberar seu acesso.',
      )
    } catch {
      // Sem internet: mantém a sessão e deixa o app em modo leitura do cache.
      setErroPerfil(null)
    }
  }, [])

  useEffect(() => {
    let vivo = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!vivo) return
      setSessao(data.session)
      if (data.session?.user) await buscarPerfil(data.session.user.id)
      setCarregando(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, nova) => {
      setSessao(nova)
      if (nova?.user) void buscarPerfil(nova.user.id)
      else setPerfil(null)
    })
    return () => {
      vivo = false
      sub.subscription.unsubscribe()
    }
  }, [buscarPerfil])

  const entrar = useCallback(async (email: string, senha: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: senha,
    })
    if (error) throw error
  }, [])

  const sair = useCallback(async () => {
    await supabase.auth.signOut()
    // Dados de membros e rascunhos não ficam no aparelho depois da saída.
    await limparTudo()
    setPerfil(null)
  }, [])

  const recarregarPerfil = useCallback(async () => {
    if (sessao?.user) await buscarPerfil(sessao.user.id)
  }, [sessao, buscarPerfil])

  const valor = useMemo<AuthCtx>(() => {
    const nivel = perfil?.ativo ? perfil.perfil : null
    return {
      sessao,
      perfil,
      carregando,
      erroPerfil,
      entrar,
      sair,
      recarregarPerfil,
      nivel,
      podeLancar: nivel === 'admin' || nivel === 'operador',
      ehAdmin: nivel === 'admin',
    }
  }, [sessao, perfil, carregando, erroPerfil, entrar, sair, recarregarPerfil])

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth precisa estar dentro de AuthProvider.')
  return c
}
