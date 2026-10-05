/**
 * PNG e PDF a partir do mesmo canvas.
 * O PDF embute a imagem em 2x (2160x2700) numa página de 105 x 131,25 mm,
 * o que dá cerca de 520 DPI — fica nítido impresso e continua leve o
 * suficiente para mandar no WhatsApp.
 */
import {
  ALTURA_BASE,
  LARGURA_BASE,
  desenharComprovante,
  nomeArquivo,
  type DadosComprovante,
} from './receiptCanvas'
import type { ChurchSettings } from '@/domain/types'

export const ESCALA_PNG = 1
export const ESCALA_PDF = 2

/** Carrega o logo como imagem pronta para o canvas. Nunca derruba a emissão. */
export async function carregarLogo(url: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!url) return null
  try {
    const resposta = await fetch(url, { mode: 'cors', cache: 'force-cache' })
    if (!resposta.ok) return null
    const blob = await resposta.blob()
    const dataUrl = await new Promise<string>((ok, erro) => {
      const fr = new FileReader()
      fr.onload = () => ok(String(fr.result))
      fr.onerror = () => erro(fr.error)
      fr.readAsDataURL(blob)
    })
    return await new Promise<HTMLImageElement | null>((resolver) => {
      const img = new Image()
      img.onload = () => resolver(img)
      img.onerror = () => resolver(null)
      img.src = dataUrl
    })
  } catch {
    // Sem internet ou logo inacessível: o comprovante sai com o monograma.
    return null
  }
}

function novoCanvas(): HTMLCanvasElement {
  return document.createElement('canvas')
}

export async function gerarPngBlob(
  dados: DadosComprovante,
  config: ChurchSettings,
  logo: HTMLImageElement | null,
): Promise<Blob> {
  const canvas = novoCanvas()
  desenharComprovante(canvas, dados, config, logo, ESCALA_PNG)
  return await new Promise<Blob>((ok, erro) => {
    canvas.toBlob(
      (b) => (b ? ok(b) : erro(new Error('Não foi possível gerar a imagem do comprovante.'))),
      'image/png',
    )
  })
}

/** jsPDF só é baixado quando alguém realmente gera um PDF. */
async function carregarJsPdf() {
  const mod = await import('jspdf')
  return mod.jsPDF
}

export async function gerarPdfBlob(
  dados: DadosComprovante,
  config: ChurchSettings,
  logo: HTMLImageElement | null,
): Promise<Blob> {
  const jsPDF = await carregarJsPdf()
  const canvas = novoCanvas()
  desenharComprovante(canvas, dados, config, logo, ESCALA_PDF)

  const larguraMm = 105 // A6 de largura
  const alturaMm = (larguraMm * ALTURA_BASE) / LARGURA_BASE // mantém o 4:5

  const pdf = new jsPDF({
    unit: 'mm',
    format: [larguraMm, alturaMm],
    orientation: 'portrait',
    compress: true,
  })
  pdf.setProperties({
    title: `Comprovante ${dados.numero}`,
    subject: `Entrega de dízimos e ofertas — competência ${dados.competencia}`,
    author: config.congregacao,
    creator: 'Tesouraria AD Balneário Central',
  })
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, larguraMm, alturaMm, undefined, 'FAST')
  return pdf.output('blob')
}

export interface ArquivosComprovante {
  png: Blob
  pdf: Blob
  nomePng: string
  nomePdf: string
}

export async function gerarArquivos(
  dados: DadosComprovante,
  config: ChurchSettings,
  logo: HTMLImageElement | null,
): Promise<ArquivosComprovante> {
  const [png, pdf] = await Promise.all([
    gerarPngBlob(dados, config, logo),
    gerarPdfBlob(dados, config, logo),
  ])
  return {
    png,
    pdf,
    nomePng: nomeArquivo(dados, 'png'),
    nomePdf: nomeArquivo(dados, 'pdf'),
  }
}

export function baixarBlob(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Em iOS o download é assíncrono; só revogamos depois.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
