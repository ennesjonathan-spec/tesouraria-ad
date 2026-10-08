import { useEffect, useRef, useState } from 'react'
import { atualizarUsuario, enviarLogo, listarAuditoria, listarUsuarios, type LinhaAuditoria } from '@/data/repo'
import { mensagemErro } from '@/lib/errors'
import { formatarDataHora } from '@/lib/dates'
import { useAuth } from '@/state/AuthContext'
import { useSettings } from '@/state/SettingsContext'
import { useOffline } from '@/state/OfflineContext'
import { AreaTexto, Aviso, Campo, Carregando, Confirmacao, Etiqueta, Selecao } from '@/components/ui'
import type { ChurchSettings, PerfilAcesso, Profile } from '@/domain/types'

export function Configuracoes() {
  const { perfil, ehAdmin, sair } = useAuth()
  const { config, salvar } = useSettings()
  const { rascunhos, sincronizar, online, sincronizando } = useOffline()

  const [rascunho, setRascunho] = useState<ChurchSettings>(config)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [saindo, setSaindo] = useState(false)
  const arquivoLogo = useRef<HTMLInputElement>(null)

  useEffect(() => setRascunho(config), [config])

  async function gravar() {
    setErro(null)
    setOk(null)
    setSalvando(true)
    try {
      await salvar({
        nome_igreja: rascunho.nome_igreja,
        congregacao: rascunho.congregacao,
        codigo: rascunho.codigo,
        endereco: rascunho.endereco,
        dirigente: rascunho.dirigente,
        tesoureiro: rascunho.tesoureiro,
        tesoureiro_2: rascunho.tesoureiro_2 ?? '',
        versiculo_rodape: rascunho.versiculo_rodape,
        versiculo_ref: rascunho.versiculo_ref,
        aviso_rodape: rascunho.aviso_rodape,
        prefixo_comprovante: rascunho.prefixo_comprovante,
        cores_do_layout: rascunho.cores_do_layout,
        subcategorias_oferta: rascunho.subcategorias_oferta,
        formas_recebimento: rascunho.formas_recebimento,
      })
      setOk('Configurações salvas. O próximo comprovante já sai com elas.')
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setSalvando(false)
    }
  }

  async function trocarLogo(arquivo: File) {
    setErro(null)
    setSalvando(true)
    try {
      const url = await enviarLogo(arquivo)
      await salvar({ logo_url: url })
      setOk('Logo atualizada.')
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">Configurações</h1>

      <section className="cartao p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sua conta</p>
        <p className="mt-1 text-base font-semibold text-slate-900">{perfil?.nome}</p>
        <p className="text-sm text-slate-500">{perfil?.email}</p>
        <div className="mt-2">
          <Etiqueta tom={ehAdmin ? 'destaque' : 'neutro'}>
            {perfil?.perfil === 'admin'
              ? 'Administrador / Tesoureiro'
              : perfil?.perfil === 'operador'
                ? 'Operador'
                : 'Consulta'}
          </Etiqueta>
        </div>
        <button type="button" className="btn-secundario mt-4 w-full" onClick={() => setSaindo(true)}>
          Sair do aplicativo
        </button>
      </section>

      {rascunhos.length > 0 ? (
        <Aviso tom="alerta" titulo={`${rascunhos.length} lançamento(s) no aparelho`}>
          <ul className="mt-1 space-y-1 text-xs">
            {rascunhos.map((r) => (
              <li key={r.client_uuid}>
                {r.data_recebimento} · {r.itens.length} item(ns)
                {r.ultimo_erro ? ` — ${r.ultimo_erro}` : ''}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-2 font-semibold underline underline-offset-2 disabled:opacity-50"
            disabled={!online || sincronizando}
            onClick={() => void sincronizar()}
          >
            {sincronizando ? 'Enviando…' : 'Enviar agora'}
          </button>
        </Aviso>
      ) : null}

      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {ok ? <Aviso tom="ok">{ok}</Aviso> : null}

      {!ehAdmin ? (
        <Aviso tom="info">
          Só o administrador/tesoureiro edita os dados da igreja e os usuários.
        </Aviso>
      ) : (
        <>
          <section className="cartao space-y-3 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Dados da igreja
            </h2>
            <Campo
              rotulo="Nome da igreja"
              value={rascunho.nome_igreja}
              onChange={(e) => setRascunho({ ...rascunho, nome_igreja: e.target.value })}
            />
            <Campo
              rotulo="Congregação"
              value={rascunho.congregacao}
              onChange={(e) => setRascunho({ ...rascunho, congregacao: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Campo
                rotulo="Código"
                value={rascunho.codigo}
                onChange={(e) => setRascunho({ ...rascunho, codigo: e.target.value })}
              />
              <Campo
                rotulo="Prefixo do comprovante"
                value={rascunho.prefixo_comprovante}
                onChange={(e) =>
                  setRascunho({ ...rascunho, prefixo_comprovante: e.target.value })
                }
                dica="Muda só a numeração futura."
              />
            </div>
            <AreaTexto
              rotulo="Endereço"
              value={rascunho.endereco}
              onChange={(e) => setRascunho({ ...rascunho, endereco: e.target.value })}
            />
            <Campo
              rotulo="Pastor dirigente"
              value={rascunho.dirigente}
              onChange={(e) => setRascunho({ ...rascunho, dirigente: e.target.value })}
            />
            <Campo
              rotulo="1º Tesoureiro"
              value={rascunho.tesoureiro}
              onChange={(e) => setRascunho({ ...rascunho, tesoureiro: e.target.value })}
            />
            <Campo
              rotulo="2º Tesoureiro"
              value={rascunho.tesoureiro_2 ?? ''}
              onChange={(e) => setRascunho({ ...rascunho, tesoureiro_2: e.target.value })}
            />
          </section>

          <section className="cartao space-y-3 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Logo da igreja
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                {config.logo_url ? (
                  <img src={config.logo_url} alt="Logo atual" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-xl font-bold text-slate-400">AD</span>
                )}
              </div>
              <div className="flex-1">
                <button
                  type="button"
                  className="btn-secundario w-full"
                  onClick={() => arquivoLogo.current?.click()}
                  disabled={salvando}
                >
                  {config.logo_url ? 'Substituir logo' : 'Enviar logo'}
                </button>
                <p className="mt-2 text-xs text-slate-500">
                  PNG ou JPG com fundo claro, até 2 MB. Aparece no topo do comprovante.
                </p>
              </div>
            </div>
            <input
              ref={arquivoLogo}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void trocarLogo(f)
                e.target.value = ''
              }}
            />
          </section>

          <section className="cartao space-y-3 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Rodapé do comprovante
            </h2>
            <Campo
              rotulo="Versículo"
              value={rascunho.versiculo_rodape}
              onChange={(e) => setRascunho({ ...rascunho, versiculo_rodape: e.target.value })}
            />
            <Campo
              rotulo="Referência"
              value={rascunho.versiculo_ref}
              onChange={(e) => setRascunho({ ...rascunho, versiculo_ref: e.target.value })}
            />
            <AreaTexto
              rotulo="Aviso"
              value={rascunho.aviso_rodape}
              onChange={(e) => setRascunho({ ...rascunho, aviso_rodape: e.target.value })}
              dica="O comprovante não é documento fiscal nem serve para dedução de imposto."
            />
          </section>

          <ListaEditavel
            titulo="Subcategorias de oferta"
            itens={rascunho.subcategorias_oferta}
            aoMudar={(v) => setRascunho({ ...rascunho, subcategorias_oferta: v })}
          />
          <ListaEditavel
            titulo="Formas de recebimento"
            itens={rascunho.formas_recebimento}
            aoMudar={(v) => setRascunho({ ...rascunho, formas_recebimento: v })}
            minimo={1}
          />

          <section className="cartao space-y-3 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Cores do comprovante
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ['primaria', 'Principal'],
                  ['destaque', 'Destaque'],
                  ['texto', 'Texto'],
                  ['secundaria', 'Fundo claro'],
                ] as const
              ).map(([chave, rotulo]) => (
                <label key={chave} className="block">
                  <span className="rotulo">{rotulo}</span>
                  <input
                    type="color"
                    className="h-12 w-full cursor-pointer rounded-xl border border-slate-300"
                    value={rascunho.cores_do_layout[chave]}
                    onChange={(e) =>
                      setRascunho({
                        ...rascunho,
                        cores_do_layout: { ...rascunho.cores_do_layout, [chave]: e.target.value },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </section>

          <button type="button" className="btn-primario w-full" onClick={gravar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar configurações'}
          </button>

          <Usuarios />
          <Auditoria />
        </>
      )}

      <Confirmacao
        aberto={saindo}
        titulo="Sair do aplicativo?"
        descricao="Os dados guardados no aparelho (relação de membros e rascunhos não enviados) serão apagados deste celular."
        rotuloConfirmar="Sair"
        perigo
        aoFechar={() => setSaindo(false)}
        aoConfirmar={() => void sair()}
      />
    </div>
  )
}

function ListaEditavel({
  titulo,
  itens,
  aoMudar,
  minimo = 0,
}: {
  titulo: string
  itens: readonly string[]
  aoMudar: (v: string[]) => void
  minimo?: number
}) {
  const [novo, setNovo] = useState('')
  return (
    <section className="cartao space-y-3 p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">{titulo}</h2>
      <ul className="space-y-2">
        {itens.map((i) => (
          <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
            <span className="text-sm text-slate-700">{i}</span>
            <button
              type="button"
              className="rounded px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
              disabled={itens.length <= minimo}
              onClick={() => aoMudar(itens.filter((x) => x !== i))}
            >
              Remover
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          className="campo flex-1"
          value={novo}
          placeholder="Adicionar…"
          onChange={(e) => setNovo(e.target.value)}
        />
        <button
          type="button"
          className="btn-secundario"
          disabled={!novo.trim() || itens.includes(novo.trim())}
          onClick={() => {
            aoMudar([...itens, novo.trim()])
            setNovo('')
          }}
        >
          Incluir
        </button>
      </div>
    </section>
  )
}

function Usuarios() {
  const { perfil } = useAuth()
  const [lista, setLista] = useState<Profile[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() {
    setCarregando(true)
    try {
      setLista(await listarUsuarios())
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    void carregar()
  }, [])

  async function mudar(id: string, mudancas: { perfil?: PerfilAcesso; ativo?: boolean }) {
    setErro(null)
    try {
      await atualizarUsuario(id, mudancas)
      await carregar()
    } catch (e) {
      setErro(mensagemErro(e))
    }
  }

  return (
    <section className="cartao space-y-3 p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Usuários</h2>
      <Aviso tom="info">
        Novos usuários se cadastram pela tela de login do Supabase (ou você os cria no painel) e
        entram como <strong>Consulta</strong>. Libere aqui o perfil de cada um.
      </Aviso>
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {carregando ? <Carregando /> : null}
      <ul className="space-y-2">
        {lista.map((u) => (
          <li key={u.id} className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{u.nome}</p>
                <p className="truncate text-xs text-slate-500">{u.email}</p>
              </div>
              {u.id === perfil?.id ? <Etiqueta tom="destaque">Você</Etiqueta> : null}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Selecao
                rotulo="Perfil"
                value={u.perfil}
                disabled={u.id === perfil?.id}
                onChange={(e) => void mudar(u.id, { perfil: e.target.value as PerfilAcesso })}
              >
                <option value="admin">Administrador/Tesoureiro</option>
                <option value="operador">Operador</option>
                <option value="consulta">Consulta</option>
              </Selecao>
              <Selecao
                rotulo="Situação"
                value={u.ativo ? 'ativo' : 'inativo'}
                disabled={u.id === perfil?.id}
                onChange={(e) => void mudar(u.id, { ativo: e.target.value === 'ativo' })}
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </Selecao>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Auditoria() {
  const [linhas, setLinhas] = useState<LinhaAuditoria[]>([])
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(false)

  async function carregar() {
    setCarregando(true)
    try {
      setLinhas(await listarAuditoria(100))
    } finally {
      setCarregando(false)
    }
  }

  return (
    <section className="cartao p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between text-sm font-bold uppercase tracking-wide text-slate-500"
        onClick={() => {
          setAberto((a) => !a)
          if (!aberto && linhas.length === 0) void carregar()
        }}
      >
        Registro de auditoria
        <span className="text-xs">{aberto ? 'ocultar' : 'ver'}</span>
      </button>
      {aberto ? (
        <>
          {carregando ? <Carregando /> : null}
          <ul className="mt-3 space-y-1 text-xs">
            {linhas.map((l) => (
              <li key={l.id} className="flex items-start justify-between gap-2 border-b border-slate-100 py-1.5">
                <span className="text-slate-700">
                  <strong>{l.acao}</strong> em {l.tabela_afetada}
                  <br />
                  <span className="text-slate-500">{l.usuario_email ?? 'sistema'}</span>
                </span>
                <span className="shrink-0 text-slate-400">{formatarDataHora(l.data_e_hora)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  )
}
