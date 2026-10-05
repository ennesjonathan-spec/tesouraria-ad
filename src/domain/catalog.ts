import type { TipoLancamento } from './types'

export const TIPOS: ReadonlyArray<{ valor: TipoLancamento; rotulo: string }> = [
  { valor: 'dizimo', rotulo: 'Dízimo' },
  { valor: 'oferta', rotulo: 'Oferta' },
]

export function rotuloTipo(tipo: TipoLancamento): string {
  return tipo === 'dizimo' ? 'Dízimo' : 'Oferta'
}

/** Usadas só quando as configurações da igreja ainda não carregaram. */
export const SUBCATEGORIAS_PADRAO: readonly string[] = [
  'Oferta de culto',
  'Oferta via PIX',
  'Oferta missionária',
  'Oferta da Santa Ceia',
  'Escola Bíblica Dominical — EBD',
  'Campanha',
  'Outra',
]

export const FORMAS_PADRAO: readonly string[] = [
  'Dinheiro',
  'PIX',
  'Transferência bancária',
  'Outra',
]

export const NOME_NAO_IDENTIFICADO = 'NÃO IDENTIFICADO'
