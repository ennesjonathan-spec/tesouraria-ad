import type { Cents } from '@/lib/money'

export type PerfilAcesso = 'admin' | 'operador' | 'consulta'
export type TipoLancamento = 'dizimo' | 'oferta'
export type StatusComprovante = 'valido' | 'cancelado'

export interface Profile {
  id: string
  nome: string
  email: string
  perfil: PerfilAcesso
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface ChurchSettings {
  id: 1
  nome_igreja: string
  congregacao: string
  codigo: string
  endereco: string
  dirigente: string
  tesoureiro: string
  logo_url: string | null
  versiculo_rodape: string
  versiculo_ref: string
  aviso_rodape: string
  prefixo_comprovante: string
  cores_do_layout: CoresLayout
  subcategorias_oferta: string[]
  formas_recebimento: string[]
  updated_at: string
}

export interface CoresLayout {
  primaria: string
  secundaria: string
  destaque: string
  texto: string
}

export interface Member {
  id: string
  nome_completo: string
  telefone: string | null
  observacao: string | null
  ativo: boolean
  registro_especial: boolean
  created_at: string
  updated_at: string
}

/** Membro com os agregados que a tela de Membros mostra. */
export interface MemberComResumo extends Member {
  ultima_contribuicao: string | null
  total_periodo: Cents
  qtd_comprovantes: number
}

export interface ReceiptItem {
  id: string
  receipt_id: string
  tipo: TipoLancamento
  subcategoria: string | null
  valor: Cents
  observacao: string | null
}

/** Item ainda sendo digitado, antes de virar comprovante. */
export interface ItemRascunho {
  uid: string
  tipo: TipoLancamento
  subcategoria: string | null
  valor: Cents
  observacao: string | null
}

export interface Receipt {
  id: string
  numero_comprovante: string
  member_id: string
  nome_exibido: string
  data_recebimento: string
  hora_recebimento: string
  competencia: string
  forma_recebimento: string
  observacao: string | null
  status: StatusComprovante
  motivo_cancelamento: string | null
  cancelado_em: string | null
  receipt_original_id: string | null
  created_by: string
  created_at: string
  nao_identificado: boolean
  total_dizimo: Cents
  total_oferta: Cents
  total_geral: Cents
  itens?: ReceiptItem[]
}

/** Rascunho preenchido offline, à espera de sincronização. */
export interface RascunhoOffline {
  client_uuid: string
  member_id: string
  nome_exibido: string
  data_recebimento: string
  hora_recebimento: string
  competencia: string
  forma_recebimento: string
  observacao: string | null
  itens: ItemRascunho[]
  criado_em: number
  tentativas: number
  ultimo_erro: string | null
}

export interface NovoComprovante {
  member_id: string
  data_recebimento: string
  hora_recebimento: string
  competencia: string
  forma_recebimento: string
  observacao: string | null
  itens: ItemRascunho[]
  client_uuid: string
  receipt_original_id?: string | null
}

export interface TotalNominal {
  nome: string
  total: Cents
  qtd: number
}

export interface Conferencia {
  rotulo: string
  esperado: Cents
  apurado: Cents
  diferenca: Cents
  ok: boolean
}

export interface RelatorioMensal {
  competencia: string
  totalDizimos: Cents
  totalOfertas: Cents
  totalGeral: Cents
  porSubcategoria: TotalNominal[]
  porForma: TotalNominal[]
  totalIdentificado: Cents
  totalNaoIdentificado: Cents
  dizimistas: TotalNominal[]
  ofertantes: TotalNominal[]
  qtdComprovantes: number
  qtdCancelados: number
  totalCancelado: Cents
  cancelados: Receipt[]
  conferencias: Conferencia[]
  tudoFecha: boolean
}

export interface ResumoPainel {
  totalHoje: Cents
  totalMes: Cents
  dizimosMes: Cents
  ofertasMes: Cents
  porForma: TotalNominal[]
  identificadoMes: Cents
  naoIdentificadoMes: Cents
  qtdEmitidos: number
  qtdCancelados: number
}
