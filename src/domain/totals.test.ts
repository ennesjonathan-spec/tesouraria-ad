import { describe, expect, it } from 'vitest'
import {
  montarRelatorioMensal,
  montarResumoPainel,
  possiveisDuplicidades,
  totalDoComprovante,
} from './totals'
import type { Receipt, ReceiptItem } from './types'
import { parseMoney, sumCents, formatMoney, centsToDecimalString, decimalStringToCents } from '@/lib/money'
import { valorPorExtenso } from '@/lib/extenso'

let seq = 0
function comprovante(p: {
  nome: string
  itens: Array<Partial<ReceiptItem> & { tipo: 'dizimo' | 'oferta'; valor: number }>
  forma?: string
  status?: 'valido' | 'cancelado'
  naoIdentificado?: boolean
  data?: string
  competencia?: string
}): Receipt {
  seq += 1
  const id = `r${seq}`
  const itens: ReceiptItem[] = p.itens.map((i, n) => ({
    id: `${id}-i${n}`,
    receipt_id: id,
    tipo: i.tipo,
    subcategoria: i.subcategoria ?? null,
    valor: i.valor,
    observacao: null,
  }))
  const dizimo = sumCents(itens.filter((i) => i.tipo === 'dizimo').map((i) => i.valor))
  const oferta = sumCents(itens.filter((i) => i.tipo === 'oferta').map((i) => i.valor))
  return {
    id,
    numero_comprovante: `124-2026-${String(seq).padStart(6, '0')}`,
    member_id: `m${seq}`,
    nome_exibido: p.nome,
    data_recebimento: p.data ?? '2026-10-04',
    hora_recebimento: '19:30',
    competencia: p.competencia ?? '10/2026',
    forma_recebimento: p.forma ?? 'PIX',
    observacao: null,
    status: p.status ?? 'valido',
    motivo_cancelamento: p.status === 'cancelado' ? 'erro de digitação' : null,
    cancelado_em: p.status === 'cancelado' ? '2026-10-04T23:00:00Z' : null,
    receipt_original_id: null,
    created_by: 'u1',
    created_at: '2026-10-04T22:30:00Z',
    nao_identificado: p.naoIdentificado ?? false,
    total_dizimo: dizimo,
    total_oferta: oferta,
    total_geral: dizimo + oferta,
    itens,
  }
}

describe('Cenário A — somente dízimo', () => {
  it('total do comprovante é R$ 250,00 e não há linha de oferta', () => {
    const r = comprovante({ nome: 'Maria Aparecida', itens: [{ tipo: 'dizimo', valor: 25000 }] })
    expect(totalDoComprovante(r)).toBe(25000)
    expect(formatMoney(totalDoComprovante(r))).toBe('R$ 250,00')
    expect(r.total_oferta).toBe(0)
    const rel = montarRelatorioMensal('10/2026', [r])
    expect(rel.totalDizimos).toBe(25000)
    expect(rel.totalOfertas).toBe(0)
    expect(rel.ofertantes).toHaveLength(0)
    expect(rel.tudoFecha).toBe(true)
  })
})

describe('Cenário B — dízimo e oferta no mesmo comprovante', () => {
  const r = comprovante({
    nome: 'José Carlos',
    forma: 'Dinheiro',
    itens: [
      { tipo: 'dizimo', valor: 30000 },
      { tipo: 'oferta', valor: 5000, subcategoria: 'Oferta de culto' },
    ],
  })

  it('soma R$ 350,00', () => {
    expect(totalDoComprovante(r)).toBe(35000)
  })

  it('mantém as duas linhas separadas', () => {
    expect(r.itens).toHaveLength(2)
    expect(r.total_dizimo).toBe(30000)
    expect(r.total_oferta).toBe(5000)
  })

  it('a pessoa aparece nas duas relações nominais com o valor certo em cada', () => {
    const rel = montarRelatorioMensal('10/2026', [r])
    expect(rel.dizimistas).toEqual([{ nome: 'José Carlos', total: 30000, qtd: 1 }])
    expect(rel.ofertantes).toEqual([{ nome: 'José Carlos', total: 5000, qtd: 1 }])
    expect(rel.tudoFecha).toBe(true)
  })
})

describe('Cenário C — NÃO IDENTIFICADO', () => {
  it('oferta em dinheiro de R$ 93,00 entra como não identificada', () => {
    const r = comprovante({
      nome: 'NÃO IDENTIFICADO',
      naoIdentificado: true,
      forma: 'Dinheiro',
      itens: [{ tipo: 'oferta', valor: 9300, subcategoria: 'Oferta de culto' }],
    })
    const rel = montarRelatorioMensal('10/2026', [r])
    expect(rel.totalGeral).toBe(9300)
    expect(rel.totalNaoIdentificado).toBe(9300)
    expect(rel.totalIdentificado).toBe(0)
    expect(rel.tudoFecha).toBe(true)
  })
})

describe('Cenário D — cancelamento', () => {
  const validos = [
    comprovante({ nome: 'Ana', itens: [{ tipo: 'dizimo', valor: 20000 }] }),
    comprovante({ nome: 'Bento', itens: [{ tipo: 'oferta', valor: 3000 }] }),
  ]
  const cancelado = comprovante({
    nome: 'Ana',
    status: 'cancelado',
    itens: [{ tipo: 'dizimo', valor: 99999 }],
  })
  const rel = montarRelatorioMensal('10/2026', [...validos, cancelado])

  it('fica no histórico, fora dos totais', () => {
    expect(rel.totalDizimos).toBe(20000)
    expect(rel.totalGeral).toBe(23000)
    expect(rel.qtdComprovantes).toBe(2)
  })

  it('aparece separado, com o próprio total', () => {
    expect(rel.qtdCancelados).toBe(1)
    expect(rel.totalCancelado).toBe(99999)
    expect(rel.cancelados[0]?.motivo_cancelamento).toBeTruthy()
  })

  it('não contamina a relação nominal', () => {
    expect(rel.dizimistas).toEqual([{ nome: 'Ana', total: 20000, qtd: 1 }])
    expect(rel.tudoFecha).toBe(true)
  })
})

describe('Cenário F — todas as conferências fecham em R$ 0,00', () => {
  const movimento = [
    comprovante({ nome: 'Adilson Pereira', forma: 'PIX', itens: [{ tipo: 'dizimo', valor: 5000 }] }),
    comprovante({
      nome: 'Creusa Rodrigues',
      forma: 'PIX',
      itens: [
        { tipo: 'dizimo', valor: 16210 },
        { tipo: 'oferta', valor: 1500, subcategoria: 'Oferta via PIX' },
      ],
    }),
    comprovante({
      nome: 'Cleiton Gomes',
      forma: 'Dinheiro',
      itens: [{ tipo: 'dizimo', valor: 34000 }],
    }),
    comprovante({
      nome: 'NÃO IDENTIFICADO',
      naoIdentificado: true,
      forma: 'Dinheiro',
      itens: [{ tipo: 'oferta', valor: 43695, subcategoria: 'Oferta de culto' }],
    }),
    comprovante({
      nome: 'Luceni Balbina',
      forma: 'Transferência bancária',
      itens: [{ tipo: 'dizimo', valor: 10000 }],
    }),
    comprovante({
      nome: 'Maria Conceição',
      forma: 'PIX',
      itens: [{ tipo: 'oferta', valor: 1500, subcategoria: 'Escola Bíblica Dominical — EBD' }],
    }),
    comprovante({
      nome: 'Pedro João',
      status: 'cancelado',
      itens: [{ tipo: 'dizimo', valor: 350000 }],
    }),
  ]
  const rel = montarRelatorioMensal('10/2026', movimento)

  it('nenhuma conferência apresenta diferença', () => {
    for (const c of rel.conferencias) {
      expect(c.diferenca, `${c.rotulo} divergiu`).toBe(0)
    }
    expect(rel.tudoFecha).toBe(true)
  })

  it('os totais batem com a conta feita à mão', () => {
    expect(rel.totalDizimos).toBe(5000 + 16210 + 34000 + 10000)
    expect(rel.totalOfertas).toBe(1500 + 43695 + 1500)
    expect(rel.totalGeral).toBe(rel.totalDizimos + rel.totalOfertas)
    expect(rel.totalIdentificado + rel.totalNaoIdentificado).toBe(rel.totalGeral)
  })

  it('a relação nominal de dizimistas sai em ordem alfabética', () => {
    expect(rel.dizimistas.map((d) => d.nome)).toEqual([
      'Adilson Pereira',
      'Cleiton Gomes',
      'Creusa Rodrigues',
      'Luceni Balbina',
    ])
  })

  it('a pessoa com dois lançamentos soma só o que é dela em cada relação', () => {
    expect(rel.dizimistas.find((d) => d.nome === 'Creusa Rodrigues')?.total).toBe(16210)
    expect(rel.ofertantes.find((d) => d.nome === 'Creusa Rodrigues')?.total).toBe(1500)
  })
})

describe('Conferência detecta divergência quando ela existe', () => {
  it('um comprovante com total inconsistente com os itens é denunciado', () => {
    const r = comprovante({ nome: 'Teste', itens: [{ tipo: 'dizimo', valor: 10000 }] })
    const corrompido: Receipt = { ...r, total_geral: 12000, total_dizimo: 12000 }
    // A view do banco nunca produziria isso; o teste prova que a conferência
    // acusaria o problema em vez de exibir um total errado em silêncio.
    const rel = montarRelatorioMensal('10/2026', [{ ...corrompido, itens: undefined }])
    const c = rel.conferencias.find((x) => x.rotulo.startsWith('Soma dos comprovantes'))
    expect(rel.tudoFecha).toBe(false)
    expect(c?.ok).toBe(false)
  })
})

describe('Painel inicial', () => {
  it('separa o dia do mês e as formas de recebimento', () => {
    const resumo = montarResumoPainel(
      [
        comprovante({ nome: 'A', data: '2026-10-05', forma: 'PIX', itens: [{ tipo: 'dizimo', valor: 10000 }] }),
        comprovante({ nome: 'B', data: '2026-10-04', forma: 'Dinheiro', itens: [{ tipo: 'oferta', valor: 2500 }] }),
        comprovante({ nome: 'C', data: '2026-10-05', status: 'cancelado', itens: [{ tipo: 'dizimo', valor: 7700 }] }),
      ],
      '2026-10-05',
    )
    expect(resumo.totalHoje).toBe(10000)
    expect(resumo.totalMes).toBe(12500)
    expect(resumo.dizimosMes).toBe(10000)
    expect(resumo.ofertasMes).toBe(2500)
    expect(resumo.qtdEmitidos).toBe(2)
    expect(resumo.qtdCancelados).toBe(1)
    expect(sumCents(resumo.porForma.map((f) => f.total))).toBe(resumo.totalMes)
  })
})

describe('Aviso de duplicidade', () => {
  const existentes = [
    comprovante({ nome: 'Divino Vicente', data: '2026-10-04', itens: [{ tipo: 'dizimo', valor: 35000 }] }),
  ]
  it('avisa quando há mesmo nome e mesmo valor no mesmo dia', () => {
    const achados = possiveisDuplicidades(
      { nome_exibido: 'divino vicente', data_recebimento: '2026-10-04', total: 35000 },
      existentes,
    )
    expect(achados).toHaveLength(1)
  })
  it('não avisa em valor diferente nem em outro dia', () => {
    expect(
      possiveisDuplicidades(
        { nome_exibido: 'Divino Vicente', data_recebimento: '2026-10-04', total: 35001 },
        existentes,
      ),
    ).toHaveLength(0)
    expect(
      possiveisDuplicidades(
        { nome_exibido: 'Divino Vicente', data_recebimento: '2026-10-11', total: 35000 },
        existentes,
      ),
    ).toHaveLength(0)
  })
})

describe('Dinheiro em centavos, sem ponto flutuante', () => {
  it('a soma que erraria em float fecha exata', () => {
    // 0,1 + 0,2 em float dá 0,30000000000000004.
    expect(sumCents([10, 20])).toBe(30)
    const cem = Array.from({ length: 100 }, () => 1)
    expect(sumCents(cem)).toBe(100)
  })

  it('lê o que o tesoureiro digita em qualquer formato', () => {
    expect(parseMoney('250')).toBe(25000)
    expect(parseMoney('250,00')).toBe(25000)
    expect(parseMoney('1.234,56')).toBe(123456)
    expect(parseMoney('1234.56')).toBe(123456)
    expect(parseMoney('R$ 93,00')).toBe(9300)
    expect(parseMoney('0,05')).toBe(5)
    expect(parseMoney('16.210')).toBe(1621000)
    expect(parseMoney('')).toBeNull()
    expect(parseMoney('abc')).toBeNull()
    // "10,999" é erro de digitação, não dez mil novecentos e noventa e nove:
    // o app recusa em vez de adivinhar.
    expect(parseMoney('10,999')).toBeNull()
    expect(parseMoney('250,')).toBeNull()
  })

  it('vai e volta do banco sem perder centavo', () => {
    for (const c of [1, 5, 99, 100, 9300, 25000, 123456, 1621000, 999999999]) {
      expect(decimalStringToCents(centsToDecimalString(c))).toBe(c)
    }
    expect(centsToDecimalString(25000)).toBe('250.00')
    expect(centsToDecimalString(5)).toBe('0.05')
    expect(decimalStringToCents('250.00')).toBe(25000)
    expect(decimalStringToCents('0.05')).toBe(5)
  })
})

describe('Valor por extenso', () => {
  it('escreve os valores do dia a dia', () => {
    expect(valorPorExtenso(25000)).toBe('duzentos e cinquenta reais')
    expect(valorPorExtenso(35000)).toBe('trezentos e cinquenta reais')
    expect(valorPorExtenso(9300)).toBe('noventa e três reais')
    expect(valorPorExtenso(100)).toBe('um real')
    expect(valorPorExtenso(1)).toBe('um centavo')
    expect(valorPorExtenso(16210)).toBe('cento e sessenta e dois reais e dez centavos')
    expect(valorPorExtenso(100000)).toBe('mil reais')
    expect(valorPorExtenso(120050)).toBe('mil e duzentos reais e cinquenta centavos')
    expect(valorPorExtenso(123456)).toBe('mil duzentos e trinta e quatro reais e cinquenta e seis centavos')
    expect(valorPorExtenso(1000000)).toBe('dez mil reais')
    expect(valorPorExtenso(10000)).toBe('cem reais')
    expect(valorPorExtenso(0)).toBe('zero real')
    expect(valorPorExtenso(123456789)).toBe(
      'um milhão, duzentos e trinta e quatro mil quinhentos e sessenta e sete reais e oitenta e nove centavos',
    )
    expect(valorPorExtenso(200000)).toBe('dois mil reais')
    expect(valorPorExtenso(105000)).toBe('mil e cinquenta reais')
  })
})
