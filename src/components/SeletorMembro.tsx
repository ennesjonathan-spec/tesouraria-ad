import { useEffect, useMemo, useRef, useState } from 'react'
import { normalizar, arrumarNome, distancia } from '@/lib/normalize'
import { NOME_NAO_IDENTIFICADO } from '@/domain/catalog'
import type { Member } from '@/domain/types'
import { Aviso, Campo } from './ui'

/**
 * Busca de membro tolerante a acento e caixa, com NÃO IDENTIFICADO sempre no
 * topo e cadastro de nome novo sem sair do formulário.
 */
export function SeletorMembro({
  membros,
  selecionado,
  aoSelecionar,
  aoCriar,
  podeCriar,
}: {
  membros: readonly Member[]
  selecionado: Member | null
  aoSelecionar: (m: Member) => void
  aoCriar: (nome: string) => Promise<Member>
  podeCriar: boolean
}) {
  const [busca, setBusca] = useState('')
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const campo = useRef<HTMLInputElement>(null)

  const especial = useMemo(() => membros.find((m) => m.registro_especial) ?? null, [membros])

  const resultados = useMemo(() => {
    const termo = normalizar(busca)
    const comuns = membros.filter((m) => !m.registro_especial && m.ativo)
    if (!termo) return comuns.slice(0, 30)
    const casa = comuns.filter((m) => normalizar(m.nome_completo).includes(termo))
    // Começa com o termo primeiro; depois o resto, em ordem alfabética.
    return casa
      .sort((a, b) => {
        const na = normalizar(a.nome_completo)
        const nb = normalizar(b.nome_completo)
        const ia = na.startsWith(termo) ? 0 : 1
        const ib = nb.startsWith(termo) ? 0 : 1
        return ia - ib || na.localeCompare(nb, 'pt-BR')
      })
      .slice(0, 40)
  }, [busca, membros])

  const nomeNovo = arrumarNome(busca)
  const jaExiste = useMemo(
    () => membros.some((m) => normalizar(m.nome_completo) === normalizar(busca)),
    [busca, membros],
  )
  const parecidos = useMemo(() => {
    if (nomeNovo.length < 4 || jaExiste) return []
    const alvo = normalizar(nomeNovo)
    return membros
      .filter((m) => !m.registro_especial && distancia(normalizar(m.nome_completo), alvo, 2) <= 2)
      .slice(0, 3)
  }, [nomeNovo, membros, jaExiste])

  useEffect(() => {
    campo.current?.focus()
  }, [])

  async function criar() {
    setErro(null)
    setCriando(true)
    try {
      const m = await aoCriar(nomeNovo)
      aoSelecionar(m)
      setBusca('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível cadastrar este nome.')
    } finally {
      setCriando(false)
    }
  }

  if (selecionado) {
    return (
      <div className="cartao p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Quem está entregando
        </p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className={`truncate text-lg font-bold ${
                selecionado.registro_especial ? 'text-slate-500' : 'text-navy-900'
              }`}
            >
              {selecionado.nome_completo}
            </p>
            {selecionado.registro_especial ? (
              <p className="mt-0.5 text-sm text-slate-500">
                O comprovante sai sem nome, para quem não quer se identificar.
              </p>
            ) : selecionado.telefone ? (
              <p className="mt-0.5 text-sm text-slate-500">{selecionado.telefone}</p>
            ) : (
              <p className="mt-0.5 text-sm text-slate-400">Sem telefone cadastrado</p>
            )}
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-navy-700 hover:bg-navy-50"
            onClick={() => aoSelecionar(null as unknown as Member)}
          >
            Trocar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Campo
        ref={campo}
        rotulo="Quem está entregando?"
        placeholder="Digite o nome"
        value={busca}
        autoComplete="off"
        autoCorrect="off"
        onChange={(e) => setBusca(e.target.value)}
        dica="A busca não diferencia acento nem maiúscula."
      />

      {especial ? (
        <button
          type="button"
          onClick={() => aoSelecionar(especial)}
          className="flex w-full items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-left hover:border-navy-400 hover:bg-navy-50"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            ?
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-slate-700">{NOME_NAO_IDENTIFICADO}</span>
            <span className="block text-xs text-slate-500">
              Quando a pessoa não quer se identificar
            </span>
          </span>
        </button>
      ) : null}

      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      {parecidos.length > 0 ? (
        <Aviso tom="alerta" titulo="Já existe um nome parecido">
          <ul className="mt-1 space-y-1">
            {parecidos.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="font-semibold underline underline-offset-2"
                  onClick={() => aoSelecionar(p)}
                >
                  {p.nome_completo}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-1.5">Confira antes de cadastrar outro, para não duplicar a relação.</p>
        </Aviso>
      ) : null}

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {resultados.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => aoSelecionar(m)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-800">
                  {m.nome_completo}
                </span>
                {m.telefone ? (
                  <span className="block text-xs text-slate-500">{m.telefone}</span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
        {resultados.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-slate-500">
            {busca ? 'Nenhum nome encontrado.' : 'Nenhum membro cadastrado ainda.'}
          </li>
        ) : null}
      </ul>

      {podeCriar && nomeNovo.length >= 3 && !jaExiste ? (
        <button type="button" className="btn-secundario w-full" onClick={criar} disabled={criando}>
          {criando ? 'Cadastrando…' : `Cadastrar “${nomeNovo}” e usar agora`}
        </button>
      ) : null}
    </div>
  )
}
