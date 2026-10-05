/**
 * Importação e exportação de planilhas (CSV, XLSX).
 *
 * A biblioteca de XLSX é pesada e só faz falta na importação e na exportação.
 * Carregamos sob demanda para o app abrir rápido no celular do culto.
 */
import { normalizar, normalizarEspacos } from './normalize'

type XlsxModulo = typeof import('xlsx')
let xlsxCache: Promise<XlsxModulo> | null = null
function carregarXlsx(): Promise<XlsxModulo> {
  if (!xlsxCache) xlsxCache = import('xlsx')
  return xlsxCache
}

export interface LinhaImportada {
  nome_completo: string
  telefone: string | null
  observacao: string | null
  linha: number
}

export interface ResultadoLeitura {
  validos: LinhaImportada[]
  ignorados: Array<{ linha: number; motivo: string }>
  colunasDetectadas: Record<string, string>
}

const APELIDOS_NOME = ['nome', 'nome completo', 'membro', 'dizimista', 'contribuinte', 'nome do membro']
const APELIDOS_TELEFONE = ['telefone', 'celular', 'whatsapp', 'fone', 'contato', 'telefone/whatsapp']
const APELIDOS_OBS = ['observacao', 'observação', 'obs', 'anotacao', 'anotação', 'nota']

function acharColuna(cabecalhos: string[], apelidos: string[]): string | null {
  for (const c of cabecalhos) {
    if (apelidos.includes(normalizar(c))) return c
  }
  for (const c of cabecalhos) {
    const n = normalizar(c)
    if (apelidos.some((a) => n.includes(a))) return c
  }
  return null
}

/**
 * Lê CSV ou XLSX. Aceita a planilha do jeito que a igreja já mantém: detecta
 * as colunas pelo cabeçalho e, se houver uma coluna só, trata como nomes.
 */
export async function lerPlanilhaDeMembros(arquivo: File): Promise<ResultadoLeitura> {
  const XLSX = await carregarXlsx()
  const buffer = await arquivo.arrayBuffer()
  const livro = XLSX.read(buffer, { type: 'array', raw: false })
  const primeira = livro.SheetNames[0]
  if (!primeira) throw new Error('A planilha está vazia.')
  const aba = livro.Sheets[primeira]
  if (!aba) throw new Error('A planilha está vazia.')

  const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(aba, { defval: '', raw: false })
  if (linhas.length === 0) throw new Error('Não há linhas de dados na planilha.')

  const cabecalhos = Object.keys(linhas[0] ?? {})
  const colNome = acharColuna(cabecalhos, APELIDOS_NOME) ?? cabecalhos[0] ?? ''
  const colTel = acharColuna(cabecalhos, APELIDOS_TELEFONE)
  const colObs = acharColuna(cabecalhos, APELIDOS_OBS)

  const validos: LinhaImportada[] = []
  const ignorados: Array<{ linha: number; motivo: string }> = []
  const vistos = new Set<string>()

  linhas.forEach((l, i) => {
    const numeroLinha = i + 2 // +1 do cabeçalho, +1 porque planilha começa em 1
    const nome = normalizarEspacos(String(l[colNome] ?? ''))
    if (!nome) {
      ignorados.push({ linha: numeroLinha, motivo: 'sem nome' })
      return
    }
    if (nome.length < 2) {
      ignorados.push({ linha: numeroLinha, motivo: 'nome muito curto' })
      return
    }
    const chave = normalizar(nome)
    if (vistos.has(chave)) {
      ignorados.push({ linha: numeroLinha, motivo: `repetido na própria planilha (${nome})` })
      return
    }
    vistos.add(chave)
    validos.push({
      nome_completo: nome,
      telefone: colTel ? normalizarEspacos(String(l[colTel] ?? '')) || null : null,
      observacao: colObs ? normalizarEspacos(String(l[colObs] ?? '')) || null : null,
      linha: numeroLinha,
    })
  })

  return {
    validos,
    ignorados,
    colunasDetectadas: {
      nome: colNome,
      telefone: colTel ?? '(não encontrada)',
      observacao: colObs ?? '(não encontrada)',
    },
  }
}

/** Gera e baixa um .xlsx com uma ou mais abas. */
export async function baixarXlsx(
  nomeArquivo: string,
  abas: ReadonlyArray<{ nome: string; linhas: ReadonlyArray<Record<string, unknown>> }>,
): Promise<void> {
  const XLSX = await carregarXlsx()
  const livro = XLSX.utils.book_new()
  for (const aba of abas) {
    const planilha = XLSX.utils.json_to_sheet(aba.linhas as Record<string, unknown>[])
    XLSX.utils.book_append_sheet(livro, planilha, aba.nome.slice(0, 31))
  }
  XLSX.writeFile(livro, nomeArquivo, { compression: true })
}

/** CSV com ponto e vírgula e BOM — o Excel em português abre direito. */
export function baixarCsv(
  nomeArquivo: string,
  linhas: ReadonlyArray<Record<string, unknown>>,
): void {
  if (linhas.length === 0) return
  const colunas = Object.keys(linhas[0] ?? {})
  const escapar = (v: unknown) => {
    const s = String(v ?? '')
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const corpo = [
    colunas.join(';'),
    ...linhas.map((l) => colunas.map((c) => escapar(l[c])).join(';')),
  ].join('\r\n')
  const blob = new Blob([`﻿${corpo}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
