import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  atualizarMembro,
  criarMembro,
  criarMembrosEmLote,
  listarComprovantes,
  listarMembros,
  resumoPorMembro,
  type ResumoMembro,
} from '@/data/repo'
import { baixarCsv, baixarXlsx, lerPlanilhaDeMembros, type ResultadoLeitura } from '@/lib/planilha'
import { formatMoney } from '@/lib/money'
import { formatarDataISO, competenciasDisponiveis } from '@/lib/dates'
import { arrumarNome, distancia, formatarTelefone, normalizar } from '@/lib/normalize'
import { mensagemErro } from '@/lib/errors'
import { salvarMembrosEmCache } from '@/lib/idb'
import { useAuth } from '@/state/AuthContext'
import {
  AreaTexto,
  Aviso,
  Campo,
  Carregando,
  Confirmacao,
  EstadoVazio,
  Etiqueta,
  Selecao,
} from '@/components/ui'
import type { Member, Receipt } from '@/domain/types'

export function Membros() {
  const { podeLancar, ehAdmin } = useAuth()
  const [membros, setMembros] = useState<Member[]>([])
  const [resumos, setResumos] = useState<Map<string, ResumoMembro>>(new Map())
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [competencia, setCompetencia] = useState('')
  const [editando, setEditando] = useState<Member | null>(null)
  const [novo, setNovo] = useState(false)
  const [detalhe, setDetalhe] = useState<Member | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const [lista, mapa] = await Promise.all([
        listarMembros(true),
        resumoPorMembro(competencia || undefined),
      ])
      setMembros(lista)
      setResumos(mapa)
      await salvarMembrosEmCache(lista)
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setCarregando(false)
    }
  }, [competencia])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const filtrados = useMemo(() => {
    const termo = normalizar(busca)
    return membros
      .filter((m) => (mostrarInativos ? true : m.ativo))
      .filter((m) => !termo || normalizar(m.nome_completo).includes(termo))
      .sort((a, b) => {
        if (a.registro_especial !== b.registro_especial) return a.registro_especial ? -1 : 1
        return a.nome_completo.localeCompare(b.nome_completo, 'pt-BR')
      })
  }, [membros, busca, mostrarInativos])

  const duplicados = useMemo(() => {
    const comuns = membros.filter((m) => !m.registro_especial)
    const pares: Array<[Member, Member]> = []
    for (let i = 0; i < comuns.length; i++) {
      for (let j = i + 1; j < comuns.length; j++) {
        const a = comuns[i]!
        const b = comuns[j]!
        if (distancia(normalizar(a.nome_completo), normalizar(b.nome_completo), 2) <= 2) {
          pares.push([a, b])
        }
      }
    }
    return pares.slice(0, 12)
  }, [membros])

  if (detalhe) {
    return <DetalheMembro membro={detalhe} aoVoltar={() => setDetalhe(null)} />
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Membros e contribuintes</h1>

      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      <Campo
        rotulo="Buscar"
        type="search"
        placeholder="Digite o nome"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Selecao
          rotulo="Total contribuído em"
          value={competencia}
          onChange={(e) => setCompetencia(e.target.value)}
        >
          <option value="">Todo o período</option>
          {competenciasDisponiveis().map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Selecao>
        <label className="flex items-center gap-3 self-end rounded-xl border border-slate-300 bg-white px-4 py-3">
          <input
            type="checkbox"
            className="h-5 w-5 accent-navy-900"
            checked={mostrarInativos}
            onChange={(e) => setMostrarInativos(e.target.checked)}
          />
          <span className="text-sm font-medium text-slate-700">Mostrar inativos</span>
        </label>
      </div>

      {podeLancar ? (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-primario" onClick={() => setNovo(true)}>
            + Novo nome
          </button>
          <ImportarMembros aoImportar={carregar} />
        </div>
      ) : null}

      {ehAdmin && membros.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="btn-secundario"
            onClick={() =>
              void baixarXlsx('membros.xlsx', [
                {
                  nome: 'Membros',
                  linhas: filtrados.map((m) => ({
                    Nome: m.nome_completo,
                    Telefone: m.telefone ?? '',
                    Situação: m.ativo ? 'Ativo' : 'Inativo',
                    'Total no período': (resumos.get(m.id)?.total ?? 0) / 100,
                    'Comprovantes': resumos.get(m.id)?.qtd ?? 0,
                    'Última contribuição': resumos.get(m.id)?.ultima
                      ? formatarDataISO(resumos.get(m.id)!.ultima!)
                      : '',
                    Observação: m.observacao ?? '',
                  })),
                },
              ])
            }
          >
            Exportar XLSX
          </button>
          <button
            type="button"
            className="btn-secundario"
            onClick={() =>
              baixarCsv(
                'membros.csv',
                filtrados.map((m) => ({
                  nome_completo: m.nome_completo,
                  telefone: m.telefone ?? '',
                  situacao: m.ativo ? 'ativo' : 'inativo',
                  observacao: m.observacao ?? '',
                })),
              )
            }
          >
            Exportar CSV
          </button>
        </div>
      ) : null}

      {duplicados.length > 0 ? (
        <details className="cartao p-4">
          <summary className="cursor-pointer text-sm font-semibold text-amber-700">
            {duplicados.length} possível(is) nome(s) duplicado(s)
          </summary>
          <ul className="mt-3 space-y-2 text-sm">
            {duplicados.map(([a, b]) => (
              <li key={`${a.id}-${b.id}`} className="text-slate-700">
                <strong>{a.nome_completo}</strong> × <strong>{b.nome_completo}</strong>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            O aplicativo não junta cadastros sozinho. Inative o errado — o histórico dele é
            preservado.
          </p>
        </details>
      ) : null}

      {carregando ? <Carregando /> : null}

      {!carregando && filtrados.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum nome encontrado"
          descricao="Cadastre os membros um a um ou importe a relação que a igreja já mantém em CSV ou XLSX."
        />
      ) : null}

      <ul className="space-y-2">
        {filtrados.map((m) => {
          const r = resumos.get(m.id)
          return (
            <li key={m.id}>
              <button
                type="button"
                className="cartao flex w-full items-center gap-3 p-4 text-left hover:border-navy-300"
                onClick={() => setDetalhe(m)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`truncate text-base font-semibold ${
                        m.registro_especial ? 'text-slate-500' : 'text-slate-900'
                      }`}
                    >
                      {m.nome_completo}
                    </span>
                    {m.registro_especial ? <Etiqueta tom="neutro">Sistema</Etiqueta> : null}
                    {!m.ativo ? <Etiqueta tom="alerta">Inativo</Etiqueta> : null}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {m.telefone ? `${formatarTelefone(m.telefone)} · ` : ''}
                    {r?.ultima ? `última em ${formatarDataISO(r.ultima)}` : 'sem contribuição registrada'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-base font-bold tabular-nums text-navy-900">
                    {formatMoney(r?.total ?? 0)}
                  </p>
                  <p className="text-[11px] text-slate-500">{r?.qtd ?? 0} comprovante(s)</p>
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      <FormularioMembro
        aberto={novo || Boolean(editando)}
        membro={editando}
        aoFechar={() => {
          setNovo(false)
          setEditando(null)
        }}
        aoSalvar={async () => {
          setNovo(false)
          setEditando(null)
          await carregar()
        }}
      />
    </div>
  )
}

function FormularioMembro({
  aberto,
  membro,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean
  membro: Member | null
  aoFechar: () => void
  aoSalvar: () => Promise<void>
}) {
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setNome(membro?.nome_completo ?? '')
    setTelefone(membro?.telefone ?? '')
    setObservacao(membro?.observacao ?? '')
    setErro(null)
  }, [aberto, membro])

  async function salvar() {
    setErro(null)
    setSalvando(true)
    try {
      if (membro) {
        await atualizarMembro(membro.id, {
          nome_completo: nome,
          telefone: telefone.trim() || null,
          observacao: observacao.trim() || null,
        })
      } else {
        await criarMembro({ nome_completo: nome, telefone, observacao })
      }
      await aoSalvar()
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Confirmacao
      aberto={aberto}
      titulo={membro ? 'Editar cadastro' : 'Novo nome'}
      rotuloConfirmar={salvando ? 'Salvando…' : 'Salvar'}
      desabilitarConfirmar={nome.trim().length < 3 || salvando}
      aoFechar={aoFechar}
      aoConfirmar={() => void salvar()}
    >
      <div className="space-y-3">
        <Campo
          rotulo="Nome completo"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onBlur={(e) => setNome(arrumarNome(e.target.value))}
          placeholder="Nome como aparece no comprovante"
        />
        <Campo
          rotulo="Telefone / WhatsApp (opcional)"
          type="tel"
          inputMode="tel"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="(62) 99999-0000"
          dica="Usado só para abrir a conversa no WhatsApp."
        />
        <AreaTexto
          rotulo="Observação interna (opcional)"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          dica="Não aparece no comprovante."
        />
        {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      </div>
    </Confirmacao>
  )
}

function ImportarMembros({ aoImportar }: { aoImportar: () => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null)
  const [leitura, setLeitura] = useState<ResultadoLeitura | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)

  async function escolher(arquivo: File) {
    setErro(null)
    try {
      setLeitura(await lerPlanilhaDeMembros(arquivo))
    } catch (e) {
      setErro(mensagemErro(e))
    }
  }

  async function confirmar() {
    if (!leitura) return
    setSalvando(true)
    setErro(null)
    try {
      const existentes = new Set(
        (await listarMembros(true)).map((m) => normalizar(m.nome_completo)),
      )
      const novos = leitura.validos.filter((l) => !existentes.has(normalizar(l.nome_completo)))
      const criados = await criarMembrosEmLote(novos)
      setResultado(
        `${criados.length} nome(s) importado(s). ${
          leitura.validos.length - novos.length
        } já existiam e foram mantidos.`,
      )
      setLeitura(null)
      await aoImportar()
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <button type="button" className="btn-secundario" onClick={() => input.current?.click()}>
        Importar lista
      </button>
      <input
        ref={input}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void escolher(f)
          e.target.value = ''
        }}
      />

      {resultado ? (
        <div className="col-span-2">
          <Aviso tom="ok">{resultado}</Aviso>
        </div>
      ) : null}
      {erro ? (
        <div className="col-span-2">
          <Aviso tom="erro">{erro}</Aviso>
        </div>
      ) : null}

      <Confirmacao
        aberto={Boolean(leitura)}
        titulo="Conferir antes de importar"
        rotuloConfirmar={salvando ? 'Importando…' : `Importar ${leitura?.validos.length ?? 0} nome(s)`}
        desabilitarConfirmar={salvando || (leitura?.validos.length ?? 0) === 0}
        aoFechar={() => setLeitura(null)}
        aoConfirmar={() => void confirmar()}
      >
        {leitura ? (
          <div className="space-y-3 text-sm">
            <p className="text-slate-600">
              Coluna de nome: <strong>{leitura.colunasDetectadas.nome}</strong> · telefone:{' '}
              <strong>{leitura.colunasDetectadas.telefone}</strong>
            </p>
            <p className="text-slate-600">
              {leitura.validos.length} nome(s) prontos
              {leitura.ignorados.length ? `, ${leitura.ignorados.length} linha(s) ignorada(s)` : ''}.
              Nomes que já existem são mantidos como estão.
            </p>
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg bg-slate-50 p-3 text-xs">
              {leitura.validos.slice(0, 40).map((l) => (
                <li key={l.linha} className="text-slate-700">
                  {l.nome_completo}
                  {l.telefone ? ` — ${l.telefone}` : ''}
                </li>
              ))}
              {leitura.validos.length > 40 ? (
                <li className="text-slate-400">+ {leitura.validos.length - 40} outros…</li>
              ) : null}
            </ul>
            {leitura.ignorados.length > 0 ? (
              <details>
                <summary className="cursor-pointer text-xs font-semibold text-amber-700">
                  Ver linhas ignoradas
                </summary>
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  {leitura.ignorados.slice(0, 20).map((i) => (
                    <li key={i.linha}>
                      Linha {i.linha}: {i.motivo}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
      </Confirmacao>
    </>
  )
}

function DetalheMembro({ membro, aoVoltar }: { membro: Member; aoVoltar: () => void }) {
  const { podeLancar } = useAuth()
  const [comprovantes, setComprovantes] = useState<Receipt[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [atual, setAtual] = useState(membro)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const todos = await listarComprovantes({ limite: 500 })
      setComprovantes(todos.filter((r) => r.member_id === atual.id))
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setCarregando(false)
    }
  }, [atual.id])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const total = comprovantes
    .filter((r) => r.status === 'valido')
    .reduce((s, r) => s + r.total_geral, 0)

  return (
    <div className="space-y-4">
      <button type="button" className="btn-secundario" onClick={aoVoltar}>
        ← Voltar aos membros
      </button>

      <div className="cartao p-4">
        <h1 className="text-lg font-bold text-slate-900">{atual.nome_completo}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {atual.telefone ? formatarTelefone(atual.telefone) : 'Sem telefone cadastrado'} ·{' '}
          cadastrado em {formatarDataISO(atual.created_at.slice(0, 10))}
        </p>
        {atual.observacao ? (
          <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{atual.observacao}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {atual.registro_especial ? <Etiqueta tom="neutro">Registro do sistema</Etiqueta> : null}
          <Etiqueta tom={atual.ativo ? 'ok' : 'alerta'}>{atual.ativo ? 'Ativo' : 'Inativo'}</Etiqueta>
        </div>

        {podeLancar && !atual.registro_especial ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" className="btn-secundario" onClick={() => setEditando(true)}>
              Editar
            </button>
            <button
              type="button"
              className="btn-secundario"
              onClick={async () => {
                try {
                  setAtual(await atualizarMembro(atual.id, { ativo: !atual.ativo }))
                } catch (e) {
                  setErro(mensagemErro(e))
                }
              }}
            >
              {atual.ativo ? 'Inativar' : 'Reativar'}
            </button>
          </div>
        ) : null}
        {!atual.registro_especial ? (
          <p className="mt-3 text-xs text-slate-500">
            Cadastros com histórico financeiro são inativados, nunca excluídos — assim os
            comprovantes já emitidos continuam válidos.
          </p>
        ) : (
          <p className="mt-3 text-xs text-slate-500">
            Registro permanente do sistema: não pode ser renomeado, inativado nem excluído.
          </p>
        )}
      </div>

      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      <div className="cartao p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Total contribuído (comprovantes válidos)
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-navy-900">{formatMoney(total)}</p>
      </div>

      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
        Histórico de comprovantes
      </h2>
      {carregando ? <Carregando /> : null}
      {!carregando && comprovantes.length === 0 ? (
        <EstadoVazio titulo="Nenhum comprovante" descricao="Esta pessoa ainda não tem lançamentos registrados." />
      ) : null}
      <ul className="space-y-2">
        {comprovantes.map((r) => (
          <li key={r.id} className="cartao flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="font-mono text-xs text-slate-500">{r.numero_comprovante}</p>
              <p className="text-sm text-slate-700">
                {formatarDataISO(r.data_recebimento)} · {r.forma_recebimento}
              </p>
            </div>
            <div className="text-right">
              <p
                className={`font-bold tabular-nums ${
                  r.status === 'cancelado' ? 'text-slate-400 line-through' : 'text-slate-900'
                }`}
              >
                {formatMoney(r.total_geral)}
              </p>
              {r.status === 'cancelado' ? <Etiqueta tom="erro">Cancelado</Etiqueta> : null}
            </div>
          </li>
        ))}
      </ul>

      <FormularioMembro
        aberto={editando}
        membro={atual}
        aoFechar={() => setEditando(false)}
        aoSalvar={async () => {
          setEditando(false)
          const lista = await listarMembros(true)
          const novo = lista.find((m) => m.id === atual.id)
          if (novo) setAtual(novo)
        }}
      />
    </div>
  )
}
