/**
 * Caminhos de impressão do comprovante de 58 mm.
 *  1. RawBT (Android, impressora Bluetooth): abre o app com o comando pronto.
 *  2. Navegador: caixa de impressão do aparelho/computador, com a página em 58 mm.
 *  3. Arquivo PNG de 58 mm, para abrir no aplicativo do fabricante.
 * Nenhum deles imprime sozinho: sempre depende do toque do usuário.
 */
import { LARGURA_TERMICA, desenharComprovanteTermico } from './receiptThermal'
import { linkRawBT, montarEscPos } from './escpos'
import type { DadosComprovante } from './receiptCanvas'
import type { ChurchSettings } from '@/domain/types'

export function ehAndroid(): boolean {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
}

export function abrirNoRawBT(dados: DadosComprovante, config: ChurchSettings): void {
  const canvas = desenharComprovanteTermico(dados, config)
  window.location.href = linkRawBT(montarEscPos(canvas))
}

export async function pngTermico(dados: DadosComprovante, config: ChurchSettings): Promise<Blob> {
  const canvas = desenharComprovanteTermico(dados, config)
  return await new Promise<Blob>((ok, erro) =>
    canvas.toBlob((b) => (b ? ok(b) : erro(new Error('Não foi possível gerar a imagem de 58 mm.'))), 'image/png'),
  )
}

/** Abre a caixa de impressão do navegador com a página já em 58 mm de largura. */
export function imprimirNavegador(dados: DadosComprovante, config: ChurchSettings): void {
  const canvas = desenharComprovanteTermico(dados, config)
  const url = canvas.toDataURL('image/png')
  const proporcao = canvas.height / LARGURA_TERMICA
  const alturaMm = Math.ceil(58 * proporcao)

  const quadro = document.createElement('iframe')
  quadro.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(quadro)
  const doc = quadro.contentDocument!
  doc.open()
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>Comprovante ${dados.numero}</title>` +
      `<style>@page{size:58mm ${alturaMm}mm;margin:0}html,body{margin:0;padding:0;background:#fff}` +
      `img{display:block;width:58mm;height:auto}</style></head>` +
      `<body><img id="c" src="${url}" alt="Comprovante ${dados.numero}"></body></html>`,
  )
  doc.close()
  const imprimir = () => {
    quadro.contentWindow?.focus()
    quadro.contentWindow?.print()
    setTimeout(() => quadro.remove(), 60_000)
  }
  const img = doc.getElementById('c') as HTMLImageElement | null
  if (img && !img.complete) img.onload = imprimir
  else imprimir()
}
