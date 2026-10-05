# Publicar uma nova versão

## Como funciona

A Vercel (ou a Netlify) observa o repositório no GitHub. Cada envio para o ramo
principal gera uma publicação nova automaticamente.

```bash
git add .
git commit -m "ajuste no comprovante"
git push
```

Em um ou dois minutos o endereço já serve a versão nova.

## O que acontece no celular de quem já instalou

O aplicativo guarda os arquivos para funcionar sem internet. Quando há versão
nova, ela é baixada em segundo plano e **entra na próxima vez que o app for
aberto** — nunca no meio de um lançamento. Não é preciso reinstalar.

Se alguém jurar que está vendo a versão antiga: feche o aplicativo por completo
(não só minimizar) e abra de novo.

## Antes de publicar, rode a verificação

```bash
npm run verificar     # tipos + testes + compilação
```

Os testes cobrem os seis cenários do fechamento. Se algum falhar, a conta de
algum mês vai sair errada — não publique.

Para olhar o layout do comprovante sem emitir nada:

```bash
npm run dev
# abra /tools/preview-comprovante.html   (quatro exemplos de layout)
# abra /tools/verificar-arquivos.html    (gera PNG e PDF de verdade)
```

## Mudanças no banco

Alterações de estrutura são arquivos novos em `supabase/migrations/`, numerados
em sequência (`0006_...sql`), executados no SQL Editor. **Não edite uma migration
que já rodou** — o banco não sabe desfazer o que já aplicou.

Para testar antes, use um projeto Supabase separado de rascunho.

## Trocar o endereço do aplicativo

Se mudar o domínio, atualize no Supabase: **Authentication** → **URL
Configuration** → **Site URL** e **Redirect URLs**.
