/**
 * Dinheiro em centavos inteiros.
 *
 * Nenhuma soma de valores passa por ponto flutuante: 0,1 + 0,2 em binário
 * dá 0,30000000000000004, e três lançamentos bastam para o fechamento
 * fechar com um centavo de diferença. Guardamos centavos como inteiro
 * (`Cents`) e só convertemos para texto na hora de mostrar. No banco, a
 * coluna é numeric(14,2), que também é exata.
 */
export type Cents = number

const MAX_CENTS = 99_999_999_999_99 // numeric(14,2)

/** Converte o que o usuário digitou em centavos. Aceita "1.234,56", "1234,56", "1234.56", "R$ 90". */
export function parseMoney(input: string): Cents | null {
  if (typeof input !== 'string') return null
  let s = input.trim().replace(/\s/g, '').replace(/^R\$/i, '')
  if (!s) return null
  if (!/^[0-9.,]+$/.test(s)) return null

  const ultimaVirgula = s.lastIndexOf(',')
  const ultimoPonto = s.lastIndexOf('.')

  if (ultimaVirgula > -1 && ultimoPonto > -1) {
    // O separador decimal é o que aparece por último.
    if (ultimaVirgula > ultimoPonto) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (ultimaVirgula > -1) {
    // Só vírgula: em pt-BR ela é o separador decimal, com 1 ou 2 casas.
    // "10,999" não é mil-e-novecentos nada: é erro de digitação. Recusamos,
    // em vez de adivinhar e transformar um dízimo de R$ 10,99 em R$ 10.999,00.
    const casas = s.length - ultimaVirgula - 1
    if (casas !== 1 && casas !== 2) return null
    s = s.replace(',', '.')
  } else if (ultimoPonto > -1) {
    const casas = s.length - ultimoPonto - 1
    if (casas !== 1 && casas !== 2) s = s.replace(/\./g, '')
  }

  if (!/^\d*(\.\d{1,2})?$/.test(s)) return null
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  const cents = Math.round(n * 100)
  if (cents > MAX_CENTS) return null
  return cents
}

/** Entrada progressiva do teclado numérico: cada dígito empurra as casas decimais. */
export function digitsToCents(digits: string): Cents {
  const limpos = digits.replace(/\D/g, '').slice(0, 13)
  return limpos ? Number(limpos) : 0
}

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const BRL_SEM_SIMBOLO = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatMoney(cents: Cents): string {
  return BRL.format(cents / 100)
}

export function formatMoneyPlain(cents: Cents): string {
  return BRL_SEM_SIMBOLO.format(cents / 100)
}

/** Soma exata: inteiros, nunca float. */
export function sumCents(valores: readonly Cents[]): Cents {
  let total = 0
  for (const v of valores) total += Math.trunc(v)
  return total
}

/** Para o banco: "250.00". Nunca mandamos number, para não passar por float no JSON. */
export function centsToDecimalString(cents: Cents): string {
  const neg = cents < 0
  const abs = Math.abs(Math.trunc(cents))
  const reais = Math.floor(abs / 100)
  const centavos = abs % 100
  return `${neg ? '-' : ''}${reais}.${String(centavos).padStart(2, '0')}`
}

/** Do banco de volta: numeric vem como string em JSON ("250.00"). */
export function decimalStringToCents(valor: string | number | null | undefined): Cents {
  if (valor === null || valor === undefined) return 0
  if (typeof valor === 'number') return Math.round(valor * 100)
  const s = valor.trim()
  if (!s) return 0
  const neg = s.startsWith('-')
  const [inteira = '0', frac = ''] = s.replace('-', '').split('.')
  const centavos = (frac + '00').slice(0, 2)
  const cents = Number(inteira) * 100 + Number(centavos)
  return neg ? -cents : cents
}

export function isValorValido(cents: Cents | null): cents is Cents {
  return cents !== null && Number.isInteger(cents) && cents > 0 && cents <= MAX_CENTS
}
