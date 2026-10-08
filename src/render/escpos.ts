/**
 * ESC/POS: a "língua" que a quase totalidade das impressoras térmicas de 58 mm entende.
 * Enviamos o comprovante como imagem (raster), assim acentos e o layout saem
 * idênticos em qualquer modelo, sem depender da tabela de caracteres da impressora.
 */

/** Converte o canvas (já em preto e branco) em bits: 1 = ponto preto, 8 pontos por byte. */
export function canvasParaRaster(canvas: HTMLCanvasElement): {
  bytes: Uint8Array
  larguraBytes: number
  altura: number
} {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const { width, height } = canvas
  const dados = ctx.getImageData(0, 0, width, height).data
  const larguraBytes = Math.ceil(width / 8)
  const bytes = new Uint8Array(larguraBytes * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (dados[i]! < 128) {
        bytes[y * larguraBytes + (x >> 3)]! |= 0x80 >> (x & 7)
      }
    }
  }
  return { bytes, larguraBytes, altura: height }
}

/**
 * Monta o comando completo: inicializa, imprime a imagem em faixas de 128 linhas
 * (impressoras baratas travam com faixas muito altas) e avança o papel.
 */
export function montarEscPos(canvas: HTMLCanvasElement, avancoLinhas = 3): Uint8Array {
  const { bytes, larguraBytes, altura } = canvasParaRaster(canvas)
  const FAIXA = 128
  const partes: number[][] = []
  partes.push([0x1b, 0x40]) // ESC @ — reinicia
  for (let y0 = 0; y0 < altura; y0 += FAIXA) {
    const h = Math.min(FAIXA, altura - y0)
    // GS v 0 m xL xH yL yH d1...dk
    partes.push([0x1d, 0x76, 0x30, 0x00, larguraBytes & 0xff, larguraBytes >> 8, h & 0xff, h >> 8])
    partes.push(Array.from(bytes.subarray(y0 * larguraBytes, (y0 + h) * larguraBytes)))
  }
  partes.push([0x1b, 0x64, avancoLinhas]) // ESC d n — avança n linhas
  const total = partes.reduce((s, p) => s + p.length, 0)
  const saida = new Uint8Array(total)
  let pos = 0
  for (const p of partes) {
    saida.set(p, pos)
    pos += p.length
  }
  return saida
}

export function paraBase64(bytes: Uint8Array): string {
  let bin = ''
  const bloco = 0x8000
  for (let i = 0; i < bytes.length; i += bloco) {
    bin += String.fromCharCode(...bytes.subarray(i, i + bloco))
  }
  return btoa(bin)
}

/** Link que entrega os bytes ao app RawBT (Android), que fala com a impressora Bluetooth. */
export function linkRawBT(bytes: Uint8Array): string {
  return `intent:base64,${paraBase64(bytes)}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`
}
