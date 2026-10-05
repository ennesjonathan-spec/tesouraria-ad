-- =====================================================================
-- Tesouraria AD Balneário Central — 0001_schema.sql
-- Estrutura de dados. Rode no SQL Editor do Supabase na ordem 0001 -> 0005.
--
-- Valores monetários usam numeric(14,2). NUNCA float/real/double:
-- ponto flutuante binário não representa 0,01 exatamente e produz
-- diferenças de centavos nos fechamentos.
-- =====================================================================

create extension if not exists "pgcrypto";
-- No Supabase a extensão costuma ser instalada no schema "extensions"; aqui ela precisa
-- ficar no schema public (o dicionário public.unaccent é usado pela função abaixo).
drop extension if exists "unaccent" cascade;
create extension "unaccent" with schema public;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
do $$ begin
  create type perfil_acesso as enum ('admin', 'operador', 'consulta');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_lancamento as enum ('dizimo', 'oferta');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_comprovante as enum ('valido', 'cancelado');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- profiles — 1:1 com auth.users
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nome        text not null check (length(btrim(nome)) > 0),
  email       text not null,
  perfil      perfil_acesso not null default 'consulta',
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.profiles is 'Usuários do app e seu perfil de acesso. O perfil só pode ser alterado por admin.';

-- ---------------------------------------------------------------------
-- church_settings — linha única (singleton)
-- ---------------------------------------------------------------------
create table if not exists public.church_settings (
  id                 smallint primary key default 1 check (id = 1),
  nome_igreja        text not null,
  congregacao        text not null,
  codigo             text not null,
  endereco           text not null,
  dirigente          text not null,
  tesoureiro         text not null,
  logo_url           text,
  versiculo_rodape   text not null default 'Deus ama quem dá com alegria.',
  versiculo_ref      text not null default '2 Coríntios 9:7',
  aviso_rodape       text not null default 'Comprovante emitido pela tesouraria para registro e confirmação da entrega.',
  prefixo_comprovante text not null default '124',
  cores_do_layout    jsonb not null default
    '{"primaria":"#0f2a4a","secundaria":"#ffffff","destaque":"#bd9336","texto":"#13202e"}'::jsonb,
  subcategorias_oferta text[] not null default array[
    'Oferta de culto','Oferta via PIX','Oferta missionária','Oferta da Santa Ceia',
    'Escola Bíblica Dominical — EBD','Campanha','Outra'],
  formas_recebimento   text[] not null default array[
    'Dinheiro','PIX','Transferência bancária','Outra'],
  updated_at         timestamptz not null default now()
);
comment on table public.church_settings is 'Dados da igreja e do layout do comprovante. Nada disso fica fixo no código do app.';

-- ---------------------------------------------------------------------
-- members
-- ---------------------------------------------------------------------
create table if not exists public.members (
  id                uuid primary key default gen_random_uuid(),
  nome_completo     text not null check (length(btrim(nome_completo)) > 0),
  telefone          text,
  observacao        text,
  ativo             boolean not null default true,
  registro_especial boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on column public.members.registro_especial is
  'true apenas para NÃO IDENTIFICADO. Registro protegido: não pode ser excluído, renomeado nem inativado.';

-- Busca tolerante a acentuação e caixa.
-- unaccent() não é marcada immutable pelo Postgres; embrulhamos para poder indexar.
create or replace function public.unaccent_imm(txt text)
returns text language sql immutable parallel safe as $$
  select public.unaccent('public.unaccent'::regdictionary, txt)
$$;

create or replace function public.nome_busca(txt text)
returns text language sql immutable parallel safe as $$
  select lower(public.unaccent_imm(coalesce(txt, '')))
$$;

create index if not exists members_nome_busca_idx on public.members (public.nome_busca(nome_completo));
create index if not exists members_ativo_idx on public.members (ativo) where ativo;
-- Só pode existir um registro especial.
create unique index if not exists members_registro_especial_unico
  on public.members ((registro_especial)) where registro_especial;

-- ---------------------------------------------------------------------
-- receipts
-- ---------------------------------------------------------------------
create table if not exists public.receipts (
  id                   uuid primary key default gen_random_uuid(),
  numero_comprovante   text not null unique,
  member_id            uuid not null references public.members (id) on delete restrict,
  nome_exibido         text not null check (length(btrim(nome_exibido)) > 0),
  data_recebimento     date not null,
  hora_recebimento     time not null,
  competencia          char(7) not null check (competencia ~ '^(0[1-9]|1[0-2])/[0-9]{4}$'),
  forma_recebimento    text not null check (length(btrim(forma_recebimento)) > 0),
  observacao           text,
  status               status_comprovante not null default 'valido',
  motivo_cancelamento  text,
  cancelado_em         timestamptz,
  cancelado_por        uuid references public.profiles (id),
  receipt_original_id  uuid references public.receipts (id) on delete set null,
  client_uuid          uuid unique,
  created_by           uuid not null references public.profiles (id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint cancelamento_coerente check (
    (status = 'valido'    and motivo_cancelamento is null and cancelado_em is null) or
    (status = 'cancelado' and length(btrim(motivo_cancelamento)) > 0 and cancelado_em is not null)
  )
);
comment on column public.receipts.nome_exibido is
  'Nome no momento da emissão. Preservado mesmo que o cadastro do membro seja corrigido depois.';
comment on column public.receipts.client_uuid is
  'Chave de idempotência gerada no celular. Impede que um rascunho offline reenviado gere dois números oficiais.';

create index if not exists receipts_competencia_idx on public.receipts (competencia);
create index if not exists receipts_data_idx on public.receipts (data_recebimento desc);
create index if not exists receipts_member_idx on public.receipts (member_id);
create index if not exists receipts_status_idx on public.receipts (status);
create index if not exists receipts_nome_busca_idx on public.receipts (public.nome_busca(nome_exibido));

-- ---------------------------------------------------------------------
-- receipt_items
-- ---------------------------------------------------------------------
create table if not exists public.receipt_items (
  id            uuid primary key default gen_random_uuid(),
  receipt_id    uuid not null references public.receipts (id) on delete cascade,
  tipo          tipo_lancamento not null,
  subcategoria  text,
  valor         numeric(14,2) not null check (valor > 0),
  observacao    text,
  created_at    timestamptz not null default now()
);
comment on column public.receipt_items.valor is
  'numeric(14,2) e estritamente > 0. O total do comprovante é sempre a soma destes itens — nunca um campo digitado.';

create index if not exists receipt_items_receipt_idx on public.receipt_items (receipt_id);
create index if not exists receipt_items_tipo_idx on public.receipt_items (tipo);

-- ---------------------------------------------------------------------
-- receipt_counters — numeração sequencial por prefixo e ano
-- ---------------------------------------------------------------------
create table if not exists public.receipt_counters (
  prefixo     text not null,
  ano         smallint not null,
  ultimo      integer not null default 0 check (ultimo >= 0),
  primary key (prefixo, ano)
);

-- ---------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------
create table if not exists public.audit_logs (
  id               bigserial primary key,
  usuario          uuid references public.profiles (id),
  usuario_email    text,
  acao             text not null,
  tabela_afetada   text not null,
  registro_afetado text,
  dados_anteriores jsonb,
  dados_novos      jsonb,
  data_e_hora      timestamptz not null default now()
);
create index if not exists audit_logs_data_idx on public.audit_logs (data_e_hora desc);
create index if not exists audit_logs_registro_idx on public.audit_logs (tabela_afetada, registro_afetado);

-- ---------------------------------------------------------------------
-- View de conferência: um comprovante por linha, já totalizado.
-- É a fonte única dos relatórios — não existe lista mensal paralela.
-- ---------------------------------------------------------------------
create or replace view public.receipt_totals as
select
  r.id,
  r.numero_comprovante,
  r.member_id,
  r.nome_exibido,
  r.data_recebimento,
  r.hora_recebimento,
  r.competencia,
  r.forma_recebimento,
  r.status,
  r.observacao,
  r.receipt_original_id,
  r.created_at,
  m.registro_especial as nao_identificado,
  coalesce(sum(i.valor) filter (where i.tipo = 'dizimo'), 0)::numeric(14,2) as total_dizimo,
  coalesce(sum(i.valor) filter (where i.tipo = 'oferta'), 0)::numeric(14,2) as total_oferta,
  coalesce(sum(i.valor), 0)::numeric(14,2)                                  as total_geral,
  count(i.id)                                                               as qtd_itens
from public.receipts r
join public.members m on m.id = r.member_id
left join public.receipt_items i on i.receipt_id = r.id
group by r.id, m.registro_especial;
