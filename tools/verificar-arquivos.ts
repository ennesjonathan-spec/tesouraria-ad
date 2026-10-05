/**
 * Ferramenta de desenvolvimento: gera de verdade o PNG e o PDF do comprovante
 * e confere a assinatura dos arquivos. Abra com `npm run dev` em
 * /tools/verificar-arquivos.html
 */
import { gerarPngBlob, gerarPdfBlob } from '../src/render/exportar'
import { mensagemWhatsApp } from '../src/render/compartilhar'
import type { DadosComprovante } from '../src/render/receiptCanvas'
import type { ChurchSettings } from '../src/domain/types'

const config: ChurchSettings = {
  id: 1,
  nome_igreja: 'Igreja Evangélica Assembleia de Deus',
  congregacao: 'Congregação Balneário Central',
  codigo: '124',
  endereco: 'Av. Márcio G. da Silva, Qd. B, Lt. 20',
  dirigente: 'Pedro João Alves da Silva Filho',
  tesoureiro: 'Jonathan Ennenes Pereira',
  logo_url: null,
  versiculo_rodape: 'Deus ama quem dá com alegria.',
  versiculo_ref: '2 Coríntios 9:7',
  aviso_rodape: 'Comprovante emitido pela tesouraria para registro e confirmação da entrega.',
  prefixo_comprovante: '124',
  cores_do_layout: { primaria: '#0f2a4a', secundaria: '#ffffff', destaque: '#bd9336', texto: '#13202e' },
  subcategorias_oferta: [],
  formas_recebimento: [],
  updated_at: new Date().toISOString(),
}

const dados: DadosComprovante = {
  numero: '124-2026-000002',
  nome: 'José Carlos de Exemplo',
  naoIdentificado: false,
  dataRecebimento: '2026-10-04',
  horaRecebimento: '19:35',
  competencia: '10/2026',
  forma: 'Dinheiro',
  observacao: null,
  itens: [
    { uid: '1', tipo: 'dizimo', subcategoria: null, valor: 30000, observacao: null },
    { uid: '2', tipo: 'oferta', subcategoria: 'Oferta de culto', valor: 5000, observacao: null },
  ],
  total: 35000,
}

const saida = document.getElementById('saida')!
const linhas: string[] = []
const ok = (c: boolean, m: string) => linhas.push(`${c ? 'OK   ' : 'FALHA'} ${m}`)

async function assinatura(blob: Blob, bytes: number): Promise<number[]> {
  const buf = await blob.slice(0, bytes).arrayBuffer()
  return [...new Uint8Array(buf)]
}

try {
  const png = await gerarPngBlob(dados, config, null)
  const assPng = await assinatura(png, 8)
  ok(png.type === 'image/png', `PNG com tipo correto (${png.type})`)
  ok(
    assPng.join(',') === '137,80,78,71,13,10,26,10',
    'PNG com assinatura de arquivo válida',
  )
  ok(png.size > 20_000, `PNG com tamanho razoável (${Math.round(png.size / 1024)} kB)`)
  ok(png.size < 1_500_000, 'PNG leve o bastante para o WhatsApp')

  // confere as dimensões 1080x1350
  const url = URL.createObjectURL(png)
  const img = new Image()
  await new Promise((r, e) => {
    img.onload = r
    img.onerror = e
    img.src = url
  })
  ok(img.naturalWidth === 1080 && img.naturalHeight === 1350, `PNG em ${img.naturalWidth}x${img.naturalHeight} (vertical para WhatsApp)`)
  URL.revokeObjectURL(url)

  const pdf = await gerarPdfBlob(dados, config, null)
  const assPdf = await assinatura(pdf, 5)
  ok(pdf.type === 'application/pdf', `PDF com tipo correto (${pdf.type})`)
  ok(String.fromCharCode(...assPdf) === '%PDF-', 'PDF com assinatura de arquivo válida')
  ok(pdf.size > 10_000, `PDF gerado (${Math.round(pdf.size / 1024)} kB)`)

  const msg = mensagemWhatsApp(dados)
  ok(msg.includes('José') && msg.includes('10/2026') && msg.includes('350,00'),
     `Mensagem do WhatsApp montada: "${msg}"`)
} catch (e) {
  ok(false, `erro: ${e instanceof Error ? e.message : String(e)}`)
}

saida.textContent = linhas.join('\n')
;(window as unknown as { __resultado: string[] }).__resultado = linhas
