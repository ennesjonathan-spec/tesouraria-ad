# Histórico de versões

## 1.0.0

Primeira versão em uso.

- Entrada com e-mail e senha, três perfis de acesso (Administrador/Tesoureiro,
  Operador e Consulta) com Row Level Security no banco.
- Cadastro de membros com importação CSV/XLSX, busca sem acento, aviso de
  duplicidade, inativação preservando o histórico e o registro permanente
  NÃO IDENTIFICADO.
- Emissão de comprovante em cinco etapas, com um ou mais itens de dízimo e
  oferta, subcategorias configuráveis e total calculado.
- Numeração sequencial garantida pelo banco e chave de idempotência para o
  envio offline.
- Comprovante em PDF e PNG a partir de um único renderizador, compartilhamento
  pelo menu nativo do celular e atalho para o WhatsApp.
- Histórico com busca e filtros, cancelamento com motivo e reemissão ligada ao
  comprovante cancelado.
- Painel inicial e relatório mensal com relação nominal derivada dos
  lançamentos, seis conferências de fechamento e exportação em PDF, XLSX e CSV.
- Funcionamento sem internet com fila de rascunhos e sincronização automática.
- Instalável como PWA no Android e no iPhone.
