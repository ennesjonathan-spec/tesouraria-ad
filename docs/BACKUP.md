# Backup e restauração

Os dados ficam no banco do Supabase, não no celular. Perder o aparelho não
perde nada. O que você precisa é de uma cópia que não dependa do Supabase.

## O que é feito sozinho

O plano gratuito do Supabase mantém backup automático diário dos últimos dias.
Nos planos pagos a janela é maior. Isso cobre acidente, não arquivamento.

## Backup mensal recomendado (5 minutos, depois do fechamento)

### Pelo aplicativo — o mais simples

1. **Relatórios** → escolha a competência → **XLSX**.
   Esse arquivo traz o resumo, a relação nominal de dizimistas e de ofertantes,
   as formas de recebimento, as subcategorias, os cancelados e as conferências.
2. **Membros** → **Exportar XLSX**.
3. Guarde os dois arquivos numa pasta do Drive, com o nome do mês.

### Pelo Supabase — cópia completa

1. Abra **SQL Editor** → **New query**.
2. Cole e execute uma consulta por vez do arquivo `supabase/backup.sql`.
3. Em cada resultado, clique em **Download CSV**.
4. Guarde os cinco arquivos juntos, numa pasta com a data.

### Cópia integral do banco (para quem tem o `psql` instalado)

```bash
pg_dump "postgresql://postgres:SUA_SENHA@db.SEU_PROJETO.supabase.co:5432/postgres" \
  --schema=public --no-owner --no-privileges \
  --file=tesouraria-$(date +%Y-%m-%d).sql
```

A senha é a que você definiu ao criar o projeto. Esse arquivo contém **todos**
os dados dos membros — trate como documento sigiloso, conforme a LGPD.

## Restauração

**Perdi um comprovante específico.** Não existe exclusão no sistema: nenhum
comprovante some. Se ele foi cancelado, está no histórico com o filtro
"Cancelados".

**Preciso voltar o banco inteiro.** No Supabase, **Database** → **Backups** →
escolha a data → **Restore**. Isso desfaz tudo o que veio depois daquele ponto.

**Vou recomeçar num projeto novo.** Rode as cinco migrations no projeto novo e
importe os CSVs pelo **Table Editor** → **Insert** → **Import data from CSV**,
nesta ordem: `members`, `profiles`, `receipts`, `receipt_items`. A ordem importa
por causa das referências entre as tabelas.

## O que NÃO fazer

- Não guarde a chave `service_role` em lugar nenhum fora do painel do Supabase.
- Não mande o arquivo do `pg_dump` por WhatsApp ou e-mail sem proteção: ele tem
  nome e telefone de todos os membros.
- Não apague membros direto no banco. O aplicativo impede, e com razão: apagar
  um membro com histórico quebraria os comprovantes já emitidos.
