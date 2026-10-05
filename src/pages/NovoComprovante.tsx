import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { SeletorMembro } from '@/components/SeletorMembro'
import { AcoesComprovante, PreviaComprovante, dadosDoComprovante } from '@/components/Comprovante'
import { AreaTexto, Aviso, Campo, CampoDinheiro, Carregando, Selecao, Etiqueta } from '@/components/ui'
import {
  criarMembro,
  emitirComprovante,
  listarComprovantes,
  listarMembros,
  lerComprovante,
} from '@/data/repo'
import { guardarMembroNoCache, lerMembrosDoCache, salvarMembrosEmCache } from '@/lib/idb'
import { formatMoney, isValorValido, sumCents } from '@/lib/money'
import {
  agoraHora,
  competenciaAtual,
  competenciasDisponiveis,
  formatarDataISO,
  hojeISO,
} from '@/lib/dates'
import { mensagemErro } from '@/lib/errors'
import { possiveisDuplicidades } from '@/domain/totals'
import { rotuloTipo } from '@/domain/catalog'
import { useAuth } from '@/state/AuthContext'
import { useOffline } from '@/state/OfflineContext'
import { useSettings } from '@/state/SettingsContext'
import type { ItemRascunho, Member, Receipt, TipoLancamento } from '@/domain/types'
import type { DadosComprovante } from '@/render/receiptCanvas'

type Etapa = 1 | 2 | 3 | 4 | 5

const TITULOS: Record<Etapa, string> = {
  1: 'Identificação',
  2: 'Data e competência',
  3: 'Valores',
  4: 'Forma de recebimento',
  5: 'Conferência',
}

function novoUid() {
  return crypto.randomUUID()
}

export function NovoComprovante() {
  const navegar = useNavigate()
  const [params] = useSearchParams()
  const { podeLancar } = useAuth()
  const { config } = useSettings()
  const { online, guardarRascunho } = useOffline()

  const [etapa, setEtapa] = useState<Etapa>(1)
  const [membros, setMembros] = useState<Member[]>([])
  const [carregandoMembros, setCarregandoMembros] = useState(true)

  const [membro, setMembro] = useState<Member | null>(null)
  const [data, setData] = useState(hojeISO())
  const [hora, setHora] = useState(agoraHora())
  const [competencia, setCompetencia] = useState(competenciaAtual())
  const [itens, setItens] = useState<ItemRascunho[]>([
    { uid: novoUid(), tipo: 'dizimo', subcategoria: null, valor: 0, observacao: null },
  ])
  const [forma, setForma] = useState(config.formas_recebimento[0] ?? 'Dinheiro')
  const [observacao, setObservacao] = useState('')

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [emitido, setEmitido] = useState<Receipt | null>(null)
  const [guardadoOffline, setGuardadoOffline] = useState(false)
  const [duplicados, setDuplicados] = useState<Receipt[]>([])
  const [reemissaoDe, setReemissaoDe] = useState<Receipt | null>(null)

  const total = useMemo(() => sumCents(itens.map((i) => i.valor)), [itens])
  const totalDizimos = useMemo(
    () => sumCents(itens.filter((i) => i.tipo === 'dizimo').map((i) => i.valor)),
    [itens],
  )
  const totalOfertas = useMemo(
    () => sumCents(itens.filter((i) => i.tipo === 'oferta').map((i) => i.valor)),
    [itens],
  )
  const itensValidos = useMemo(() => itens.filter((i) => isValorValido(i.valor)), [itens])

  // ---------------------------------------------------- carga inicial
  useEffect(() => {
    let vivo = true
    void (async () => {
      const cache = await lerMembrosDoCache()
      if (vivo && cache.length) setMembros(cache)
      try {
        const lista = await listarMembros(false)
        if (!vivo) return
        setMembros(lista)
        await salvarMembrosEmCache(lista)
      } catch (e) {
        if (vivo && cache.length === 0) setErro(mensagemErro(e))
      } finally {
        if (vivo) setCarregandoMembros(false)
      }
    })()
    return () => {
      vivo = false
    }
  }, [])

  useEffect(() => {
    setForma((f) => (config.formas_recebimento.includes(f) ? f : config.formas_recebimento[0] ?? f))
  }, [config.formas_recebimento])

  // Reemissão: abre já preenchido a partir do comprovante cancelado.
  const idCorrigir = params.get('corrigir')
  useEffect(() => {
    if (!idCorrigir) return
    void (async () => {
      try {
        const original = await lerComprovante(idCorrigir)
        if (!original) return
        setReemissaoDe(original)
        setData(original.data_recebimento)
        setHora(original.hora_recebimento)
        setCompetencia(original.competencia)
        setForma(original.forma_recebimento)
        setObservacao(original.observacao ?? '')
        setItens(
          (original.itens ?? []).map((i) => ({
            uid: novoUid(),
            tipo: i.tipo,
            subcategoria: i.subcategoria,
            valor: i.valor,
            observacao: i.observacao,
          })),
        )
        const m = membros.find((x) => x.id === original.member_id)
        if (m) setMembro(m)
      } catch (e) {
        setErro(mensagemErro(e))
      }
    })()
  }, [idCorrigir, membros])

  // ------------------------------------------------------- navegação
  const podeAvancar = useMemo(() => {
    if (etapa === 1) return Boolean(membro)
    if (etapa === 2) return Boolean(data && hora && /^\d{2}\/\d{4}$/.test(competencia))
    if (etapa === 3) return itensValidos.length > 0 && itensValidos.length === itens.length
    if (etapa === 4) return Boolean(forma)
    return true
  }, [etapa, membro, data, hora, competencia, itensValidos, itens.length, forma])

  const conferirDuplicidade = useCallback(async () => {
    if (!membro) return
    try {
      const doDia = await listarComprovantes({ dataInicial: data, dataFinal: data, limite: 200 })
      setDuplicados(
        possiveisDuplicidades(
          { nome_exibido: membro.nome_completo, data_recebimento: data, total },
          doDia,
        ),
      )
    } catch {
      setDuplicados([])
    }
  }, [membro, data, total])

  function avancar() {
    if (!podeAvancar) return
    const proxima = (etapa + 1) as Etapa
    if (proxima === 5) void conferirDuplicidade()
    setEtapa(proxima)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function voltar() {
    if (etapa === 1) {
      navegar(-1)
      return
    }
    setEtapa((e) => (e - 1) as Etapa)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // --------------------------------------------------------- emissão
  async function confirmar() {
    if (!membro || itensValidos.length === 0) return
    setErro(null)
    setSalvando(true)
    const entrada = {
      member_id: membro.id,
      data_recebimento: data,
      hora_recebimento: hora,
      competencia,
      forma_recebimento: forma,
      observacao: observacao.trim() || null,
      itens: itensValidos,
      client_uuid: novoUid(),
      receipt_original_id: reemissaoDe?.id ?? null,
    }
    try {
      if (!online) {
        await guardarRascunho(entrada)
        setGuardadoOffline(true)
        return
      }
      const r = await emitirComprovante(entrada)
      setEmitido(r)
    } catch (e) {
      // Falha de rede depois de preencher tudo: guarda em vez de perder o lançamento.
      const msg = mensagemErro(e)
      if (/conexão|internet|network/i.test(msg)) {
        await guardarRascunho(entrada)
        setGuardadoOffline(true)
      } else {
        setErro(msg)
      }
    } finally {
      setSalvando(false)
    }
  }

  function recomecar() {
    setEmitido(null)
    setGuardadoOffline(false)
    setMembro(null)
    setItens([{ uid: novoUid(), tipo: 'dizimo', subcategoria: null, valor: 0, observacao: null }])
    setObservacao('')
    setData(hojeISO())
    setHora(agoraHora())
    setCompetencia(competenciaAtual())
    setReemissaoDe(null)
    setDuplicados([])
    setEtapa(1)
    window.scrollTo({ top: 0 })
  }

  if (!podeLancar) {
    return (
      <Aviso tom="alerta" titulo="Sem permissão">
        Seu perfil de acesso não registra recebimentos. Fale com o tesoureiro.
      </Aviso>
    )
  }

  // ------------------------------------------------- comprovante pronto
  if (emitido) {
    return (
      <div className="space-y-4">
        <Aviso tom="ok" titulo={`Comprovante ${emitido.numero_comprovante} emitido`}>
          {formatMoney(emitido.total_geral)} · {emitido.nome_exibido}
        </Aviso>
        <PreviaComprovante dados={dadosDoComprovante(emitido)} />
        <AcoesComprovante
          dados={dadosDoComprovante(emitido)}
          telefone={membro?.telefone}
          nomeDestinatario={membro?.nome_completo}
          aoEmitirOutro={recomecar}
        />
      </div>
    )
  }

  if (guardadoOffline) {
    const previa: DadosComprovante = {
      numero: 'aguardando envio',
      nome: membro?.nome_completo ?? '',
      naoIdentificado: Boolean(membro?.registro_especial),
      dataRecebimento: data,
      horaRecebimento: hora,
      competencia,
      forma,
      observacao: observacao.trim() || null,
      itens: itensValidos,
      total,
    }
    return (
      <div className="space-y-4">
        <Aviso tom="alerta" titulo="Lançamento guardado no aparelho">
          Sem internet agora. O número oficial só é gerado quando o lançamento chegar ao servidor —
          é isso que impede dois comprovantes com o mesmo número. Até lá ele não entra em nenhum
          relatório. O envio acontece sozinho assim que a conexão voltar.
        </Aviso>
        <PreviaComprovante dados={previa} />
        <button type="button" className="btn-primario w-full" onClick={recomecar}>
          Registrar outro recebimento
        </button>
      </div>
    )
  }

  // ------------------------------------------------------- formulário
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Etapa {etapa} de 5
          </p>
          <p className="text-xs font-semibold text-slate-600">{TITULOS[etapa]}</p>
        </div>
        <div className="flex gap-1" role="presentation">
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              key={n}
              className={`h-1.5 flex-1 rounded-full ${n <= etapa ? 'bg-navy-900' : 'bg-slate-200'}`}
            />
          ))}
        </div>
      </div>

      {reemissaoDe ? (
        <Aviso tom="info" titulo="Reemissão">
          Este comprovante substitui o {reemissaoDe.numero_comprovante}, que foi cancelado. O
          original continua no histórico.
        </Aviso>
      ) : null}

      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      {etapa === 1 ? (
        carregandoMembros && membros.length === 0 ? (
          <Carregando texto="Carregando a relação de membros…" />
        ) : (
          <SeletorMembro
            membros={membros}
            selecionado={membro}
            aoSelecionar={setMembro}
            podeCriar
            aoCriar={async (nome) => {
              const m = await criarMembro({ nome_completo: nome })
              setMembros((atual) =>
                [...atual, m].sort((a, b) =>
                  a.nome_completo.localeCompare(b.nome_completo, 'pt-BR'),
                ),
              )
              await guardarMembroNoCache(m)
              return m
            }}
          />
        )
      ) : null}

      {etapa === 2 ? (
        <div className="cartao space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Campo
              rotulo="Data do recebimento"
              type="date"
              value={data}
              max={hojeISO()}
              onChange={(e) => setData(e.target.value)}
            />
            <Campo
              rotulo="Hora"
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
            />
          </div>
          <Selecao
            rotulo="Competência"
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
            dica="Mude quando o valor entregue se referir a outro mês."
          >
            {competenciasDisponiveis().map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Selecao>
        </div>
      ) : null}

      {etapa === 3 ? (
        <div className="space-y-3">
          <Aviso tom="info">
            Marque você mesmo se é dízimo ou oferta. O aplicativo não decide isso pelo valor —
            existe oferta acima de R$ 50,00.
          </Aviso>

          {itens.map((item, indice) => (
            <ItemFormulario
              key={item.uid}
              item={item}
              indice={indice}
              podeRemover={itens.length > 1}
              subcategorias={config.subcategorias_oferta}
              aoMudar={(novo) =>
                setItens((atual) => atual.map((i) => (i.uid === item.uid ? novo : i)))
              }
              aoRemover={() => setItens((atual) => atual.filter((i) => i.uid !== item.uid))}
            />
          ))}

          <button
            type="button"
            className="btn-secundario w-full"
            onClick={() =>
              setItens((atual) => [
                ...atual,
                { uid: novoUid(), tipo: 'oferta', subcategoria: null, valor: 0, observacao: null },
              ])
            }
          >
            + Adicionar outro valor
          </button>

          <div className="cartao flex items-center justify-between p-4">
            <span className="text-sm font-semibold text-slate-600">Total do comprovante</span>
            <span className="text-2xl font-bold tabular-nums text-navy-900">
              {formatMoney(total)}
            </span>
          </div>
          <p className="text-center text-xs text-slate-500">
            O total é sempre a soma dos valores acima e não pode ser digitado.
          </p>
        </div>
      ) : null}

      {etapa === 4 ? (
        <div className="cartao space-y-3 p-4">
          <p className="rotulo">Como o valor foi recebido?</p>
          <div className="grid gap-2">
            {config.formas_recebimento.map((f) => (
              <label
                key={f}
                className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border px-4 ${
                  forma === f ? 'border-navy-700 bg-navy-50' : 'border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="forma"
                  className="h-5 w-5 accent-navy-900"
                  checked={forma === f}
                  onChange={() => setForma(f)}
                />
                <span className="text-base font-semibold text-slate-800">{f}</span>
              </label>
            ))}
          </div>
          <AreaTexto
            rotulo="Observação (opcional)"
            value={observacao}
            maxLength={280}
            onChange={(e) => setObservacao(e.target.value)}
            dica="Aparece no comprovante entregue à pessoa."
          />
        </div>
      ) : null}

      {etapa === 5 ? (
        <div className="space-y-3">
          {duplicados.length > 0 ? (
            <Aviso tom="alerta" titulo="Possível lançamento repetido">
              Hoje já existe {duplicados.length === 1 ? 'um comprovante' : `${duplicados.length} comprovantes`}{' '}
              com este mesmo nome e o mesmo valor:{' '}
              {duplicados.map((d) => d.numero_comprovante).join(', ')}. Pode ser legítimo — confira
              antes de confirmar.
            </Aviso>
          ) : null}

          <div className="cartao divide-y divide-slate-100">
            <Resumo rotulo="Nome" valor={membro?.nome_completo ?? '—'} />
            <Resumo rotulo="Data" valor={`${formatarDataISO(data)} às ${hora}`} />
            <Resumo rotulo="Competência" valor={competencia} />
            {totalDizimos > 0 ? (
              <Resumo rotulo="Dízimos" valor={formatMoney(totalDizimos)} />
            ) : null}
            {totalOfertas > 0 ? (
              <Resumo rotulo="Ofertas" valor={formatMoney(totalOfertas)} />
            ) : null}
            <Resumo rotulo="Forma de recebimento" valor={forma} />
            {observacao.trim() ? <Resumo rotulo="Observação" valor={observacao.trim()} /> : null}
            <div className="flex items-center justify-between gap-3 px-4 py-4">
              <span className="text-sm font-bold text-slate-700">Total</span>
              <span className="text-2xl font-bold tabular-nums text-navy-900">
                {formatMoney(total)}
              </span>
            </div>
          </div>

          {!online ? (
            <Aviso tom="alerta">
              Sem internet: o comprovante será guardado no aparelho e enviado quando a conexão
              voltar.
            </Aviso>
          ) : null}
        </div>
      ) : null}

      <div className="sticky bottom-20 flex gap-2 pt-2">
        <button type="button" className="btn-secundario flex-1" onClick={voltar} disabled={salvando}>
          {etapa === 1 ? 'Cancelar' : 'Voltar'}
        </button>
        {etapa < 5 ? (
          <button
            type="button"
            className="btn-primario flex-[2]"
            onClick={avancar}
            disabled={!podeAvancar}
          >
            Continuar
          </button>
        ) : (
          <button
            type="button"
            className="btn-primario flex-[2]"
            onClick={confirmar}
            disabled={salvando || itensValidos.length === 0}
          >
            {salvando ? 'Gravando…' : 'Confirmar e gerar comprovante'}
          </button>
        )}
      </div>
    </div>
  )
}

function Resumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <span className="text-sm text-slate-500">{rotulo}</span>
      <span className="text-right text-sm font-semibold text-slate-900">{valor}</span>
    </div>
  )
}

function ItemFormulario({
  item,
  indice,
  podeRemover,
  subcategorias,
  aoMudar,
  aoRemover,
}: {
  item: ItemRascunho
  indice: number
  podeRemover: boolean
  subcategorias: readonly string[]
  aoMudar: (i: ItemRascunho) => void
  aoRemover: () => void
}) {
  const invalido = item.valor > 0 ? null : 'Informe um valor maior que zero.'
  return (
    <div className="cartao space-y-3 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Valor {indice + 1}
        </span>
        {podeRemover ? (
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-sm font-semibold text-red-600 hover:bg-red-50"
            onClick={aoRemover}
          >
            Remover
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(['dizimo', 'oferta'] as TipoLancamento[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => aoMudar({ ...item, tipo: t, subcategoria: t === 'dizimo' ? null : item.subcategoria })}
            className={`min-h-[48px] rounded-xl border text-base font-bold transition ${
              item.tipo === t
                ? 'border-navy-900 bg-navy-900 text-white'
                : 'border-slate-300 bg-white text-slate-600'
            }`}
          >
            {rotuloTipo(t)}
          </button>
        ))}
      </div>

      <CampoDinheiro
        rotulo="Valor"
        valor={item.valor}
        aoMudar={(v) => aoMudar({ ...item, valor: v })}
        autoFocus={indice === 0 && item.valor === 0}
        erro={item.valor === 0 ? null : invalido}
      />

      {item.tipo === 'oferta' ? (
        <Selecao
          rotulo="Subcategoria (opcional)"
          value={item.subcategoria ?? ''}
          onChange={(e) => aoMudar({ ...item, subcategoria: e.target.value || null })}
        >
          <option value="">Sem subcategoria</option>
          {subcategorias.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Selecao>
      ) : (
        <p className="text-xs text-slate-500">
          <Etiqueta tom="destaque">Dízimo</Etiqueta>{' '}
          entra na relação nominal de dizimistas do mês.
        </p>
      )}
    </div>
  )
}
