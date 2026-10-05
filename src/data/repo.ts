/**
 * Acesso a dados. Toda leitura e escrita do app passa por aqui.
 *
 * Conversão de dinheiro: o Postgres devolve numeric como string ("250.00") e
 * o app trabalha em centavos inteiros. A tradução acontece só nesta camada,
 * então nenhum valor em reais circula como float pelo aplicativo.
 */
import { supabase } from '@/lib/supabase'
import { BUCKET_LOGO } from '@/lib/env'
import { centsToDecimalString, decimalStringToCents, type Cents } from '@/lib/money'
import { normalizarEspacos } from '@/lib/normalize'
import type {
  ChurchSettings,
  Member,
  NovoComprovante,
  PerfilAcesso,
  Profile,
  Receipt,
  ReceiptItem,
} from '@/domain/types'

// ---------------------------------------------------------------- perfis
export async function lerMeuPerfil(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return (data as Profile | null) ?? null
}

export async function listarUsuarios(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('nome')
  if (error) throw error
  return (data ?? []) as Profile[]
}

export async function atualizarUsuario(
  id: string,
  mudancas: { perfil?: PerfilAcesso; ativo?: boolean; nome?: string },
): Promise<void> {
  const { error } = await supabase.from('profiles').update(mudancas).eq('id', id)
  if (error) throw error
}

// ------------------------------------------------------- dados da igreja
export async function lerConfiguracoes(): Promise<ChurchSettings> {
  const { data, error } = await supabase.from('church_settings').select('*').eq('id', 1).single()
  if (error) throw error
  return data as ChurchSettings
}

export async function salvarConfiguracoes(mudancas: Partial<ChurchSettings>): Promise<ChurchSettings> {
  const { id: _ignorado, updated_at: _tambem, ...limpo } = mudancas as Record<string, unknown>
  const { data, error } = await supabase
    .from('church_settings')
    .update(limpo)
    .eq('id', 1)
    .select()
    .single()
  if (error) throw error
  return data as ChurchSettings
}

export async function enviarLogo(arquivo: File): Promise<string> {
  const ext = (arquivo.name.split('.').pop() || 'png').toLowerCase()
  const caminho = `logo-${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from(BUCKET_LOGO)
    .upload(caminho, arquivo, { upsert: true, cacheControl: '3600', contentType: arquivo.type })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET_LOGO).getPublicUrl(caminho)
  return data.publicUrl
}

// -------------------------------------------------------------- membros
export async function listarMembros(incluirInativos = true): Promise<Member[]> {
  let q = supabase.from('members').select('*')
  if (!incluirInativos) q = q.eq('ativo', true)
  const { data, error } = await q.order('registro_especial', { ascending: false }).order('nome_completo')
  if (error) throw error
  return (data ?? []) as Member[]
}

export async function criarMembro(entrada: {
  nome_completo: string
  telefone?: string | null
  observacao?: string | null
}): Promise<Member> {
  const { data, error } = await supabase
    .from('members')
    .insert({
      nome_completo: normalizarEspacos(entrada.nome_completo),
      telefone: entrada.telefone?.trim() || null,
      observacao: entrada.observacao?.trim() || null,
    })
    .select()
    .single()
  if (error) throw error
  return data as Member
}

export async function criarMembrosEmLote(
  linhas: ReadonlyArray<{ nome_completo: string; telefone?: string | null; observacao?: string | null }>,
): Promise<Member[]> {
  if (linhas.length === 0) return []
  const payload = linhas.map((l) => ({
    nome_completo: normalizarEspacos(l.nome_completo),
    telefone: l.telefone?.trim() || null,
    observacao: l.observacao?.trim() || null,
  }))
  const criados: Member[] = []
  // Em blocos, para não estourar o limite da requisição numa importação grande.
  for (let i = 0; i < payload.length; i += 200) {
    const { data, error } = await supabase
      .from('members')
      .insert(payload.slice(i, i + 200))
      .select()
    if (error) throw error
    criados.push(...((data ?? []) as Member[]))
  }
  return criados
}

export async function atualizarMembro(
  id: string,
  mudancas: Partial<Pick<Member, 'nome_completo' | 'telefone' | 'observacao' | 'ativo'>>,
): Promise<Member> {
  const limpo: Record<string, unknown> = { ...mudancas }
  if (typeof limpo.nome_completo === 'string') {
    limpo.nome_completo = normalizarEspacos(limpo.nome_completo)
  }
  const { data, error } = await supabase.from('members').update(limpo).eq('id', id).select().single()
  if (error) throw error
  return data as Member
}

// --------------------------------------------------------- comprovantes
interface LinhaItem {
  id: string
  receipt_id: string
  tipo: 'dizimo' | 'oferta'
  subcategoria: string | null
  valor: string
  observacao: string | null
}

function montarItem(l: LinhaItem): ReceiptItem {
  return {
    id: l.id,
    receipt_id: l.receipt_id,
    tipo: l.tipo,
    subcategoria: l.subcategoria,
    valor: decimalStringToCents(l.valor),
    observacao: l.observacao,
  }
}

const COLUNAS_TOTAIS =
  'id,numero_comprovante,member_id,nome_exibido,data_recebimento,hora_recebimento,' +
  'competencia,forma_recebimento,status,observacao,receipt_original_id,created_at,' +
  'nao_identificado,total_dizimo,total_oferta,total_geral'

function montarComprovante(linha: Record<string, unknown>, itens: ReceiptItem[] = []): Receipt {
  return {
    id: String(linha.id),
    numero_comprovante: String(linha.numero_comprovante),
    member_id: String(linha.member_id),
    nome_exibido: String(linha.nome_exibido),
    data_recebimento: String(linha.data_recebimento),
    hora_recebimento: String(linha.hora_recebimento),
    competencia: String(linha.competencia),
    forma_recebimento: String(linha.forma_recebimento),
    observacao: (linha.observacao as string | null) ?? null,
    status: linha.status === 'cancelado' ? 'cancelado' : 'valido',
    motivo_cancelamento: (linha.motivo_cancelamento as string | null) ?? null,
    cancelado_em: (linha.cancelado_em as string | null) ?? null,
    receipt_original_id: (linha.receipt_original_id as string | null) ?? null,
    created_by: String(linha.created_by ?? ''),
    created_at: String(linha.created_at),
    nao_identificado: Boolean(linha.nao_identificado),
    total_dizimo: decimalStringToCents(linha.total_dizimo as string),
    total_oferta: decimalStringToCents(linha.total_oferta as string),
    total_geral: decimalStringToCents(linha.total_geral as string),
    itens,
  }
}

/** Busca os itens de vários comprovantes de uma vez (evita N+1). */
async function carregarItens(ids: readonly string[]): Promise<Map<string, ReceiptItem[]>> {
  const mapa = new Map<string, ReceiptItem[]>()
  if (ids.length === 0) return mapa
  for (let i = 0; i < ids.length; i += 300) {
    const { data, error } = await supabase
      .from('receipt_items')
      .select('id,receipt_id,tipo,subcategoria,valor,observacao')
      .in('receipt_id', ids.slice(i, i + 300))
    if (error) throw error
    for (const l of (data ?? []) as unknown as LinhaItem[]) {
      const lista = mapa.get(l.receipt_id) ?? []
      lista.push(montarItem(l))
      mapa.set(l.receipt_id, lista)
    }
  }
  return mapa
}

export interface FiltroComprovantes {
  competencia?: string
  dataInicial?: string
  dataFinal?: string
  tipo?: 'dizimo' | 'oferta'
  forma?: string
  identificacao?: 'identificado' | 'nao_identificado'
  status?: 'valido' | 'cancelado'
  texto?: string
  limite?: number
}

export async function listarComprovantes(filtro: FiltroComprovantes = {}): Promise<Receipt[]> {
  let q = supabase.from('receipt_totals').select(COLUNAS_TOTAIS)

  if (filtro.competencia) q = q.eq('competencia', filtro.competencia)
  if (filtro.dataInicial) q = q.gte('data_recebimento', filtro.dataInicial)
  if (filtro.dataFinal) q = q.lte('data_recebimento', filtro.dataFinal)
  if (filtro.status) q = q.eq('status', filtro.status)
  if (filtro.forma) q = q.eq('forma_recebimento', filtro.forma)
  if (filtro.identificacao === 'identificado') q = q.eq('nao_identificado', false)
  if (filtro.identificacao === 'nao_identificado') q = q.eq('nao_identificado', true)
  if (filtro.tipo === 'dizimo') q = q.gt('total_dizimo', 0)
  if (filtro.tipo === 'oferta') q = q.gt('total_oferta', 0)
  if (filtro.texto?.trim()) {
    const t = filtro.texto.trim().replace(/[%,]/g, ' ')
    q = q.or(`nome_exibido.ilike.%${t}%,numero_comprovante.ilike.%${t}%`)
  }

  const { data, error } = await q
    .order('data_recebimento', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(filtro.limite ?? 400)
  if (error) throw error

  const linhas = (data ?? []) as unknown as Array<Record<string, unknown>>
  const itens = await carregarItens(linhas.map((l) => String(l.id)))
  return linhas.map((l) => montarComprovante(l, itens.get(String(l.id)) ?? []))
}

/** Um comprovante com tudo que o comprovante impresso precisa. */
export async function lerComprovante(id: string): Promise<Receipt | null> {
  const { data, error } = await supabase
    .from('receipts')
    .select(
      'id,numero_comprovante,member_id,nome_exibido,data_recebimento,hora_recebimento,' +
        'competencia,forma_recebimento,observacao,status,motivo_cancelamento,cancelado_em,' +
        'receipt_original_id,created_by,created_at',
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const linha = data as unknown as Record<string, unknown>

  const { data: itensData, error: e2 } = await supabase
    .from('receipt_items')
    .select('id,receipt_id,tipo,subcategoria,valor,observacao')
    .eq('receipt_id', id)
  if (e2) throw e2
  const itens = ((itensData ?? []) as unknown as LinhaItem[]).map(montarItem)

  const { data: membro } = await supabase
    .from('members')
    .select('registro_especial')
    .eq('id', String(linha.member_id))
    .maybeSingle()

  const dizimo = itens.filter((i) => i.tipo === 'dizimo').reduce((s, i) => s + i.valor, 0)
  const oferta = itens.filter((i) => i.tipo === 'oferta').reduce((s, i) => s + i.valor, 0)

  return montarComprovante(
    {
      ...linha,
      nao_identificado: Boolean(membro?.registro_especial),
      total_dizimo: centsToDecimalString(dizimo),
      total_oferta: centsToDecimalString(oferta),
      total_geral: centsToDecimalString(dizimo + oferta),
    },
    itens,
  )
}

/**
 * Emite o comprovante. Uma única chamada ao banco, que grava comprovante e
 * itens na mesma transação e devolve o número oficial. Reenviar o mesmo
 * client_uuid devolve o comprovante já criado, sem gerar número novo.
 */
export async function emitirComprovante(entrada: NovoComprovante): Promise<Receipt> {
  const { data, error } = await supabase.rpc('emitir_comprovante', {
    p_member_id: entrada.member_id,
    p_data_recebimento: entrada.data_recebimento,
    p_hora_recebimento: entrada.hora_recebimento,
    p_competencia: entrada.competencia,
    p_forma: entrada.forma_recebimento,
    p_itens: entrada.itens.map((i) => ({
      tipo: i.tipo,
      subcategoria: i.subcategoria,
      valor: centsToDecimalString(i.valor),
      observacao: i.observacao,
    })),
    p_observacao: entrada.observacao,
    p_client_uuid: entrada.client_uuid,
    p_original_id: entrada.receipt_original_id ?? null,
  })
  if (error) throw error

  const id = String((data as Record<string, unknown>).id)
  const completo = await lerComprovante(id)
  if (!completo) throw new Error('O comprovante foi gravado, mas não pôde ser lido de volta.')
  return completo
}

export async function cancelarComprovante(id: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc('cancelar_comprovante', { p_id: id, p_motivo: motivo })
  if (error) throw error
}

// ------------------------------------------------------------ auditoria
export interface LinhaAuditoria {
  id: number
  usuario_email: string | null
  acao: string
  tabela_afetada: string
  registro_afetado: string | null
  data_e_hora: string
}

export async function listarAuditoria(limite = 200): Promise<LinhaAuditoria[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id,usuario_email,acao,tabela_afetada,registro_afetado,data_e_hora')
    .order('data_e_hora', { ascending: false })
    .limit(limite)
  if (error) throw error
  return (data ?? []) as LinhaAuditoria[]
}

// -------------------------------------------- resumo por membro (tela Membros)
export interface ResumoMembro {
  member_id: string
  total: Cents
  qtd: number
  ultima: string | null
}

export async function resumoPorMembro(
  competencia?: string,
): Promise<Map<string, ResumoMembro>> {
  let q = supabase
    .from('receipt_totals')
    .select('member_id,total_geral,data_recebimento,status')
    .eq('status', 'valido')
  if (competencia) q = q.eq('competencia', competencia)

  const { data, error } = await q.limit(5000)
  if (error) throw error

  const mapa = new Map<string, ResumoMembro>()
  for (const l of (data ?? []) as unknown as Array<Record<string, unknown>>) {
    const id = String(l.member_id)
    const atual = mapa.get(id) ?? { member_id: id, total: 0, qtd: 0, ultima: null }
    atual.total += decimalStringToCents(l.total_geral as string)
    atual.qtd += 1
    const d = String(l.data_recebimento)
    if (!atual.ultima || d > atual.ultima) atual.ultima = d
    mapa.set(id, atual)
  }
  return mapa
}
