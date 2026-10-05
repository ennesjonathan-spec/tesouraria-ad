import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { lerConfiguracoes, salvarConfiguracoes } from '@/data/repo'
import { lerConfigDoCache, salvarConfigEmCache } from '@/lib/idb'
import { FORMAS_PADRAO, SUBCATEGORIAS_PADRAO } from '@/domain/catalog'
import type { ChurchSettings } from '@/domain/types'
import { useAuth } from './AuthContext'

/** Usado só enquanto a configuração real não chega do banco. */
const PROVISORIO: ChurchSettings = {
  id: 1,
  nome_igreja: 'Igreja Evangélica Assembleia de Deus',
  congregacao: 'Congregação Balneário Central',
  codigo: '124',
  endereco: '',
  dirigente: '',
  tesoureiro: '',
  logo_url: null,
  versiculo_rodape: 'Deus ama quem dá com alegria.',
  versiculo_ref: '2 Coríntios 9:7',
  aviso_rodape: 'Comprovante emitido pela tesouraria para registro e confirmação da entrega.',
  prefixo_comprovante: '124',
  cores_do_layout: { primaria: '#0f2a4a', secundaria: '#ffffff', destaque: '#bd9336', texto: '#13202e' },
  subcategorias_oferta: [...SUBCATEGORIAS_PADRAO],
  formas_recebimento: [...FORMAS_PADRAO],
  updated_at: new Date().toISOString(),
}

interface SettingsCtx {
  config: ChurchSettings
  carregando: boolean
  salvar: (mudancas: Partial<ChurchSettings>) => Promise<void>
  recarregar: () => Promise<void>
}

const Ctx = createContext<SettingsCtx | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { sessao } = useAuth()
  const [config, setConfig] = useState<ChurchSettings>(PROVISORIO)
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    // O cache entra primeiro para o comprovante sair certo mesmo sem internet.
    const doCache = await lerConfigDoCache()
    if (doCache) setConfig(doCache)
    try {
      const c = await lerConfiguracoes()
      setConfig(c)
      await salvarConfigEmCache(c)
    } catch {
      // Offline: segue com o cache (ou o provisório, na primeira vez).
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    if (sessao) void carregar()
    else setCarregando(false)
  }, [sessao, carregar])

  const salvar = useCallback(async (mudancas: Partial<ChurchSettings>) => {
    const novo = await salvarConfiguracoes(mudancas)
    setConfig(novo)
    await salvarConfigEmCache(novo)
  }, [])

  const valor = useMemo(() => ({ config, carregando, salvar, recarregar: carregar }), [
    config,
    carregando,
    salvar,
    carregar,
  ])
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useSettings(): SettingsCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useSettings precisa estar dentro de SettingsProvider.')
  return c
}
