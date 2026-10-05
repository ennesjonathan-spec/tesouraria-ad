import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listarComprovantes } from '@/data/repo'
import { montarResumoPainel } from '@/domain/totals'
import { formatMoney } from '@/lib/money'
import { competenciaAtual, competenciaPorExtenso, hojeISO } from '@/lib/dates'
import { mensagemErro } from '@/lib/errors'
import { useAuth } from '@/state/AuthContext'
import { useOffline } from '@/state/OfflineContext'
import { Aviso, Carregando } from '@/components/ui'
import type { ResumoPainel } from '@/domain/types'

export function Inicio() {
  const { perfil, podeLancar } = useAuth()
  const { rascunhos, online, sincronizar, sincronizando } = useOffline()
  const [resumo, setResumo] = useState<ResumoPainel | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const competencia = competenciaAtual()

  const carregar = useCallback(async () => {
    setErro(null)
    try {
      const lista = await listarComprovantes({ competencia, limite: 1000 })
      setResumo(montarResumoPainel(lista, hojeISO()))
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setCarregando(false)
    }
  }, [competencia])

  useEffect(() => {
    void carregar()
  }, [carregar])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          Olá, {perfil?.nome?.split(' ')[0] ?? 'bem-vindo'}
        </h1>
        <p className="text-sm text-slate-500">
          Competência de {competenciaPorExtenso(competencia)}
        </p>
      </div>

      {podeLancar ? (
        <Link to="/novo" className="btn-primario w-full text-lg">
          + Novo comprovante
        </Link>
      ) : (
        <Aviso tom="info">
          Seu perfil é de consulta: você acompanha relatórios e comprovantes, mas não registra
          recebimentos.
        </Aviso>
      )}

      {rascunhos.length > 0 ? (
        <Aviso tom="alerta" titulo={`${rascunhos.length} lançamento(s) ainda no aparelho`}>
          <p>
            Eles não têm número oficial e não entram em nenhum relatório enquanto não forem
            enviados.
          </p>
          <button
            type="button"
            className="mt-2 font-semibold underline underline-offset-2 disabled:opacity-50"
            disabled={!online || sincronizando}
            onClick={() => void sincronizar().then(carregar)}
          >
            {sincronizando ? 'Enviando…' : online ? 'Enviar agora' : 'Aguardando internet'}
          </button>
        </Aviso>
      ) : null}

      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {carregando ? <Carregando /> : null}

      {resumo ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Cartao titulo="Recebido hoje" valor={formatMoney(resumo.totalHoje)} destaque />
            <Cartao titulo="Recebido no mês" valor={formatMoney(resumo.totalMes)} destaque />
            <Cartao titulo="Dízimos no mês" valor={formatMoney(resumo.dizimosMes)} />
            <Cartao titulo="Ofertas no mês" valor={formatMoney(resumo.ofertasMes)} />
          </div>

          <section className="cartao p-4">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
              Por forma de recebimento
            </h2>
            {resumo.porForma.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum recebimento neste mês ainda.</p>
            ) : (
              <ul className="space-y-2">
                {resumo.porForma.map((f) => (
                  <li key={f.nome} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-700">{f.nome}</span>
                    <span className="font-bold tabular-nums text-slate-900">
                      {formatMoney(f.total)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="cartao p-4">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
              Identificação
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <Linha rotulo="Identificado" valor={formatMoney(resumo.identificadoMes)} />
              <Linha rotulo="Não identificado" valor={formatMoney(resumo.naoIdentificadoMes)} />
              <Linha rotulo="Comprovantes emitidos" valor={String(resumo.qtdEmitidos)} />
              <Linha rotulo="Comprovantes cancelados" valor={String(resumo.qtdCancelados)} />
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <Link to="/historico" className="btn-secundario">
              Consultar histórico
            </Link>
            <Link to="/membros" className="btn-secundario">
              Cadastrar membro
            </Link>
            <Link to="/relatorios" className="btn-secundario col-span-2">
              Relatório mensal
            </Link>
          </section>
        </>
      ) : null}
    </div>
  )
}

function Cartao({ titulo, valor, destaque }: { titulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`cartao p-4 ${destaque ? 'bg-navy-900 text-white' : ''}`}>
      <p className={`text-xs font-semibold ${destaque ? 'text-white/70' : 'text-slate-500'}`}>
        {titulo}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums">{valor}</p>
    </div>
  )
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{rotulo}</p>
      <p className="text-base font-bold tabular-nums text-slate-900">{valor}</p>
    </div>
  )
}
