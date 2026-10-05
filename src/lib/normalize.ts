/** Normalização de texto para busca tolerante a acento e caixa. */
export function normalizar(txt: string): string {
  return (txt ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Nome em Caixa de Título, respeitando as partículas do português. */
export function arrumarNome(txt: string): string {
  const minusculas = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du'])
  return normalizarEspacos(txt)
    .toLocaleLowerCase('pt-BR')
    .split(' ')
    .map((palavra, i) => {
      if (i > 0 && minusculas.has(palavra)) return palavra
      if (palavra.length <= 1) return palavra.toLocaleUpperCase('pt-BR')
      return palavra.charAt(0).toLocaleUpperCase('pt-BR') + palavra.slice(1)
    })
    .join(' ')
}

export function normalizarEspacos(txt: string): string {
  return (txt ?? '').replace(/\s+/g, ' ').trim()
}

/** Distância de Levenshtein limitada — para sugerir possíveis duplicidades. */
export function distancia(a: string, b: string, limite = 3): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > limite) return limite + 1
  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const atual = [i]
    let menor = i
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1
      const v = Math.min(anterior[j]! + 1, atual[j - 1]! + 1, anterior[j - 1]! + custo)
      atual[j] = v
      if (v < menor) menor = v
    }
    if (menor > limite) return limite + 1
    anterior = atual
  }
  return anterior[b.length]!
}

/** Só os dígitos do telefone, com 55 na frente para o link do WhatsApp. */
export function telefoneParaWhatsApp(telefone: string | null | undefined): string | null {
  if (!telefone) return null
  const d = telefone.replace(/\D/g, '')
  if (d.length < 10) return null
  if (d.startsWith('55') && d.length >= 12) return d
  return `55${d}`
}

export function formatarTelefone(telefone: string | null | undefined): string {
  if (!telefone) return ''
  const d = telefone.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return telefone
}
