/**
 * Agregação e conferência.
 *
 * Fonte única: a lista de comprovantes válidos com seus itens. Não existe
 * nenhuma lista mensal paralela preenchida à mão — a relação nominal de
 * dizimistas é sempre derivada dos itens com tipo 'dizimo'. Por isso a
 * soma da relação e o total de dízimos não podem divergir: são a mesma
 * conta, feita duas vezes a partir do mesmo dado. As conferências abaixo
 * existem para provar isso a cada abertura do relatório.
 */
import { sumCents, type Cents } from '@/lib/money'
import { hojeISO } from '@/lib/dates'
import type {
  Conferencia,
  Receipt,
  RelatorioMensal,
  ResumoPainel,
  TotalNominal,
} from './types'

function somaItens(r: Receipt, tipo?: 'dizimo' | 'oferta'): Cents {
  if (!r.itens || r.itens.length === 0) {
    // Comprovante vindo da view já totalizado.
    if (tipo === 'dizimo') return r.total_dizimo
    if (tipo === 'oferta') return r.total_oferta
    return r.total_geral
  }
  return sumCents(r.itens.filter((i) => !tipo || i.tipo === tipo).map((i) => i.valor))
}

export function totalDoComprovante(r: Receipt): Cents {
  return somaItens(r)
}

function agrupar(
  entradas: ReadonlyArray<{ chave: string; valor: Cents }>,
): TotalNominal[] {
  const mapa = new Map<string, { total: Cents; qtd: number }>()
  for (const e of entradas) {
    const atual = mapa.get(e.chave) ?? { total: 0, qtd: 0 }
    atual.total += e.valor
    atual.qtd += 1
    mapa.set(e.chave, atual)
  }
  return [...mapa.entries()]
    .map(([nome, v]) => ({ nome, total: v.total, qtd: v.qtd }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

function conferencia(rotulo: string, esperado: Cents, apurado: Cents): Conferencia {
  const diferenca = apurado - esperado
  return { rotulo, esperado, apurado, diferenca, ok: diferenca === 0 }
}

/**
 * Monta o relatório de uma competência.
 * `comprovantes` deve conter válidos E cancelados daquela competência:
 * os cancelados entram apenas na seção separada, nunca nos totais.
 */
export function montarRelatorioMensal(
  competencia: string,
  comprovantes: readonly Receipt[],
): RelatorioMensal {
  const validos = comprovantes.filter((r) => r.status === 'valido')
  const cancelados = comprovantes.filter((r) => r.status === 'cancelado')

  const itensDizimo = validos.flatMap((r) =>
    (r.itens ?? []).filter((i) => i.tipo === 'dizimo').map((i) => ({ r, i })),
  )
  const itensOferta = validos.flatMap((r) =>
    (r.itens ?? []).filter((i) => i.tipo === 'oferta').map((i) => ({ r, i })),
  )
  const todosItens = [...itensDizimo, ...itensOferta]

  const totalDizimos = sumCents(itensDizimo.map((x) => x.i.valor))
  const totalOfertas = sumCents(itensOferta.map((x) => x.i.valor))
  const totalGeral = totalDizimos + totalOfertas

  const dizimistas = agrupar(
    itensDizimo.map((x) => ({ chave: x.r.nome_exibido, valor: x.i.valor })),
  )
  const ofertantes = agrupar(
    itensOferta.map((x) => ({ chave: x.r.nome_exibido, valor: x.i.valor })),
  )
  const porSubcategoria = agrupar(
    itensOferta.map((x) => ({
      chave: x.i.subcategoria?.trim() || 'Sem subcategoria',
      valor: x.i.valor,
    })),
  )
  const porForma = agrupar(
    todosItens.map((x) => ({ chave: x.r.forma_recebimento, valor: x.i.valor })),
  )

  const totalIdentificado = sumCents(
    todosItens.filter((x) => !x.r.nao_identificado).map((x) => x.i.valor),
  )
  const totalNaoIdentificado = sumCents(
    todosItens.filter((x) => x.r.nao_identificado).map((x) => x.i.valor),
  )

  const conferencias: Conferencia[] = [
    conferencia(
      'Soma da relação nominal de dízimos = total de dízimos',
      totalDizimos,
      sumCents(dizimistas.map((d) => d.total)),
    ),
    conferencia(
      'Soma das ofertas por pessoa = total de ofertas',
      totalOfertas,
      sumCents(ofertantes.map((o) => o.total)),
    ),
    conferencia('Dízimos + ofertas = total geral', totalGeral, totalDizimos + totalOfertas),
    conferencia(
      'Soma das formas de recebimento = total geral',
      totalGeral,
      sumCents(porForma.map((f) => f.total)),
    ),
    conferencia(
      'Identificados + não identificados = total geral',
      totalGeral,
      totalIdentificado + totalNaoIdentificado,
    ),
    conferencia(
      'Soma das subcategorias de oferta = total de ofertas',
      totalOfertas,
      sumCents(porSubcategoria.map((s) => s.total)),
    ),
    conferencia(
      'Soma dos comprovantes válidos = total geral',
      totalGeral,
      sumCents(validos.map(totalDoComprovante)),
    ),
  ]

  return {
    competencia,
    totalDizimos,
    totalOfertas,
    totalGeral,
    porSubcategoria,
    porForma,
    totalIdentificado,
    totalNaoIdentificado,
    dizimistas,
    ofertantes,
    qtdComprovantes: validos.length,
    qtdCancelados: cancelados.length,
    totalCancelado: sumCents(cancelados.map(totalDoComprovante)),
    cancelados,
    conferencias,
    tudoFecha: conferencias.every((c) => c.ok),
  }
}

/** Números do painel inicial, a partir dos comprovantes da competência corrente. */
export function montarResumoPainel(
  comprovantes: readonly Receipt[],
  hoje: string = hojeISO(),
): ResumoPainel {
  const validos = comprovantes.filter((r) => r.status === 'valido')
  const doDia = validos.filter((r) => r.data_recebimento === hoje)

  const itens = validos.flatMap((r) => (r.itens ?? []).map((i) => ({ r, i })))

  return {
    totalHoje: sumCents(doDia.map(totalDoComprovante)),
    totalMes: sumCents(validos.map(totalDoComprovante)),
    dizimosMes: sumCents(validos.map((r) => somaItens(r, 'dizimo'))),
    ofertasMes: sumCents(validos.map((r) => somaItens(r, 'oferta'))),
    porForma: agrupar(itens.map((x) => ({ chave: x.r.forma_recebimento, valor: x.i.valor }))),
    identificadoMes: sumCents(
      validos.filter((r) => !r.nao_identificado).map(totalDoComprovante),
    ),
    naoIdentificadoMes: sumCents(
      validos.filter((r) => r.nao_identificado).map(totalDoComprovante),
    ),
    qtdEmitidos: validos.length,
    qtdCancelados: comprovantes.filter((r) => r.status === 'cancelado').length,
  }
}

/** Mesmo nome e mesmo valor no mesmo dia: avisa, mas não impede. */
export function possiveisDuplicidades(
  candidato: { nome_exibido: string; data_recebimento: string; total: Cents },
  existentes: readonly Receipt[],
): Receipt[] {
  return existentes.filter(
    (r) =>
      r.status === 'valido' &&
      r.data_recebimento === candidato.data_recebimento &&
      r.nome_exibido.localeCompare(candidato.nome_exibido, 'pt-BR', {
        sensitivity: 'base',
      }) === 0 &&
      totalDoComprovante(r) === candidato.total,
  )
}
