/**
 * Renderizador único do comprovante.
 *
 * A mesma função desenha a pré-visualização na tela, o PNG do WhatsApp e a
 * imagem embutida no PDF. Um só renderizador significa que o que o tesoureiro
 * confere na tela é exatamente o que o ofertante recebe — não existe a
 * possibilidade de a tela e o arquivo divergirem.
 *
 * Tudo em canvas, sem html-to-image: não depende de carregamento de fonte web
 * nem de CORS, e não corre o risco de o navegador "sujar" o canvas e bloquear
 * a exportação.
 */
import { formatMoney } from '@/lib/money'
import { valorPorExtenso } from '@/lib/extenso'
import { formatarDataISO, formatarHora, competenciaPorExtenso } from '@/lib/dates'
import { rotuloTipo } from '@/domain/catalog'
import type { ChurchSettings, ItemRascunho, ReceiptItem } from '@/domain/types'

/** Proporção 4:5 — o formato que o WhatsApp mostra sem recortar. */
export const LARGURA_BASE = 1080
export const ALTURA_BASE = 1350

const FONTE = '"Helvetica Neue", Helvetica, Arial, sans-serif'

export interface DadosComprovante {
  numero: string
  nome: string
  naoIdentificado: boolean
  dataRecebimento: string
  horaRecebimento: string
  competencia: string
  forma: string
  observacao: string | null
  itens: ReadonlyArray<ReceiptItem | ItemRascunho>
  total: number
  cancelado?: boolean
  motivoCancelamento?: string | null
  emitidoEm?: string
}

interface Cores {
  primaria: string
  secundaria: string
  destaque: string
  texto: string
}

function cores(s: ChurchSettings): Cores {
  const c = s.cores_do_layout ?? {}
  return {
    primaria: c.primaria || '#0f2a4a',
    secundaria: c.secundaria || '#ffffff',
    destaque: c.destaque || '#bd9336',
    texto: c.texto || '#13202e',
  }
}

/** Desenha texto quebrando em linhas e devolve o Y final. */
function textoMultilinha(
  ctx: CanvasRenderingContext2D,
  texto: string,
  x: number,
  y: number,
  larguraMax: number,
  alturaLinha: number,
  maxLinhas = 99,
): number {
  const palavras = texto.split(/\s+/).filter(Boolean)
  const linhas: string[] = []
  let atual = ''
  for (const p of palavras) {
    const teste = atual ? `${atual} ${p}` : p
    if (ctx.measureText(teste).width <= larguraMax || !atual) atual = teste
    else {
      linhas.push(atual)
      atual = p
    }
  }
  if (atual) linhas.push(atual)

  const visiveis = linhas.slice(0, maxLinhas)
  if (linhas.length > maxLinhas && visiveis.length > 0) {
    let ultima = visiveis[visiveis.length - 1]!
    while (ctx.measureText(`${ultima}…`).width > larguraMax && ultima.length > 1) {
      ultima = ultima.slice(0, -1)
    }
    visiveis[visiveis.length - 1] = `${ultima}…`
  }

  let cursor = y
  for (const linha of visiveis) {
    ctx.fillText(linha, x, cursor)
    cursor += alturaLinha
  }
  return cursor
}

/** Reduz a fonte até o texto caber em uma linha (para nomes longos). */
function ajustarFonte(
  ctx: CanvasRenderingContext2D,
  texto: string,
  larguraMax: number,
  tamanhoInicial: number,
  peso: string,
  minimo = 22,
): number {
  let tamanho = tamanhoInicial
  ctx.font = `${peso} ${tamanho}px ${FONTE}`
  while (ctx.measureText(texto).width > larguraMax && tamanho > minimo) {
    tamanho -= 2
    ctx.font = `${peso} ${tamanho}px ${FONTE}`
  }
  return tamanho
}

function retanguloArredondado(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * Desenha o comprovante no canvas recebido.
 * `escala` 1 => 1080x1350 (WhatsApp). 2 => 2160x2700 (dentro do PDF).
 */
export function desenharComprovante(
  canvas: HTMLCanvasElement,
  dados: DadosComprovante,
  config: ChurchSettings,
  logo: HTMLImageElement | null,
  escala = 1,
): void {
  const L = LARGURA_BASE
  const A = ALTURA_BASE
  canvas.width = Math.round(L * escala)
  canvas.height = Math.round(A * escala)

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível preparar a imagem do comprovante.')
  ctx.setTransform(escala, 0, 0, escala, 0, 0)
  ctx.textBaseline = 'alphabetic'

  const c = cores(config)
  const M = 64 // margem lateral
  const LC = L - M * 2 // largura de conteúdo

  // ----- fundo -----
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, L, A)

  // ----- cabeçalho -----
  const alturaCabecalho = 250
  ctx.fillStyle = c.primaria
  ctx.fillRect(0, 0, L, alturaCabecalho)
  ctx.fillStyle = c.destaque
  ctx.fillRect(0, alturaCabecalho, L, 6)

  // logo (ou monograma, quando a igreja ainda não enviou o arquivo)
  const logoCaixa = 118
  const logoX = M
  const logoY = 44
  if (logo && logo.complete && logo.naturalWidth > 0) {
    const prop = Math.min(logoCaixa / logo.naturalWidth, logoCaixa / logo.naturalHeight)
    const w = logo.naturalWidth * prop
    const h = logo.naturalHeight * prop
    ctx.save()
    retanguloArredondado(ctx, logoX, logoY, logoCaixa, logoCaixa, 16)
    ctx.fillStyle = 'rgba(255,255,255,0.96)'
    ctx.fill()
    ctx.clip()
    ctx.drawImage(logo, logoX + (logoCaixa - w) / 2, logoY + (logoCaixa - h) / 2, w, h)
    ctx.restore()
  } else {
    ctx.save()
    retanguloArredondado(ctx, logoX, logoY, logoCaixa, logoCaixa, 16)
    ctx.strokeStyle = c.destaque
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.fillStyle = c.destaque
    ctx.font = `700 54px ${FONTE}`
    ctx.textAlign = 'center'
    ctx.fillText('AD', logoX + logoCaixa / 2, logoY + logoCaixa / 2 + 19)
    ctx.restore()
  }

  // nome da igreja
  const txtX = logoX + logoCaixa + 28
  const txtL = L - txtX - M
  ctx.textAlign = 'left'
  ctx.fillStyle = c.secundaria
  const tamIgreja = ajustarFonte(ctx, config.nome_igreja, txtL, 33, '700', 24)
  let y = logoY + 36
  y = textoMultilinha(ctx, config.nome_igreja, txtX, y, txtL, tamIgreja + 8, 2)

  ctx.fillStyle = c.destaque
  ctx.font = `600 25px ${FONTE}`
  y = textoMultilinha(ctx, config.congregacao, txtX, y + 8, txtL, 30, 1)

  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.font = `400 21px ${FONTE}`
  textoMultilinha(ctx, `Código ${config.codigo}`, txtX, y + 4, txtL, 26, 1)

  // ----- título -----
  y = alturaCabecalho + 6 + 56
  ctx.fillStyle = c.texto
  ctx.textAlign = 'center'
  ctx.font = `700 34px ${FONTE}`
  ctx.fillText('COMPROVANTE DE ENTREGA', L / 2, y)
  ctx.fillText('DE DÍZIMOS E OFERTAS', L / 2, y + 40)
  y += 40

  // ----- faixa: número / data / competência -----
  y += 40
  const alturaFaixa = 90
  ctx.fillStyle = '#f1f5f9'
  retanguloArredondado(ctx, M, y, LC, alturaFaixa, 14)
  ctx.fill()

  const colunas: Array<[string, string]> = [
    ['Comprovante nº', dados.numero],
    ['Data e hora', `${formatarDataISO(dados.dataRecebimento)} · ${formatarHora(dados.horaRecebimento)}`],
    ['Competência', dados.competencia],
  ]
  const larguraCol = LC / 3
  colunas.forEach(([rotulo, valor], i) => {
    const cx = M + larguraCol * i + larguraCol / 2
    ctx.textAlign = 'center'
    ctx.fillStyle = '#64748b'
    ctx.font = `600 18px ${FONTE}`
    ctx.fillText(rotulo.toUpperCase(), cx, y + 34)
    ctx.fillStyle = c.texto
    const t = ajustarFonte(ctx, valor, larguraCol - 24, 25, '700', 15)
    ctx.font = `700 ${t}px ${FONTE}`
    ctx.fillText(valor, cx, y + 66)
    if (i < 2) {
      ctx.strokeStyle = '#cbd5e1'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(M + larguraCol * (i + 1), y + 22)
      ctx.lineTo(M + larguraCol * (i + 1), y + alturaFaixa - 22)
      ctx.stroke()
    }
  })
  y += alturaFaixa

  // ----- nome -----
  // A partir daqui o espaço é calculado: a tabela, o total, a observação e o
  // motivo do cancelamento têm de caber ANTES do rodapé fixo. Com muitos itens
  // as alturas encolhem dentro de limites legíveis, em vez de invadir o rodapé.
  y += 24
  ctx.textAlign = 'left'
  ctx.fillStyle = '#64748b'
  ctx.font = `600 19px ${FONTE}`
  ctx.fillText('RECEBEMOS DE', M, y)
  y += 14

  ctx.fillStyle = dados.naoIdentificado ? '#64748b' : c.primaria
  const tamNome = ajustarFonte(ctx, dados.nome, LC, 42, '700', 26)
  y = textoMultilinha(ctx, dados.nome, M, y + tamNome, LC, tamNome + 6, 2)
  if (dados.naoIdentificado) {
    ctx.fillStyle = '#94a3b8'
    ctx.font = `400 19px ${FONTE}`
    ctx.fillText('Ofertante que não quis se identificar', M, y + 4)
    y += 24
  }

  // ----- medição: o conteúdo tem de caber antes do rodapé -----
  // Em vez de deixar a tabela invadir o rodapé quando o comprovante tem muitos
  // itens, o layout vai cedendo em etapas — primeiro o que custa menos leitura.
  const obs = dados.observacao?.trim() || ''
  const motivo = dados.cancelado ? dados.motivoCancelamento?.trim() || '' : ''

  const H_CABECALHO_TABELA = 48
  const FOLGA = 12

  const topoTabela = y + 20
  let maxItens = dados.itens.length
  let rowH = 62
  let hTotal = 92
  let hForma = 64
  let linhasExtenso = 2
  let linhasObs = 2
  let linhasMotivo = 2
  let rodapeCompacto = false

  const qtdLinhas = () => Math.min(maxItens, dados.itens.length) + (dados.itens.length > maxItens ? 1 : 0)
  const hExtenso = () => 28 + linhasExtenso * 24
  const hObs = () => (obs ? 24 + linhasObs * 25 + 12 : 0)
  const hMotivo = () => (motivo ? linhasMotivo * 24 + 14 : 0)
  const hRodape = () => (rodapeCompacto ? 196 : 236)
  const precisa = () =>
    H_CABECALHO_TABELA + qtdLinhas() * rowH + hTotal + hExtenso() + hForma + hObs() + hMotivo()
  const cabe = () => A - hRodape() - topoTabela - FOLGA

  // Ordem de concessão: altura das linhas até 52 → extenso em uma linha →
  // rodapé compacto → linhas até 44 → observação e motivo em uma linha →
  // por último, agrupar os itens excedentes numa linha de resumo.
  // Ordem de concessão: o que custa menos leitura sai primeiro. Agrupar itens
  // é o último recurso, porque o comprovante deve discriminar os valores.
  const concessoes: Array<() => boolean> = [
    () => (rowH > 52 ? ((rowH -= 2), true) : false),
    () => (linhasExtenso > 1 ? ((linhasExtenso = 1), true) : false),
    () => (!rodapeCompacto ? ((rodapeCompacto = true), true) : false),
    () => (hTotal > 80 ? ((hTotal -= 4), true) : false),
    () => (hForma > 54 ? ((hForma -= 2), true) : false),
    () => (rowH > 44 ? ((rowH -= 2), true) : false),
    () => (linhasObs > 1 ? ((linhasObs = 1), true) : false),
    () => (linhasMotivo > 1 ? ((linhasMotivo = 1), true) : false),
    () => (rowH > 40 ? ((rowH -= 2), true) : false),
    () => (maxItens > 3 ? ((maxItens -= 1), true) : false),
  ]
  let guarda = 0
  while (precisa() > cabe() && guarda++ < 200) {
    let cedeu = false
    for (const c of concessoes) {
      if (c()) {
        cedeu = true
        break
      }
    }
    if (!cedeu) break
  }

  // Sobrando espaço (o caso comum: um ou dois itens), o layout se abre em vez
  // de deixar um vazio no meio do comprovante.
  const expansoes: Array<() => boolean> = [
    () => (rowH < 76 ? ((rowH += 2), true) : false),
    () => (hTotal < 106 ? ((hTotal += 2), true) : false),
    () => (hForma < 76 ? ((hForma += 2), true) : false),
  ]
  guarda = 0
  while (precisa() < cabe() && guarda++ < 200) {
    let cresceu = false
    for (const e of expansoes) {
      if (e() && precisa() <= cabe()) {
        cresceu = true
        break
      }
      if (precisa() > cabe()) break
    }
    if (!cresceu) break
  }
  // O que ainda sobrar vira respiro acima da tabela, até um limite.
  const respiro = Math.max(0, Math.min(56, cabe() - precisa()))

  const rodapeY = A - hRodape()
  const itensVisiveis = dados.itens.slice(0, maxItens)
  const excedentes = dados.itens.length - itensVisiveis.length
  const compacto = rowH < 54

  // ----- tabela de valores -----
  y = topoTabela + respiro
  ctx.fillStyle = c.primaria
  retanguloArredondado(ctx, M, y, LC, H_CABECALHO_TABELA, 10)
  ctx.fill()
  ctx.fillStyle = c.secundaria
  ctx.font = `700 20px ${FONTE}`
  ctx.textAlign = 'left'
  ctx.fillText('DESCRIÇÃO', M + 24, y + 32)
  ctx.textAlign = 'right'
  ctx.fillText('VALOR', M + LC - 24, y + 32)
  y += H_CABECALHO_TABELA

  for (const item of itensVisiveis) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(M, y, LC, rowH)
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(M, y + rowH)
    ctx.lineTo(M + LC, y + rowH)
    ctx.stroke()

    const sub = item.subcategoria?.trim() || ''
    const meio = y + rowH / 2
    ctx.textAlign = 'left'
    ctx.fillStyle = c.texto

    if (!sub) {
      ctx.font = `600 ${compacto ? 23 : 25}px ${FONTE}`
      ctx.fillText(rotuloTipo(item.tipo), M + 24, meio + 9)
    } else if (compacto) {
      // Linha estreita: tipo e subcategoria na mesma linha.
      ctx.font = `600 22px ${FONTE}`
      const rotulo = rotuloTipo(item.tipo)
      ctx.fillText(rotulo, M + 24, meio + 8)
      const larguraRotulo = ctx.measureText(`${rotulo} `).width
      ctx.fillStyle = '#64748b'
      ctx.font = `400 19px ${FONTE}`
      textoMultilinha(ctx, `· ${sub}`, M + 24 + larguraRotulo, meio + 8, LC - 300 - larguraRotulo, 20, 1)
    } else {
      ctx.font = `600 25px ${FONTE}`
      ctx.fillText(rotuloTipo(item.tipo), M + 24, meio - 2)
      ctx.fillStyle = '#64748b'
      ctx.font = `400 19px ${FONTE}`
      textoMultilinha(ctx, sub, M + 24, meio + 22, LC - 300, 22, 1)
    }

    ctx.textAlign = 'right'
    ctx.fillStyle = c.texto
    ctx.font = `700 ${compacto ? 25 : 27}px ${FONTE}`
    ctx.fillText(formatMoney(item.valor), M + LC - 24, meio + 9)
    y += rowH
  }

  if (excedentes > 0) {
    const resto = dados.itens.slice(maxItens).reduce((soma, i) => soma + i.valor, 0)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(M, y, LC, rowH)
    ctx.strokeStyle = '#e2e8f0'
    ctx.beginPath()
    ctx.moveTo(M, y + rowH)
    ctx.lineTo(M + LC, y + rowH)
    ctx.stroke()
    ctx.textAlign = 'left'
    ctx.fillStyle = '#64748b'
    ctx.font = `600 ${compacto ? 21 : 23}px ${FONTE}`
    ctx.fillText(
      `+ ${excedentes} ${excedentes === 1 ? 'outro lançamento' : 'outros lançamentos'}`,
      M + 24,
      y + rowH / 2 + 8,
    )
    ctx.textAlign = 'right'
    ctx.fillStyle = c.texto
    ctx.font = `700 ${compacto ? 25 : 27}px ${FONTE}`
    ctx.fillText(formatMoney(resto), M + LC - 24, y + rowH / 2 + 8)
    y += rowH
  }

  // ----- total -----
  ctx.fillStyle = '#f8fafc'
  retanguloArredondado(ctx, M, y, LC, hTotal, 10)
  ctx.fill()
  ctx.fillStyle = c.destaque
  ctx.fillRect(M, y, 7, hTotal)
  ctx.textAlign = 'left'
  ctx.fillStyle = c.texto
  ctx.font = `700 27px ${FONTE}`
  ctx.fillText('TOTAL GERAL', M + 28, y + hTotal / 2 + 10)
  ctx.textAlign = 'right'
  ctx.fillStyle = c.primaria
  const tamTotal = ajustarFonte(ctx, formatMoney(dados.total), LC * 0.52, 44, '800', 28)
  ctx.font = `800 ${tamTotal}px ${FONTE}`
  ctx.fillText(formatMoney(dados.total), M + LC - 28, y + hTotal / 2 + 14)
  y += hTotal

  // valor por extenso
  ctx.textAlign = 'left'
  ctx.fillStyle = '#64748b'
  ctx.font = `italic 400 20px ${FONTE}`
  textoMultilinha(ctx, `(${valorPorExtenso(dados.total)})`, M, y + 28, LC, 24, linhasExtenso)
  y += hExtenso()

  // ----- forma de recebimento -----
  ctx.fillStyle = '#64748b'
  ctx.font = `600 18px ${FONTE}`
  ctx.fillText('FORMA DE RECEBIMENTO', M, y + 18)
  ctx.fillStyle = c.texto
  ctx.font = `600 24px ${FONTE}`
  ctx.fillText(dados.forma, M, y + 48)
  y += hForma

  // ----- observação -----
  if (obs) {
    ctx.fillStyle = '#64748b'
    ctx.font = `600 18px ${FONTE}`
    ctx.fillText('OBSERVAÇÃO', M, y + 18)
    ctx.fillStyle = c.texto
    ctx.font = `400 21px ${FONTE}`
    textoMultilinha(ctx, obs, M, y + 46, LC, 25, linhasObs)
    y += hObs()
  }

  // ----- motivo do cancelamento -----
  if (motivo) {
    ctx.fillStyle = '#b91c1c'
    ctx.font = `600 19px ${FONTE}`
    textoMultilinha(ctx, `Comprovante cancelado: ${motivo}`, M, y + 20, LC, 24, linhasMotivo)
  }

  // ----- rodapé -----
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(M, rodapeY)
  ctx.lineTo(L - M, rodapeY)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.fillStyle = c.primaria
  ctx.font = `italic 600 ${rodapeCompacto ? 24 : 26}px ${FONTE}`
  ctx.fillText(`“${config.versiculo_rodape}”`, L / 2, rodapeY + (rodapeCompacto ? 38 : 44))
  ctx.fillStyle = c.destaque
  ctx.font = `600 ${rodapeCompacto ? 18 : 20}px ${FONTE}`
  ctx.fillText(config.versiculo_ref, L / 2, rodapeY + (rodapeCompacto ? 66 : 76))

  // O aviso fica centralizado: textoMultilinha respeita o textAlign vigente,
  // então o x precisa ser o centro, não a margem.
  ctx.fillStyle = '#94a3b8'
  ctx.font = `400 17px ${FONTE}`
  ctx.textAlign = 'center'
  textoMultilinha(
    ctx,
    config.aviso_rodape,
    L / 2,
    rodapeY + (rodapeCompacto ? 96 : 110),
    LC - 80,
    21,
    rodapeCompacto ? 1 : 2,
  )

  // identificação da tesouraria
  const faixaY = A - 86
  ctx.fillStyle = c.primaria
  ctx.fillRect(0, faixaY, L, 86)
  const t2 = (config.tesoureiro_2 ?? '').trim()
  // Três assinaturas (1º tesoureiro, 2º tesoureiro, dirigente). Sem 2º tesoureiro,
  // volta ao desenho de duas assinaturas.
  const assinaturas: { rotulo: string; nome: string; x: number; alinha: CanvasTextAlign; larg: number }[] = t2
    ? [
        { rotulo: '1º TESOUREIRO', nome: config.tesoureiro, x: M, alinha: 'left', larg: LC * 0.31 },
        { rotulo: '2º TESOUREIRO', nome: t2, x: L / 2, alinha: 'center', larg: LC * 0.31 },
        { rotulo: 'PASTOR DIRIGENTE', nome: config.dirigente, x: L - M, alinha: 'right', larg: LC * 0.33 },
      ]
    : [
        { rotulo: 'TESOUREIRO', nome: config.tesoureiro, x: M, alinha: 'left', larg: LC * 0.5 },
        { rotulo: 'PASTOR DIRIGENTE', nome: config.dirigente, x: L - M, alinha: 'right', larg: LC * 0.45 },
      ]
  for (const col of assinaturas) {
    ctx.textAlign = col.alinha
    ctx.fillStyle = 'rgba(255,255,255,0.65)'
    ctx.font = `600 15px ${FONTE}`
    ctx.fillText(col.rotulo, col.x, faixaY + 32)
    ctx.fillStyle = c.secundaria
    const tam = ajustarFonte(ctx, col.nome, col.larg, 22, '600', 14)
    ctx.font = `600 ${tam}px ${FONTE}`
    ctx.fillText(col.nome, col.x, faixaY + 60)
  }

  // Selo de cancelado por último, para atravessar o documento inteiro e não
  // ser coberto pelas faixas brancas da tabela.
  if (dados.cancelado) {
    ctx.save()
    ctx.translate(L / 2, A / 2)
    ctx.rotate(-Math.PI / 9)
    ctx.globalAlpha = 0.13
    ctx.fillStyle = '#b91c1c'
    ctx.font = `800 148px ${FONTE}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('CANCELADO', 0, 0)
    ctx.restore()
  }
}

/** Nome de arquivo previsível e sem acento, para o WhatsApp não reclamar. */
export function nomeArquivo(dados: DadosComprovante, extensao: 'pdf' | 'png'): string {
  const nome = dados.nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `comprovante-${dados.numero}-${nome || 'sem-nome'}.${extensao}`
}

/** Texto do comprovante por extenso, usado no título do arquivo e no alt. */
export function descricaoComprovante(dados: DadosComprovante): string {
  return `Comprovante ${dados.numero} — ${dados.nome} — competência ${competenciaPorExtenso(
    dados.competencia,
  )} — ${formatMoney(dados.total)}`
}
