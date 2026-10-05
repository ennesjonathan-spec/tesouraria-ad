/**
 * Compartilhamento pelo menu nativo do celular, com alternativa de download.
 *
 * O app nunca dispara mensagem sozinho: abre o WhatsApp com o destinatário
 * e o texto prontos, e o envio depende do toque do usuário.
 */
import { formatMoney } from '@/lib/money'
import { telefoneParaWhatsApp } from '@/lib/normalize'
import { baixarBlob, type ArquivosComprovante } from './exportar'
import type { DadosComprovante } from './receiptCanvas'

export function mensagemWhatsApp(dados: DadosComprovante): string {
  const nome = dados.naoIdentificado ? '' : dados.nome.split(' ')[0] || ''
  const saudacao = nome ? `Olá, ${nome}.` : 'Olá.'
  return (
    `${saudacao} Segue o comprovante de entrega referente à competência ` +
    `${dados.competencia}, no valor total de ${formatMoney(dados.total)}. Deus abençoe!`
  )
}

export function podeCompartilharArquivo(arquivos: ArquivosComprovante): boolean {
  if (typeof navigator === 'undefined' || !navigator.share) return false
  const teste = new File([arquivos.png], arquivos.nomePng, { type: 'image/png' })
  return typeof navigator.canShare === 'function'
    ? navigator.canShare({ files: [teste] })
    : false
}

export type ResultadoCompartilhar = 'compartilhado' | 'cancelado' | 'baixado'

/**
 * Abre o menu nativo com a imagem e o PDF. Se o aparelho não souber
 * compartilhar arquivos (desktop, navegador antigo), baixa os dois.
 */
export async function compartilharComprovante(
  arquivos: ArquivosComprovante,
  dados: DadosComprovante,
  incluirPdf = true,
): Promise<ResultadoCompartilhar> {
  const texto = mensagemWhatsApp(dados)
  const files: File[] = [
    new File([arquivos.png], arquivos.nomePng, { type: 'image/png' }),
  ]
  if (incluirPdf) {
    files.push(new File([arquivos.pdf], arquivos.nomePdf, { type: 'application/pdf' }))
  }

  const podeTudo =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files })

  // Alguns aparelhos aceitam uma imagem, mas não imagem + PDF juntos.
  const podeSoImagem =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [files[0]!] })

  const escolhidos = podeTudo ? files : podeSoImagem ? [files[0]!] : null

  if (escolhidos) {
    try {
      await navigator.share({
        files: escolhidos,
        title: `Comprovante ${dados.numero}`,
        text: texto,
      })
      return 'compartilhado'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelado'
      // Qualquer outra falha cai no download, para o usuário não ficar sem o arquivo.
    }
  }

  baixarBlob(arquivos.png, arquivos.nomePng)
  if (incluirPdf) baixarBlob(arquivos.pdf, arquivos.nomePdf)
  return 'baixado'
}

/**
 * Celular: abre o menu nativo só com a imagem (e o texto), para o usuário
 * escolher o WhatsApp e a conversa. A imagem já vai anexada.
 * Retorna 'indisponivel' quando o aparelho não compartilha arquivos
 * (computador): nesse caso a tela usa copiarImagem + link do WhatsApp.
 */
export async function compartilharImagemWhatsApp(
  arquivos: ArquivosComprovante,
  dados: DadosComprovante,
): Promise<'compartilhado' | 'cancelado' | 'indisponivel'> {
  if (!podeCompartilharArquivo(arquivos)) return 'indisponivel'
  const arquivo = new File([arquivos.png], arquivos.nomePng, { type: 'image/png' })
  try {
    await navigator.share({
      files: [arquivo],
      title: `Comprovante ${dados.numero}`,
      text: mensagemWhatsApp(dados),
    })
    return 'compartilhado'
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelado'
    return 'indisponivel'
  }
}

/** Copia a imagem para a área de transferência (para colar com Ctrl+V no WhatsApp Web). */
export async function copiarImagem(png: Blob): Promise<boolean> {
  try {
    if (
      typeof navigator === 'undefined' ||
      !navigator.clipboard ||
      typeof ClipboardItem === 'undefined'
    ) {
      return false
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
    return true
  } catch {
    return false
  }
}

/**
 * Monta o link do WhatsApp. Com telefone, abre a conversa daquela pessoa;
 * sem telefone, abre o seletor de contatos. O arquivo precisa ser anexado
 * pelo usuário (o WhatsApp não aceita anexo por link) — por isso a tela
 * orienta a usar "Compartilhar" quando quer mandar a imagem.
 */
export function linkWhatsApp(
  dados: DadosComprovante,
  telefone?: string | null,
): string {
  const texto = encodeURIComponent(mensagemWhatsApp(dados))
  const numero = telefoneParaWhatsApp(telefone)
  return numero
    ? `https://wa.me/${numero}?text=${texto}`
    : `https://wa.me/?text=${texto}`
}
