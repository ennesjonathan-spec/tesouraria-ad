import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { apagarRascunho, lerRascunhos, salvarRascunho } from '@/lib/idb'
import { emitirComprovante } from '@/data/repo'
import { mensagemErro } from '@/lib/errors'
import type { NovoComprovante, RascunhoOffline, Receipt } from '@/domain/types'
import { useAuth } from './AuthContext'

interface OfflineCtx {
  online: boolean
  rascunhos: RascunhoOffline[]
  sincronizando: boolean
  guardarRascunho: (entrada: NovoComprovante) => Promise<void>
  sincronizar: () => Promise<{ enviados: number; falharam: number }>
  descartarRascunho: (clientUuid: string) => Promise<void>
  recarregarRascunhos: () => Promise<void>
  ultimoEnviado: Receipt | null
  limparUltimoEnviado: () => void
}

const Ctx = createContext<OfflineCtx | null>(null)

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { podeLancar, sessao } = useAuth()
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [rascunhos, setRascunhos] = useState<RascunhoOffline[]>([])
  const [sincronizando, setSincronizando] = useState(false)
  const [ultimoEnviado, setUltimoEnviado] = useState<Receipt | null>(null)
  const emAndamento = useRef(false)

  const recarregarRascunhos = useCallback(async () => {
    setRascunhos(await lerRascunhos())
  }, [])

  useEffect(() => {
    void recarregarRascunhos()
  }, [recarregarRascunhos, sessao])

  const guardarRascunho = useCallback(
    async (entrada: NovoComprovante) => {
      const r: RascunhoOffline = {
        client_uuid: entrada.client_uuid,
        member_id: entrada.member_id,
        nome_exibido: '',
        data_recebimento: entrada.data_recebimento,
        hora_recebimento: entrada.hora_recebimento,
        competencia: entrada.competencia,
        forma_recebimento: entrada.forma_recebimento,
        observacao: entrada.observacao,
        itens: entrada.itens,
        criado_em: Date.now(),
        tentativas: 0,
        ultimo_erro: null,
      }
      await salvarRascunho(r)
      await recarregarRascunhos()
    },
    [recarregarRascunhos],
  )

  /**
   * Envia a fila. O client_uuid vai junto: se a resposta se perder no caminho
   * e o rascunho for reenviado, o banco devolve o mesmo comprovante em vez de
   * criar um segundo número oficial.
   */
  const sincronizar = useCallback(async () => {
    if (emAndamento.current || !podeLancar) return { enviados: 0, falharam: 0 }
    emAndamento.current = true
    setSincronizando(true)
    let enviados = 0
    let falharam = 0
    try {
      for (const r of await lerRascunhos()) {
        try {
          const comprovante = await emitirComprovante({
            member_id: r.member_id,
            data_recebimento: r.data_recebimento,
            hora_recebimento: r.hora_recebimento,
            competencia: r.competencia,
            forma_recebimento: r.forma_recebimento,
            observacao: r.observacao,
            itens: r.itens,
            client_uuid: r.client_uuid,
          })
          await apagarRascunho(r.client_uuid)
          setUltimoEnviado(comprovante)
          enviados += 1
        } catch (e) {
          falharam += 1
          await salvarRascunho({
            ...r,
            tentativas: r.tentativas + 1,
            ultimo_erro: mensagemErro(e),
          })
        }
      }
    } finally {
      emAndamento.current = false
      setSincronizando(false)
      await recarregarRascunhos()
    }
    return { enviados, falharam }
  }, [podeLancar, recarregarRascunhos])

  const descartarRascunho = useCallback(
    async (clientUuid: string) => {
      await apagarRascunho(clientUuid)
      await recarregarRascunhos()
    },
    [recarregarRascunhos],
  )

  useEffect(() => {
    const subiu = () => {
      setOnline(true)
      void sincronizar()
    }
    const caiu = () => setOnline(false)
    window.addEventListener('online', subiu)
    window.addEventListener('offline', caiu)
    return () => {
      window.removeEventListener('online', subiu)
      window.removeEventListener('offline', caiu)
    }
  }, [sincronizar])

  // Tentativa periódica: a conexão do templo volta sem disparar o evento 'online'.
  useEffect(() => {
    if (!podeLancar) return
    const t = setInterval(() => {
      if (navigator.onLine && rascunhos.length > 0) void sincronizar()
    }, 45_000)
    return () => clearInterval(t)
  }, [podeLancar, rascunhos.length, sincronizar])

  const valor = useMemo<OfflineCtx>(
    () => ({
      online,
      rascunhos,
      sincronizando,
      guardarRascunho,
      sincronizar,
      descartarRascunho,
      recarregarRascunhos,
      ultimoEnviado,
      limparUltimoEnviado: () => setUltimoEnviado(null),
    }),
    [online, rascunhos, sincronizando, guardarRascunho, sincronizar, descartarRascunho, recarregarRascunhos, ultimoEnviado],
  )
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useOffline(): OfflineCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useOffline precisa estar dentro de OfflineProvider.')
  return c
}
