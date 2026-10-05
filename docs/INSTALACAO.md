# Instalação — passo a passo

Tempo estimado: 20 a 30 minutos, uma única vez.
Você vai precisar de: um computador, uma conta no Google ou GitHub e o celular.

---

## 1. Criar o banco de dados no Supabase

1. Acesse `https://supabase.com` e crie uma conta (o plano gratuito atende bem o
   volume da congregação).
2. Clique em **New project**.
   - **Name**: `tesouraria-ad-124`
   - **Database Password**: gere uma senha forte e **guarde**. Você só vai
     precisar dela se for restaurar um backup.
   - **Region**: `South America (São Paulo)`.
3. Espere o projeto terminar de ser criado (uns 2 minutos).

## 2. Criar as tabelas

No menu lateral, abra **SQL Editor** → **New query**. Cole e execute **um
arquivo por vez, nesta ordem**, esperando aparecer "Success" antes do próximo:

1. `supabase/migrations/0001_schema.sql` — tabelas e a view de totais
2. `supabase/migrations/0002_functions.sql` — numeração, emissão, cancelamento, auditoria
3. `supabase/migrations/0003_rls.sql` — as regras de quem vê o quê
4. `supabase/migrations/0004_storage.sql` — o espaço do logo
5. `supabase/migrations/0005_seed.sql` — dados da igreja e o registro NÃO IDENTIFICADO

> Não rode `supabase/tests/`. Aquilo é só para o ambiente de teste local.

Para conferir: menu **Table Editor**. Devem existir `profiles`, `church_settings`,
`members`, `receipts`, `receipt_items`, `receipt_counters` e `audit_logs`. Em
`members` já deve haver uma linha: **NÃO IDENTIFICADO**.

## 3. Ajustar a autenticação

Menu **Authentication** → **Providers** → **Email**:

- **Enable Email provider**: ligado.
- **Confirm email**: pode desligar, para os usuários entrarem direto. Se deixar
  ligado, cada pessoa precisa clicar no link que chega por e-mail.

Menu **Authentication** → **URL Configuration**: em **Site URL**, coloque o
endereço do app depois que você publicar (passo 5). Pode voltar aqui depois.

## 4. Pegar as duas chaves

Menu **Project Settings** → **API** (ou **Data API**). Copie:

- **Project URL** → algo como `https://abcdefgh.supabase.co`
- **anon public** → uma chave longa

> A chave `service_role` **não** entra neste aplicativo. Ela ignora todas as
> permissões do banco. Se alguém pedir essa chave, desconfie.

## 5. Publicar o aplicativo

### Opção A — Vercel (a mais simples)

1. Suba esta pasta para um repositório no GitHub (pode ser privado).
2. Acesse `https://vercel.com`, **Add New** → **Project**, e escolha o repositório.
3. Em **Environment Variables**, adicione as duas:
   - `VITE_SUPABASE_URL` = o Project URL do passo 4
   - `VITE_SUPABASE_ANON_KEY` = a chave anon public
4. **Deploy**. Em ~1 minuto você recebe um endereço `https://....vercel.app`.

### Opção B — Netlify

Mesmo caminho: conecte o repositório, defina as duas variáveis em
**Site configuration → Environment variables** e publique. O arquivo
`netlify.toml` já vem pronto.

### Opção C — rodar no seu computador (para testar)

```bash
cp .env.example .env     # preencha as duas chaves
npm install
npm run dev              # abre em http://localhost:5173
```

> Para instalar no celular, o endereço precisa ser **https**. Por isso a
> publicação na Vercel/Netlify é o caminho normal.

Depois de publicar, volte ao Supabase em **Authentication → URL Configuration**
e coloque o endereço publicado em **Site URL**.

## 6. Criar o seu usuário

1. Abra o endereço publicado no computador.
2. No Supabase, menu **Authentication** → **Users** → **Add user** →
   **Create new user**. Informe seu e-mail e uma senha, e marque
   **Auto Confirm User**.
3. Volte ao aplicativo e entre com esse e-mail e senha.

> **O primeiro usuário criado vira Administrador/Tesoureiro automaticamente.**
> Todos os seguintes entram como **Consulta**, e você libera o perfil de cada um
> em **Configurações → Usuários** dentro do app.

## 7. Instalar no celular

**Android (Chrome):** abra o endereço, toque nos três pontinhos →
**Adicionar à tela inicial** → **Instalar**.

**iPhone (Safari — precisa ser o Safari):** abra o endereço, toque no botão de
compartilhar (quadrado com seta) → **Adicionar à Tela de Início**.

O ícone fica junto dos outros aplicativos e abre em tela cheia, sem a barra do
navegador.

## 8. Primeiros ajustes dentro do app

1. **Configurações** → confira os dados da igreja e envie a logo.
2. **Membros e contribuintes** → **Importar lista**: suba a relação que a igreja
   já mantém, em CSV ou XLSX. O app encontra sozinho a coluna de nome e a de
   telefone, mostra uma prévia e só grava depois que você confirmar.
3. **Novo comprovante** → faça um lançamento de teste e cancele em seguida, para
   ver o fluxo inteiro.

---

## Perguntas comuns

**Preciso pagar alguma coisa?** O plano gratuito do Supabase e da Vercel atende
com folga o volume de uma congregação. O Supabase pausa projetos gratuitos sem
uso por uma semana; basta entrar no painel para religar.

**E se eu trocar de celular?** Nada se perde: os dados ficam no banco, não no
aparelho. Instale o app no celular novo e entre com o mesmo e-mail e senha.

**Dá para usar em mais de um celular ao mesmo tempo?** Sim. Crie um usuário para
cada pessoa e dê o perfil adequado.
