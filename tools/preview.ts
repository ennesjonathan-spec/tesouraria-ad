/**
 * Ferramenta de desenvolvimento: desenha exemplos do comprovante para
 * conferir o layout sem precisar emitir nada no banco.
 *
 * Como usar:  npm run dev   e abra  /tools/preview-comprovante.html
 * Os dados abaixo são fictícios e existem só para esta pré-visualização.
 */
import { desenharComprovante, type DadosComprovante } from '../src/render/receiptCanvas'
import type { ChurchSettings } from '../src/domain/types'

const config: ChurchSettings = {
  id: 1,
  nome_igreja: 'Igreja Evangélica Assembleia de Deus',
  congregacao: 'Congregação Balneário Central',
  codigo: '124',
  endereco: 'Av. Márcio G. da Silva, Qd. B, Lt. 20, Jd. Balneário Meia Ponte, Goiânia/GO',
  dirigente: 'Pedro João Alves da Silva Filho',
  tesoureiro: 'Jonathan Ennenes Pereira',
  logo_url: null,
  versiculo_rodape: 'Deus ama quem dá com alegria.',
  versiculo_ref: '2 Coríntios 9:7',
  aviso_rodape: 'Comprovante emitido pela tesouraria para registro e confirmação da entrega.',
  prefixo_comprovante: '124',
  cores_do_layout: {
    primaria: '#0f2a4a',
    secundaria: '#ffffff',
    destaque: '#bd9336',
    texto: '#13202e',
  },
  subcategorias_oferta: [],
  formas_recebimento: [],
  updated_at: new Date().toISOString(),
}

const exemplos: Array<{ titulo: string; dados: DadosComprovante }> = [
  {
    titulo: 'Cenário A — somente dízimo',
    dados: {
      numero: '124-2026-000001',
      nome: 'Maria Aparecida de Exemplo',
      naoIdentificado: false,
      dataRecebimento: '2026-10-04',
      horaRecebimento: '19:30',
      competencia: '10/2026',
      forma: 'PIX',
      observacao: null,
      itens: [{ uid: '1', tipo: 'dizimo', subcategoria: null, valor: 25000, observacao: null }],
      total: 25000,
    },
  },
  {
    titulo: 'Cenário B — dízimo + oferta, com observação',
    dados: {
      numero: '124-2026-000002',
      nome: 'José Carlos Rodrigues de Exemplo',
      naoIdentificado: false,
      dataRecebimento: '2026-10-04',
      horaRecebimento: '19:35',
      competencia: '10/2026',
      forma: 'Dinheiro',
      observacao: 'Entrega feita ao final do culto de domingo.',
      itens: [
        { uid: '1', tipo: 'dizimo', subcategoria: null, valor: 30000, observacao: null },
        { uid: '2', tipo: 'oferta', subcategoria: 'Oferta de culto', valor: 5000, observacao: null },
      ],
      total: 35000,
    },
  },
  {
    titulo: 'Cenário C — NÃO IDENTIFICADO',
    dados: {
      numero: '124-2026-000003',
      nome: 'NÃO IDENTIFICADO',
      naoIdentificado: true,
      dataRecebimento: '2026-10-04',
      horaRecebimento: '19:40',
      competencia: '10/2026',
      forma: 'Dinheiro',
      observacao: null,
      itens: [
        { uid: '1', tipo: 'oferta', subcategoria: 'Oferta de culto', valor: 9300, observacao: null },
      ],
      total: 9300,
    },
  },
  {
    titulo: 'Limite — nome longo, 4 itens, cancelado',
    dados: {
      numero: '124-2026-000004',
      nome: 'Maria das Graças Albuquerque Sevidanes Guimarães de Exemplo',
      naoIdentificado: false,
      dataRecebimento: '2026-12-31',
      horaRecebimento: '21:05',
      competencia: '12/2026',
      forma: 'Transferência bancária',
      observacao:
        'Comprovante de teste com observação longa para verificar a quebra de linha no rodapé do bloco.',
      itens: [
        { uid: '1', tipo: 'dizimo', subcategoria: null, valor: 162100, observacao: null },
        { uid: '2', tipo: 'oferta', subcategoria: 'Oferta da Santa Ceia', valor: 10000, observacao: null },
        { uid: '3', tipo: 'oferta', subcategoria: 'Escola Bíblica Dominical — EBD', valor: 7625, observacao: null },
        { uid: '4', tipo: 'oferta', subcategoria: 'Oferta missionária', valor: 50000, observacao: null },
      ],
      total: 229725,
      cancelado: true,
      motivoCancelamento: 'Valor do dízimo digitado errado durante o culto.',
    },
  },
]

for (const ex of exemplos) {
  const fig = document.createElement('figure')
  const cap = document.createElement('figcaption')
  cap.textContent = ex.titulo
  const canvas = document.createElement('canvas')
  fig.append(cap, canvas)
  document.body.append(fig)
  desenharComprovante(canvas, ex.dados, config, null, 1)
}
