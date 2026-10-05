import { useEffect, useMemo, useRef, useState } from 'react'
import {
  desenharComprovante,
  descricaoComprovante,
  type DadosComprovante,
} from '@/render/receiptCanvas'
import {
  baixarBlob,
  carregarLogo,
  gerarArquivos,
  type ArquivosComprovante,
} from '@/render/exportar'
import {
  compartilharComprovante,
  compartilharImagemWhatsApp,
  copiarImagem,
  linkWhatsApp,
} from '@/render/compartilhar'
import { useSettings } from '@/state/SettingsContext'
import { mensagemErro } from '@/lib/errors'
import { Aviso } from './ui'
import type { Receipt } from '@/domain/types'

export function dadosDoComprovante(r: Receipt): DadosComprovante {
  return {
    numero: r.numero_comprovante,
    nome: r.nome_exibido,
    naoIdentificado: r.nao_identificado,
    dataRecebimento: r.data_recebimento,
    horaRecebimento: r.hora_recebimento,
    competencia: r.competencia,
    forma: r.forma_recebimento,
    observacao: r.observacao,
    itens: r.itens ?? [],
    total: r.total_geral,
    cancelado: r.status === 'cancelado',
    motivoCancelamento: r.motivo_cancelamento,
    emitidoEm: r.created_at,
  }
}

/** Pré-visualização: é o mesmo desenho que vai para o PNG e para o PDF. */
export function PreviaComprovante({ dados }: { dados: DadosComprovante }) {
  const { config } = useSettings()
  const canvas = useRef<HTMLCanvasElement>(null)
  const [logo, setLogo] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    let vivo = true
    void carregarLogo(config.logo_url).then((l) => {
      if (vivo) setLogo(l)
    })
    return () => {
      vivo = false
    }
  }, [config.logo_url])

  useEffect(() => {
    if (canvas.current) desenharComprovante(canvas.current, dados, config, logo, 1)
  }, [dados, config, logo])

  return (
    <canvas
      ref={canvas}
      role="img"
      aria-label={descricaoComprovante(dados)}
      className="h-auto w-full rounded-xl border border-slate-200 shadow-sm"
    />
  )
}

/** Botões de entrega: compartilhar, WhatsApp e download. */
export function AcoesComprovante({
  dados,
  telefone,
  nomeDestinatario,
  aoEmitirOutro,
}: {
  dados: DadosComprovante
  telefone?: string | null
  nomeDestinatario?: string | null
  aoEmitirOutro?: () => void
}) {
  const { config } = useSettings()
  const [arquivos, setArquivos] = useState<ArquivosComprovante | null>(null)
  const [preparando, setPreparando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [recado, setRecado] = useState<string | null>(null)
  const [confirmandoWhats, setConfirmandoWhats] = useState(false)

  const chave = useMemo(() => JSON.stringify(dados), [dados])

  useEffect(() => {
    let vivo = true
    setPreparando(true)
    setErro(null)
    void (async () => {
      try {
        const logo = await carregarLogo(config.logo_url)
        const a = await gerarArquivos(dados, config, logo)
        if (vivo) setArquivos(a)
      } catch (e) {
        if (vivo) setErro(mensagemErro(e))
      } finally {
        if (vivo) setPreparando(false)
      }
    })()
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, config])

  async function compartilhar() {
    if (!arquivos) return
    try {
      const r = await compartilharComprovante(arquivos, dados)
      if (r === 'baixado') {
        setRecado('Seu aparelho não abre o menu de compartilhar: os arquivos foram baixados.')
      } else if (r === 'compartilhado') {
        setRecado(null)
      }
    } catch (e) {
      setErro(mensagemErro(e))
    }
  }

  /** Celular: menu do aparelho com a imagem anexada. Computador: painel com a cópia da imagem. */
  async function enviarWhatsApp() {
    if (!arquivos) return
    setRecado(null)
    try {
      const r = await compartilharImagemWhatsApp(arquivos, dados)
      if (r === 'indisponivel') setConfirmandoWhats(true)
    } catch (e) {
      setErro(mensagemErro(e))
    }
  }

  async function copiarEAbrirWhatsApp() {
    if (!arquivos) return
    const copiou = await copiarImagem(arquivos.png)
    window.open(linkWhatsApp(dados, telefone), '_blank', 'noopener')
    setConfirmandoWhats(false)
    setRecado(
      copiou
        ? 'Imagem copiada. Na conversa do WhatsApp, aperte Ctrl+V (ou toque em colar) e envie.'
        : 'Não foi possível copiar a imagem. Use "Baixar imagem" e anexe pelo clipe do WhatsApp.',
    )
  }

  return (
    <div className="space-y-3">
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {recado ? <Aviso tom="info">{recado}</Aviso> : null}

      <button
        type="button"
        className="btn-primario w-full"
        onClick={compartilhar}
        disabled={preparando || !arquivos}
      >
        {preparando ? 'Preparando os arquivos…' : 'Compartilhar comprovante'}
      </button>

      {confirmandoWhats ? (
        <div className="cartao space-y-3 p-4">
          <p className="text-sm text-slate-700">
            {telefone
              ? `Abrir a conversa de ${nomeDestinatario ?? 'contato'} (${telefone}) no WhatsApp?`
              : 'Abrir o WhatsApp para escolher o destinatário?'}
          </p>
          <Aviso tom="info">
            O WhatsApp não aceita anexo por link. Vamos <strong>copiar a imagem</strong> e abrir
            a conversa com a mensagem pronta: lá, aperte <strong>Ctrl+V</strong> para colar a
            imagem e envie. O envio sempre depende do seu toque.
          </Aviso>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secundario flex-1"
              onClick={() => setConfirmandoWhats(false)}
            >
              Voltar
            </button>
            <button
              type="button"
              className="btn-ouro flex-1"
              onClick={() => void copiarEAbrirWhatsApp()}
            >
              Copiar imagem e abrir WhatsApp
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn-ouro w-full"
          onClick={() => void enviarWhatsApp()}
          disabled={preparando || !arquivos}
        >
          Enviar pelo WhatsApp
        </button>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="btn-secundario"
          disabled={!arquivos}
          onClick={() => arquivos && baixarBlob(arquivos.pdf, arquivos.nomePdf)}
        >
          Baixar PDF
        </button>
        <button
          type="button"
          className="btn-secundario"
          disabled={!arquivos}
          onClick={() => arquivos && baixarBlob(arquivos.png, arquivos.nomePng)}
        >
          Baixar imagem
        </button>
      </div>

      {aoEmitirOutro ? (
        <button type="button" className="btn-secundario w-full" onClick={aoEmitirOutro}>
          Emitir outro comprovante
        </button>
      ) : null}
    </div>
  )
}
