/**
 * Comprovante para bobina térmica de 58 mm.
 *
 * A área imprimível de uma bobina de 58 mm é de ~48 mm, ou 384 pontos a 203 dpi.
 * O desenho é em preto e branco puro (térmica não imprime cinza nem cor),
 * com fonte em negrito e altura variável — o papel é contínuo.
 *
 * Os valores vêm dos mesmos dados do comprovante colorido (DadosComprovante),
 * então o total impresso é sempre o mesmo da tela, do PNG e do PDF.
 */
import { formatMoney } from '@/lib/money'
import { valorPorExtenso } from '@/lib/extenso'
import { formatarDataISO, formatarHora } from '@/lib/dates'
import { rotuloTipo } from '@/domain/catalog'
import type { ChurchSettings } from '@/domain/types'
import type { DadosComprovante } from './receiptCanvas'

/** Largura imprimível em pontos (48 mm a 203 dpi). */
export const LARGURA_TERMICA = 384

const FONTE = 'Arial, "Helvetica Neue", Helvetica, sans-serif'
const M = 8 // margem lateral
const LC = LARGURA_TERMICA - 2 * M

function quebrar(ctx: CanvasRenderingContext2D, texto: string, largura: number): string[] {
  const palavras = texto.split(/\s+/).filter(Boolean)
  const linhas: string[] = []
  let atual = ''
  for (const p of palavras) {
    const teste = atual ? `${atual} ${p}` : p
    if (ctx.measureText(teste).width <= largura || !atual) atual = teste
    else {
      linhas.push(atual)
      atual = p
    }
  }
  if (atual) linhas.push(atual)
  return linhas
}

/** Desenha texto quebrado e devolve o novo Y. */
function paragrafo(
  ctx: CanvasRenderingContext2D,
  texto: string,
  x: number,
  y: number,
  largura: number,
  alturaLinha: number,
  alinhamento: CanvasTextAlign = 'left',
  maxLinhas = 99,
): number {
  ctx.textAlign = alinhamento
  let linhas = quebrar(ctx, texto, largura)
  if (linhas.length > maxLinhas) {
    linhas = linhas.slice(0, maxLinhas)
    linhas[maxLinhas - 1] = `${linhas[maxLinhas - 1]!.replace(/\s+\S*$/, '')}…`
  }
  for (const l of linhas) {
    y += alturaLinha
    ctx.fillText(l, x, y)
  }
  return y
}

function tracejado(ctx: CanvasRenderingContext2D, y: number): number {
  ctx.save()
  ctx.lineWidth = 2
  ctx.setLineDash([6, 4])
  ctx.beginPath()
  ctx.moveTo(M, y)
  ctx.lineTo(LARGURA_TERMICA - M, y)
  ctx.stroke()
  ctx.restore()
  return y + 10
}

/** Linha "rótulo ........ valor", com o valor alinhado à direita. */
function linhaPar(
  ctx: CanvasRenderingContext2D,
  rotulo: string,
  valor: string,
  y: number,
  tamanho = 20,
): number {
  y += tamanho + 4
  ctx.font = `bold ${tamanho}px ${FONTE}`
  ctx.textAlign = 'left'
  ctx.fillText(rotulo, M, y)
  ctx.textAlign = 'right'
  ctx.fillText(valor, LARGURA_TERMICA - M, y)
  return y
}

export function desenharComprovanteTermico(
  dados: DadosComprovante,
  config: ChurchSettings,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = LARGURA_TERMICA
  canvas.height = 3200 // folga; recortado no fim
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000'
  ctx.strokeStyle = '#000'
  ctx.textBaseline = 'alphabetic'

  const C = LARGURA_TERMICA / 2
  let y = 6

  // Cancelado: aviso no topo, impossível de passar despercebido.
  if (dados.cancelado) {
    ctx.fillRect(M, y, LC, 40)
    ctx.fillStyle = '#fff'
    ctx.font = `bold 21px ${FONTE}`
    ctx.textAlign = 'center'
    ctx.fillText('COMPROVANTE CANCELADO', C, y + 29)
    ctx.fillStyle = '#000'
    y += 48
    if (dados.motivoCancelamento) {
      ctx.font = `bold 16px ${FONTE}`
      y = paragrafo(ctx, `Motivo: ${dados.motivoCancelamento}`, C, y, LC, 20, 'center', 3)
      y += 4
    }
  }

  // Cabeçalho
  ctx.font = `bold 19px ${FONTE}`
  y = paragrafo(ctx, config.nome_igreja, C, y, LC, 23, 'center', 3)
  ctx.font = `bold 24px ${FONTE}`
  y = paragrafo(ctx, config.congregacao, C, y + 2, LC, 28, 'center', 2)
  ctx.font = `bold 16px ${FONTE}`
  y = paragrafo(ctx, `Cód. ${config.codigo}`, C, y, LC, 20, 'center')
  y += 6
  y = tracejado(ctx, y)

  ctx.font = `bold 21px ${FONTE}`
  y = paragrafo(ctx, 'COMPROVANTE DE ENTREGA DE DÍZIMOS E OFERTAS', C, y, LC, 25, 'center')
  y += 6

  // Identificação
  ctx.font = `bold 15px ${FONTE}`
  y = paragrafo(ctx, 'COMPROVANTE Nº', C, y, LC, 18, 'center')
  ctx.font = `bold 27px ${FONTE}`
  y = paragrafo(ctx, dados.numero, C, y + 2, LC, 30, 'center')
  y += 4
  y = linhaPar(ctx, 'Data:', `${formatarDataISO(dados.dataRecebimento)} ${formatarHora(dados.horaRecebimento)}`, y, 19)
  y = linhaPar(ctx, 'Competência:', dados.competencia, y, 19)
  y += 8
  y = tracejado(ctx, y)

  // Quem entregou
  ctx.font = `bold 15px ${FONTE}`
  y = paragrafo(ctx, 'RECEBEMOS DE', M, y, LC, 18)
  ctx.font = `bold 25px ${FONTE}`
  y = paragrafo(ctx, dados.nome, M, y + 2, LC, 29, 'left', 3)
  y += 8
  y = tracejado(ctx, y)

  // Itens
  for (const item of dados.itens) {
    const sub = item.subcategoria?.trim() || ''
    const tipo = rotuloTipo(item.tipo)
    const rotulo = !sub ? tipo : sub.toLowerCase().startsWith(tipo.toLowerCase()) ? sub : `${tipo} - ${sub}`
    const valor = formatMoney(item.valor)
    ctx.font = `bold 20px ${FONTE}`
    const larguraValor = ctx.measureText(valor).width + 10
    const linhas = quebrar(ctx, rotulo, LC - larguraValor)
    ctx.textAlign = 'right'
    ctx.fillText(valor, LARGURA_TERMICA - M, y + 24)
    ctx.textAlign = 'left'
    for (const l of linhas) {
      y += 24
      ctx.fillText(l, M, y)
    }
    y += 4
  }
  y += 4

  // Total
  ctx.fillRect(M, y, LC, 3)
  y += 6
  y = linhaPar(ctx, 'TOTAL', formatMoney(dados.total), y, 30)
  y += 8
  ctx.fillRect(M, y, LC, 3)
  y += 6
  ctx.font = `italic bold 16px ${FONTE}`
  y = paragrafo(ctx, `(${valorPorExtenso(dados.total)})`, C, y, LC, 20, 'center')
  y += 8

  // Forma de recebimento e observação
  ctx.font = `bold 15px ${FONTE}`
  y = paragrafo(ctx, 'FORMA DE RECEBIMENTO', M, y, LC, 18)
  ctx.font = `bold 21px ${FONTE}`
  y = paragrafo(ctx, dados.forma, M, y + 1, LC, 25)
  if (dados.observacao?.trim()) {
    y += 4
    ctx.font = `bold 15px ${FONTE}`
    y = paragrafo(ctx, 'OBSERVAÇÃO', M, y, LC, 18)
    ctx.font = `bold 17px ${FONTE}`
    y = paragrafo(ctx, dados.observacao.trim(), M, y + 1, LC, 21, 'left', 4)
  }
  y += 10
  y = tracejado(ctx, y)

  // Versículo
  ctx.font = `italic bold 18px ${FONTE}`
  y = paragrafo(ctx, `“${config.versiculo_rodape}”`, C, y, LC, 22, 'center', 3)
  ctx.font = `bold 16px ${FONTE}`
  y = paragrafo(ctx, config.versiculo_ref, C, y + 1, LC, 20, 'center')
  y += 6
  ctx.font = `bold 13px ${FONTE}`
  y = paragrafo(ctx, config.aviso_rodape, C, y, LC, 16, 'center', 3)
  y += 8
  y = tracejado(ctx, y)

  // Assinaturas (identificação, sem linha de assinatura: comprovante digital)
  const t2 = (config.tesoureiro_2 ?? '').trim()
  const blocos: [string, string][] = t2
    ? [
        ['1º TESOUREIRO', config.tesoureiro],
        ['2º TESOUREIRO', t2],
        ['PASTOR DIRIGENTE', config.dirigente],
      ]
    : [
        ['TESOUREIRO', config.tesoureiro],
        ['PASTOR DIRIGENTE', config.dirigente],
      ]
  blocos.forEach(([rotulo, nome], i) => {
    if (i > 0) y += 6
    ctx.font = `bold 14px ${FONTE}`
    y = paragrafo(ctx, rotulo, M, y, LC, 17)
    ctx.font = `bold 20px ${FONTE}`
    y = paragrafo(ctx, nome, M, y + 1, LC, 24, 'left', 2)
  })

  // Espaço para o destaque do papel
  const alturaFinal = Math.min(canvas.height, Math.ceil(y + 56))

  const saida = document.createElement('canvas')
  saida.width = LARGURA_TERMICA
  saida.height = alturaFinal
  const s = saida.getContext('2d', { willReadFrequently: true })!
  s.drawImage(canvas, 0, 0)
  paraPretoEBranco(saida)
  return saida
}

/** Térmica só imprime preto ou branco: qualquer cinza vira um ou outro. */
export function paraPretoEBranco(canvas: HTMLCanvasElement, limiar = 170): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!
    const v = lum < limiar ? 0 : 255
    d[i] = d[i + 1] = d[i + 2] = v
    d[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
}
