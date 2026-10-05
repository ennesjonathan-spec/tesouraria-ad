# Tesouraria AD Balneário Central

Aplicativo de celular (PWA instalável) para a tesouraria da **Congregação
Balneário Central (cód. 124)** registrar entregas de dízimos e ofertas, emitir
comprovante em PDF e imagem, mandar pelo WhatsApp e fechar o mês sem diferença
entre a relação nominal e os totais.

> **Comece por [`docs/INSTALACAO.md`](docs/INSTALACAO.md).** São 20 minutos, uma
> vez só.

---

## O que ele faz

- **Emite comprovante numerado** (`124-2026-000001`) com dízimo, oferta ou os
  dois no mesmo documento. O total é sempre a soma dos itens — nunca digitado.
- **Gera PDF e imagem** do mesmo desenho que você confere na tela, prontos para
  o WhatsApp (1080 × 1350, o formato que o aplicativo não corta).
- **Mantém a relação de membros**, com importação da lista que a igreja já tem
  em CSV ou XLSX, busca sem acento, aviso de nome duplicado e o registro
  permanente **NÃO IDENTIFICADO**.
- **Fecha o mês sozinho**: a relação nominal de dizimistas é derivada dos
  lançamentos, então ela não tem como divergir do total de dízimos. Seis
  conferências rodam a cada abertura do relatório e mostram a diferença exata
  se algo não bater.
- **Funciona sem internet** no meio do culto: o lançamento fica guardado no
  aparelho, marcado como não enviado, e sobe sozinho quando a conexão volta —
  sem gerar dois números para o mesmo comprovante.
- **Não apaga nada.** Erro se corrige cancelando (com motivo) e reemitindo. O
  original fica no histórico e sai dos totais.

## Como está montado

| Camada | Escolha | Por quê |
|---|---|---|
| Interface | React 18 + TypeScript + Tailwind | telas grandes, poucos campos por etapa |
| Banco e login | Supabase (PostgreSQL) | Row Level Security de verdade, plano gratuito suficiente |
| Dinheiro | centavos inteiros no app, `numeric(14,2)` no banco | ponto flutuante erra centavo; aqui não existe essa chance |
| Comprovante | um renderizador em canvas | a tela, o PNG e o PDF saem do mesmo código: não têm como divergir |
| Offline | IndexedDB | fila de rascunhos com chave de idempotência |
| Instalação | PWA (vite-plugin-pwa) | instala no Android e no iPhone sem loja de aplicativos |

### Onde fica cada coisa

```
src/
  domain/      regras do negócio — totais, conferências, tipos
  lib/         dinheiro, datas, texto, planilhas, IndexedDB
  render/      desenho do comprovante, PNG/PDF, compartilhamento
  data/        todas as consultas ao banco
  state/       sessão, configurações da igreja, fila offline
  pages/       as sete telas
  components/  peças reaproveitadas
supabase/
  migrations/  0001 a 0005 — rode nesta ordem no SQL Editor
  tests/       bateria de testes do banco (só ambiente local)
tools/         pré-visualização do comprovante e verificações
docs/          instalação, backup, publicação, segurança
```

## Comandos

```bash
npm install
npm run dev          # desenvolvimento
npm run verificar    # tipos + testes + compilação (rode antes de publicar)
npm run build        # gera a pasta dist/
npm test             # só os testes
```

Para olhar o comprovante sem emitir nada, com `npm run dev` rodando:

- `/tools/preview-comprovante.html` — quatro exemplos de layout, inclusive um
  cancelado e um com nome longo
- `/tools/verificar-arquivos.html` — gera o PNG e o PDF de verdade e confere

## O que já foi testado

**No banco** (`supabase/tests/01_cenarios.sql`, contra PostgreSQL 16): 53
verificações — os seis cenários de fechamento, a numeração sequencial sem
repetição, a imutabilidade do comprovante emitido, a proteção do NÃO
IDENTIFICADO, a impossibilidade de apagar membro com histórico, a idempotência
do rascunho offline e o que cada perfil de acesso enxerga.

**No aplicativo** (`npm test`): 20 testes dos cenários A a F, da aritmética em
centavos, da leitura de valores digitados e do valor por extenso.

**No navegador** (`npm run e2e`): abertura sem erro, rota interna protegida,
manifesto instalável, service worker ativo, e a geração real do PNG
(1080 × 1350) e do PDF.

## Limites conhecidos

- **O WhatsApp não aceita anexo por link.** O botão "Enviar pelo WhatsApp" abre
  a conversa com a mensagem pronta; para mandar a imagem, use "Compartilhar" e
  escolha o WhatsApp — aí o arquivo vai junto.
- **Instalar pelo iPhone exige o Safari.** No Chrome do iPhone não aparece a
  opção "Adicionar à Tela de Início".
- **Rascunho offline não entra em relatório.** É proposital: sem número oficial,
  não é comprovante.
- **O comprovante não é documento fiscal** e não serve para dedução de imposto.

## O que vem depois

A estrutura já está preparada para o fechamento mensal completo da igreja —
conciliação com o extrato bancário, despesas e os percentuais de repasse —
usando estes mesmos lançamentos como entrada.
