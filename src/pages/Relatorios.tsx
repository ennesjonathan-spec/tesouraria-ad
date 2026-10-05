import { useCallback, useEffect, useMemo, useState } from 'react'
import { listarComprovantes } from '@/data/repo'
import { montarRelatorioMensal } from '@/domain/totals'
import { formatMoney, formatMoneyPlain } from '@/lib/money'
import { competenciaAtual, competenciaPorExtenso, competenciasDisponiveis, formatarDataISO } from '@/lib/dates'
import { baixarCsv, baixarXlsx } from '@/lib/planilha'
import { mensagemErro } from '@/lib/errors'
import { useSettings } from '@/state/SettingsContext'
import { Aviso, Carregando, EstadoVazio, Etiqueta, Selecao } from '@/components/ui'
import type { RelatorioMensal } from '@/domain/types'

export function Relatorios() {
  const { config } = useSettings()
  const [competencia, setCompetencia] = useState(competenciaAtual())
  const [relatorio, setRelatorio] = useState<RelatorioMensal | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const lista = await listarComprovantes({ competencia, limite: 2000 })
      setRelatorio(montarRelatorioMensal(competencia, lista))
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setCarregando(false)
    }
  }, [competencia])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const nomeBase = useMemo(
    () => `relatorio-${competencia.replace('/', '-')}`,
    [competencia],
  )

  async function exportarXlsx() {
    if (!relatorio) return
    const r = relatorio
    await baixarXlsx(`${nomeBase}.xlsx`, [
      {
        nome: 'Resumo',
        linhas: [
          { Item: 'Competência', Valor: r.competencia },
          { Item: 'Total de dízimos', Valor: r.totalDizimos / 100 },
          { Item: 'Total de ofertas', Valor: r.totalOfertas / 100 },
          { Item: 'Total geral', Valor: r.totalGeral / 100 },
          { Item: 'Identificado', Valor: r.totalIdentificado / 100 },
          { Item: 'Não identificado', Valor: r.totalNaoIdentificado / 100 },
          { Item: 'Comprovantes válidos', Valor: r.qtdComprovantes },
          { Item: 'Comprovantes cancelados', Valor: r.qtdCancelados },
        ],
      },
      {
        nome: 'Dizimistas',
        linhas: r.dizimistas.map((d, i) => ({
          '#': i + 1,
          Nome: d.nome,
          Lançamentos: d.qtd,
          Total: d.total / 100,
        })),
      },
      {
        nome: 'Ofertantes',
        linhas: r.ofertantes.map((d, i) => ({
          '#': i + 1,
          Nome: d.nome,
          Lançamentos: d.qtd,
          Total: d.total / 100,
        })),
      },
      {
        nome: 'Por forma',
        linhas: r.porForma.map((f) => ({ Forma: f.nome, Lançamentos: f.qtd, Total: f.total / 100 })),
      },
      {
        nome: 'Subcategorias',
        linhas: r.porSubcategoria.map((s) => ({
          Subcategoria: s.nome,
          Lançamentos: s.qtd,
          Total: s.total / 100,
        })),
      },
      {
        nome: 'Cancelados',
        linhas: r.cancelados.map((c) => ({
          Número: c.numero_comprovante,
          Nome: c.nome_exibido,
          Data: formatarDataISO(c.data_recebimento),
          Total: c.total_geral / 100,
          Motivo: c.motivo_cancelamento ?? '',
        })),
      },
      {
        nome: 'Conferências',
        linhas: r.conferencias.map((c) => ({
          Conferência: c.rotulo,
          Esperado: c.esperado / 100,
          Apurado: c.apurado / 100,
          Diferença: c.diferenca / 100,
          Situação: c.ok ? 'OK' : 'DIVERGENTE',
        })),
      },
    ])
  }

  function exportarCsv() {
    if (!relatorio) return
    baixarCsv(
      `${nomeBase}-dizimistas.csv`,
      relatorio.dizimistas.map((d, i) => ({
        ordem: i + 1,
        nome: d.nome,
        lancamentos: d.qtd,
        total: formatMoneyPlain(d.total),
      })),
    )
  }

  async function exportarPdf() {
    if (!relatorio) return
    const r = relatorio
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const M = 15
    let y = M

    const titulo = (t: string, tamanho = 12) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(tamanho)
      doc.text(t, M, y)
      y += tamanho * 0.5
    }
    const linha = (esquerda: string, direita = '', negrito = false) => {
      if (y > 275) {
        doc.addPage()
        y = M
      }
      doc.setFont('helvetica', negrito ? 'bold' : 'normal')
      doc.setFontSize(10)
      doc.text(esquerda.slice(0, 78), M, y)
      if (direita) doc.text(direita, 195 - M, y, { align: 'right' })
      y += 5.5
    }

    titulo(config.nome_igreja, 14)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`${config.congregacao} — código ${config.codigo}`, M, y)
    y += 5
    doc.text(`Relatório de ${competenciaPorExtenso(r.competencia)}`, M, y)
    y += 9

    titulo('Resumo')
    linha('Total de dízimos', formatMoney(r.totalDizimos))
    linha('Total de ofertas', formatMoney(r.totalOfertas))
    linha('Total geral', formatMoney(r.totalGeral), true)
    linha('Identificado', formatMoney(r.totalIdentificado))
    linha('Não identificado', formatMoney(r.totalNaoIdentificado))
    linha('Comprovantes válidos', String(r.qtdComprovantes))
    linha('Comprovantes cancelados', String(r.qtdCancelados))
    y += 4

    titulo('Por forma de recebimento')
    for (const f of r.porForma) linha(f.nome, formatMoney(f.total))
    y += 4

    if (r.porSubcategoria.length) {
      titulo('Ofertas por subcategoria')
      for (const s of r.porSubcategoria) linha(s.nome, formatMoney(s.total))
      y += 4
    }

    titulo('Relação nominal de dizimistas')
    r.dizimistas.forEach((d, i) => linha(`${i + 1}. ${d.nome}`, formatMoney(d.total)))
    linha('Soma da relação', formatMoney(r.totalDizimos), true)
    y += 4

    if (r.ofertantes.length) {
      titulo('Relação nominal de ofertantes')
      r.ofertantes.forEach((d, i) => linha(`${i + 1}. ${d.nome}`, formatMoney(d.total)))
      linha('Soma da relação', formatMoney(r.totalOfertas), true)
      y += 4
    }

    if (r.cancelados.length) {
      titulo('Comprovantes cancelados (fora dos totais)')
      for (const c of r.cancelados) {
        linha(
          `${c.numero_comprovante} — ${c.nome_exibido} — ${c.motivo_cancelamento ?? ''}`,
          formatMoney(c.total_geral),
        )
      }
      y += 4
    }

    titulo('Conferências')
    for (const c of r.conferencias) {
      linha(`${c.ok ? 'OK' : 'DIVERGENTE'} — ${c.rotulo}`, formatMoney(c.diferenca))
    }

    y += 10
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`${config.dirigente}  —  Pastor Dirigente`, M, y)
    doc.text(`${config.tesoureiro}  —  Tesoureiro`, 195 - M, y, { align: 'right' })

    doc.save(`${nomeBase}.pdf`)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Relatório mensal</h1>

      <Selecao
        rotulo="Competência"
        value={competencia}
        onChange={(e) => setCompetencia(e.target.value)}
      >
        {competenciasDisponiveis().map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Selecao>

      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {carregando ? <Carregando /> : null}

      {relatorio && !carregando ? (
        relatorio.qtdComprovantes === 0 && relatorio.qtdCancelados === 0 ? (
          <EstadoVazio
            titulo="Nenhum comprovante nesta competência"
            descricao="Assim que houver lançamentos, o relatório é montado sozinho a partir deles."
          />
        ) : (
          <>
            <Conferencias relatorio={relatorio} />

            <section className="grid grid-cols-2 gap-3">
              <Cartao rotulo="Dízimos" valor={formatMoney(relatorio.totalDizimos)} />
              <Cartao rotulo="Ofertas" valor={formatMoney(relatorio.totalOfertas)} />
              <Cartao rotulo="Total geral" valor={formatMoney(relatorio.totalGeral)} destaque />
              <Cartao rotulo="Comprovantes" valor={String(relatorio.qtdComprovantes)} />
            </section>

            <Secao titulo="Por forma de recebimento" itens={relatorio.porForma} />
            <Secao titulo="Ofertas por subcategoria" itens={relatorio.porSubcategoria} />

            <section className="cartao p-4">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                Identificação
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500">Identificado</p>
                  <p className="text-lg font-bold tabular-nums">
                    {formatMoney(relatorio.totalIdentificado)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Não identificado</p>
                  <p className="text-lg font-bold tabular-nums">
                    {formatMoney(relatorio.totalNaoIdentificado)}
                  </p>
                </div>
              </div>
            </section>

            <ListaNominal
              titulo="Relação nominal de dizimistas"
              itens={relatorio.dizimistas}
              total={relatorio.totalDizimos}
              nota="Gerada automaticamente dos itens marcados como dízimo. Não existe lista preenchida à mão."
            />
            <ListaNominal
              titulo="Relação nominal de ofertantes"
              itens={relatorio.ofertantes}
              total={relatorio.totalOfertas}
            />

            {relatorio.cancelados.length > 0 ? (
              <section className="cartao p-4">
                <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-500">
                  Cancelados — fora dos totais
                </h2>
                <p className="mb-3 text-xs text-slate-500">
                  {relatorio.qtdCancelados} comprovante(s), somando{' '}
                  {formatMoney(relatorio.totalCancelado)}.
                </p>
                <ul className="space-y-2">
                  {relatorio.cancelados.map((c) => (
                    <li key={c.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs text-slate-500">
                          {c.numero_comprovante}
                        </span>
                        <span className="font-semibold tabular-nums text-slate-500 line-through">
                          {formatMoney(c.total_geral)}
                        </span>
                      </div>
                      <p className="mt-1 font-medium text-slate-700">{c.nome_exibido}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{c.motivo_cancelamento}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="grid grid-cols-3 gap-2">
              <button type="button" className="btn-secundario" onClick={() => void exportarPdf()}>
                PDF
              </button>
              <button type="button" className="btn-secundario" onClick={() => void exportarXlsx()}>
                XLSX
              </button>
              <button type="button" className="btn-secundario" onClick={exportarCsv}>
                CSV
              </button>
            </section>
          </>
        )
      ) : null}
    </div>
  )
}

function Conferencias({ relatorio }: { relatorio: RelatorioMensal }) {
  const problemas = relatorio.conferencias.filter((c) => !c.ok)
  if (problemas.length === 0) {
    return (
      <Aviso tom="ok" titulo="Conferências do fechamento: tudo fecha">
        <ul className="mt-1 space-y-0.5">
          {relatorio.conferencias.map((c) => (
            <li key={c.rotulo}>✓ {c.rotulo} — diferença de {formatMoney(0)}</li>
          ))}
        </ul>
      </Aviso>
    )
  }
  return (
    <Aviso tom="erro" titulo="Atenção: há divergência no fechamento">
      <ul className="mt-1 space-y-1">
        {problemas.map((c) => (
          <li key={c.rotulo}>
            <strong>{c.rotulo}</strong>
            <br />
            esperado {formatMoney(c.esperado)} · apurado {formatMoney(c.apurado)} ·{' '}
            <strong>diferença de {formatMoney(c.diferenca)}</strong>
          </li>
        ))}
      </ul>
    </Aviso>
  )
}

function Cartao({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`cartao p-4 ${destaque ? 'bg-navy-900 text-white' : ''}`}>
      <p className={`text-xs font-semibold ${destaque ? 'text-white/70' : 'text-slate-500'}`}>
        {rotulo}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums">{valor}</p>
    </div>
  )
}

function Secao({
  titulo,
  itens,
}: {
  titulo: string
  itens: ReadonlyArray<{ nome: string; total: number; qtd: number }>
}) {
  if (itens.length === 0) return null
  return (
    <section className="cartao p-4">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">{titulo}</h2>
      <ul className="space-y-2">
        {itens.map((i) => (
          <li key={i.nome} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-700">
              {i.nome} <span className="text-slate-400">({i.qtd})</span>
            </span>
            <span className="font-bold tabular-nums">{formatMoney(i.total)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ListaNominal({
  titulo,
  itens,
  total,
  nota,
}: {
  titulo: string
  itens: ReadonlyArray<{ nome: string; total: number; qtd: number }>
  total: number
  nota?: string
}) {
  const soma = itens.reduce((s, i) => s + i.total, 0)
  if (itens.length === 0) return null
  return (
    <section className="cartao p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">{titulo}</h2>
      {nota ? <p className="mt-1 text-xs text-slate-500">{nota}</p> : null}
      <ol className="mt-3 divide-y divide-slate-100">
        {itens.map((i, n) => (
          <li key={i.nome} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="min-w-0 truncate text-slate-700">
              <span className="mr-2 text-slate-400">{n + 1}.</span>
              {i.nome}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">{formatMoney(i.total)}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
        <span className="text-sm font-bold text-slate-700">Soma da relação</span>
        <span className="text-base font-bold tabular-nums">{formatMoney(soma)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs text-slate-500">Diferença para o total</span>
        <span className="text-xs">
          {soma === total ? (
            <Etiqueta tom="ok">{formatMoney(0)}</Etiqueta>
          ) : (
            <Etiqueta tom="erro">{formatMoney(soma - total)}</Etiqueta>
          )}
        </span>
      </div>
    </section>
  )
}
