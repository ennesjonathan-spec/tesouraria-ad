/** Valor por extenso em português do Brasil, a partir de centavos. */
import type { Cents } from './money'

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
const DEZ_A_19 = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis',
  'dezessete', 'dezoito', 'dezenove']
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta',
  'setenta', 'oitenta', 'noventa']
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
  'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

/** 1 a 999 por extenso. */
function ate999(n: number): string {
  if (n <= 0) return ''
  if (n === 100) return 'cem'

  const centena = Math.floor(n / 100)
  const resto = n % 100
  const partes: string[] = []

  if (centena > 0) partes.push(CENTENAS[centena]!)

  if (resto >= 10 && resto < 20) {
    partes.push(DEZ_A_19[resto - 10]!)
  } else {
    const dezena = Math.floor(resto / 10)
    const unidade = resto % 10
    if (dezena > 0 && unidade > 0) partes.push(`${DEZENAS[dezena]!} e ${UNIDADES[unidade]!}`)
    else if (dezena > 0) partes.push(DEZENAS[dezena]!)
    else if (unidade > 0) partes.push(UNIDADES[unidade]!)
  }

  return partes.join(' e ')
}

const ESCALAS: ReadonlyArray<readonly [string, string]> = [
  ['', ''],
  ['mil', 'mil'],
  ['milhão', 'milhões'],
  ['bilhão', 'bilhões'],
  ['trilhão', 'trilhões'],
]

function inteiroExtenso(n: number): string {
  if (n === 0) return 'zero'

  // Quebra em grupos de três, do menos para o mais significativo.
  const grupos: number[] = []
  let resto = n
  while (resto > 0) {
    grupos.push(resto % 1000)
    resto = Math.floor(resto / 1000)
  }

  const trechos: Array<{ texto: string; valor: number }> = []
  for (let i = grupos.length - 1; i >= 0; i--) {
    const g = grupos[i]!
    if (g === 0) continue
    const escala = ESCALAS[i] ?? ['', '']
    let texto: string
    if (i === 0) texto = ate999(g)
    else if (i === 1) texto = g === 1 ? 'mil' : `${ate999(g)} mil`
    else texto = `${ate999(g)} ${g === 1 ? escala[0] : escala[1]}`
    trechos.push({ texto, valor: g })
  }

  // Ligação entre os grupos, como se escreve em cheque e recibo:
  //   "mil e duzentos"                      (último grupo < 100 ou centena redonda)
  //   "mil duzentos e trinta e quatro"      (último grupo quebrado: só espaço)
  //   "um milhão, duzentos e trinta e ..."  (vírgula entre grupos intermediários)
  let saida = trechos[0]!.texto
  for (let i = 1; i < trechos.length; i++) {
    const ultimo = i === trechos.length - 1
    const g = trechos[i]!.valor
    let liga: string
    if (!ultimo) liga = ', '
    else if (g < 100 || g % 100 === 0) liga = ' e '
    else liga = ' '
    saida += liga + trechos[i]!.texto
  }
  return saida
}

export function valorPorExtenso(cents: Cents): string {
  const abs = Math.abs(Math.trunc(cents))
  const reais = Math.floor(abs / 100)
  const centavos = abs % 100
  const partes: string[] = []
  if (reais > 0) partes.push(`${inteiroExtenso(reais)} ${reais === 1 ? 'real' : 'reais'}`)
  if (centavos > 0) {
    partes.push(`${inteiroExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`)
  }
  if (partes.length === 0) return 'zero real'
  return partes.join(' e ')
}
