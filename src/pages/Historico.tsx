import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AcoesComprovante, PreviaComprovante, dadosDoComprovante } from '@/components/Comprovante'
import { AreaTexto, Aviso, Campo, Carregando, Confirmacao, EstadoVazio, Etiqueta, Selecao } from '@/components/ui'
import { cancelarComprovante, lerComprovante, listarComprovantes, type FiltroComprovantes } from '@/data/repo'
import { formatMoney } from '@/lib/money'
import { competenciasDisponiveis, formatarDataISO, formatarHora } from '@/lib/dates'
import { mensagemErro } from '@/lib/errors'
import { useAuth } from '@/state/AuthContext'
import { useSettings } from '@/state/SettingsContext'
import type { Receipt } from '@/domain/types'

export function Historico() {
  const { ehAdmin } = useAuth()
  const { config } = useSettings()
  const navegar = useNavigate()

  const [filtro, setFiltro] = useState<FiltroComprovantes>({})
  const [texto, setTexto] = useState('')
  const [lista, setLista] = useState<Receipt[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [aberto, setAberto] = useState<Receipt | null>(null)
  const [cancelando, setCancelando] = useState<Receipt | null>(null)
  const [motivo, setMotivo] = useState('')
  const [salvandoCancelamento, setSalvandoCancelamento] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      setLista(await listarComprovantes({ ...filtro, texto: texto.trim() || undefined }))
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setCarregando(false)
    }
  }, [filtro, texto])

  useEffect(() => {
    const t = setTimeout(() => void carregar(), texto ? 350 : 0)
    return () => clearTimeout(t)
  }, [carregar, texto])

  const totalListado = useMemo(
    () => lista.filter((r) => r.status === 'valido').reduce((s, r) => s + r.total_geral, 0),
    [lista],
  )

  async function abrir(r: Receipt) {
    try {
      setAberto(await lerComprovante(r.id))
    } catch (e) {
      setErro(mensagemErro(e))
    }
  }

  async function confirmarCancelamento() {
    if (!cancelando) return
    setSalvandoCancelamento(true)
    try {
      await cancelarComprovante(cancelando.id, motivo)
      setCancelando(null)
      setMotivo('')
      setAberto(null)
      await carregar()
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setSalvandoCancelamento(false)
    }
  }

  if (aberto) {
    return (
      <div className="space-y-4">
        <button type="button" className="btn-secundario" onClick={() => setAberto(null)}>
          ← Voltar ao histórico
        </button>
        {aberto.status === 'cancelado' ? (
          <Aviso tom="erro" titulo="Comprovante cancelado">
            {aberto.motivo_cancelamento}
          </Aviso>
        ) : null}
        <PreviaComprovante dados={dadosDoComprovante(aberto)} />
        <AcoesComprovante dados={dadosDoComprovante(aberto)} />
        {ehAdmin && aberto.status === 'valido' ? (
          <div className="grid gap-2">
            <button
              type="button"
              className="btn-perigo w-full"
              onClick={() => setCancelando(aberto)}
            >
              Cancelar este comprovante
            </button>
            <p className="text-center text-xs text-slate-500">
              O cancelamento preserva o original no histórico e exige o motivo.
            </p>
          </div>
        ) : null}
        {ehAdmin && aberto.status === 'cancelado' ? (
          <button
            type="button"
            className="btn-primario w-full"
            onClick={() => navegar(`/novo?corrigir=${aberto.id}`)}
          >
            Emitir comprovante corrigido
          </button>
        ) : null}

        <Confirmacao
          aberto={Boolean(cancelando)}
          titulo={`Cancelar o comprovante ${cancelando?.numero_comprovante ?? ''}?`}
          descricao="Ele continuará no histórico, marcado como cancelado, e sairá dos totais do mês. Esta ação não pode ser desfeita."
          rotuloConfirmar={salvandoCancelamento ? 'Cancelando…' : 'Confirmar cancelamento'}
          perigo
          desabilitarConfirmar={motivo.trim().length < 5 || salvandoCancelamento}
          aoFechar={() => {
            setCancelando(null)
            setMotivo('')
          }}
          aoConfirmar={() => void confirmarCancelamento()}
        >
          <AreaTexto
            rotulo="Motivo do cancelamento"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: valor digitado errado durante o culto"
            dica="Mínimo de 5 caracteres. Fica registrado na auditoria."
          />
        </Confirmacao>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Histórico de comprovantes</h1>

      <Campo
        rotulo="Buscar"
        placeholder="Nome ou número do comprovante"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        type="search"
      />

      <details className="cartao p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">Filtros</summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Selecao
            rotulo="Competência"
            value={filtro.competencia ?? ''}
            onChange={(e) => setFiltro((f) => ({ ...f, competencia: e.target.value || undefined }))}
          >
            <option value="">Todas</option>
            {competenciasDisponiveis().map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Selecao>
          <Selecao
            rotulo="Situação"
            value={filtro.status ?? ''}
            onChange={(e) =>
              setFiltro((f) => ({ ...f, status: (e.target.value || undefined) as never }))
            }
          >
            <option value="">Todas</option>
            <option value="valido">Válidos</option>
            <option value="cancelado">Cancelados</option>
          </Selecao>
          <Selecao
            rotulo="Tipo"
            value={filtro.tipo ?? ''}
            onChange={(e) =>
              setFiltro((f) => ({ ...f, tipo: (e.target.value || undefined) as never }))
            }
          >
            <option value="">Dízimos e ofertas</option>
            <option value="dizimo">Com dízimo</option>
            <option value="oferta">Com oferta</option>
          </Selecao>
          <Selecao
            rotulo="Forma de recebimento"
            value={filtro.forma ?? ''}
            onChange={(e) => setFiltro((f) => ({ ...f, forma: e.target.value || undefined }))}
          >
            <option value="">Todas</option>
            {config.formas_recebimento.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Selecao>
          <Selecao
            rotulo="Identificação"
            value={filtro.identificacao ?? ''}
            onChange={(e) =>
              setFiltro((f) => ({ ...f, identificacao: (e.target.value || undefined) as never }))
            }
          >
            <option value="">Todos</option>
            <option value="identificado">Identificados</option>
            <option value="nao_identificado">Não identificados</option>
          </Selecao>
          <div className="grid grid-cols-2 gap-2">
            <Campo
              rotulo="De"
              type="date"
              value={filtro.dataInicial ?? ''}
              onChange={(e) => setFiltro((f) => ({ ...f, dataInicial: e.target.value || undefined }))}
            />
            <Campo
              rotulo="Até"
              type="date"
              value={filtro.dataFinal ?? ''}
              onChange={(e) => setFiltro((f) => ({ ...f, dataFinal: e.target.value || undefined }))}
            />
          </div>
        </div>
        <button
          type="button"
          className="btn-secundario mt-3 w-full"
          onClick={() => {
            setFiltro({})
            setTexto('')
          }}
        >
          Limpar filtros
        </button>
      </details>

      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      {!carregando && lista.length > 0 ? (
        <p className="text-sm text-slate-600">
          {lista.length} comprovante(s) · válidos somam{' '}
          <strong className="tabular-nums">{formatMoney(totalListado)}</strong>
        </p>
      ) : null}

      {carregando ? <Carregando /> : null}

      {!carregando && lista.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum comprovante encontrado"
          descricao="Ajuste a busca ou os filtros. Comprovantes guardados no aparelho, ainda sem envio, não aparecem aqui."
        />
      ) : null}

      <ul className="space-y-2">
        {lista.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => void abrir(r)}
              className="cartao flex w-full items-center gap-3 p-4 text-left hover:border-navy-300"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-slate-500">{r.numero_comprovante}</span>
                  {r.status === 'cancelado' ? <Etiqueta tom="erro">Cancelado</Etiqueta> : null}
                  {r.nao_identificado ? <Etiqueta tom="neutro">Não identificado</Etiqueta> : null}
                </div>
                <p className="mt-1 truncate text-base font-semibold text-slate-900">
                  {r.nome_exibido}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatarDataISO(r.data_recebimento)} às {formatarHora(r.hora_recebimento)} ·{' '}
                  {r.forma_recebimento} · competência {r.competencia}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={`text-lg font-bold tabular-nums ${
                    r.status === 'cancelado' ? 'text-slate-400 line-through' : 'text-navy-900'
                  }`}
                >
                  {formatMoney(r.total_geral)}
                </p>
                {r.total_dizimo > 0 && r.total_oferta > 0 ? (
                  <p className="text-[11px] text-slate-500">
                    dízimo {formatMoney(r.total_dizimo)} · oferta {formatMoney(r.total_oferta)}
                  </p>
                ) : null}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
