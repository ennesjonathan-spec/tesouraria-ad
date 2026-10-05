-- =====================================================================
-- 0003_rls.sql — Row Level Security.
-- Regra geral: sem profile ativo, o usuário não lê nada.
-- Nenhuma tabela é legível por anon.
-- =====================================================================

alter table public.profiles         enable row level security;
alter table public.church_settings  enable row level security;
alter table public.members          enable row level security;
alter table public.receipts         enable row level security;
alter table public.receipt_items    enable row level security;
alter table public.receipt_counters enable row level security;
alter table public.audit_logs       enable row level security;

-- Forçar RLS inclusive para o dono das tabelas evita surpresa em scripts.
alter table public.receipts      force row level security;
alter table public.receipt_items force row level security;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.sou_admin());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Só admin mexe em perfil/ativo de terceiros.
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.sou_admin())
  with check (public.sou_admin());

-- Impede que o usuário comum promova a si mesmo.
create or replace function public.tg_profiles_sem_autopromocao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.sou_admin() then return new; end if;
  if new.perfil is distinct from old.perfil or new.ativo is distinct from old.ativo then
    raise exception 'Somente o administrador pode alterar perfil de acesso ou situação do usuário.';
  end if;
  return new;
end $$;

drop trigger if exists profiles_sem_autopromocao on public.profiles;
create trigger profiles_sem_autopromocao before update on public.profiles
  for each row execute function public.tg_profiles_sem_autopromocao();

-- ---------------------------------------------------------------------
-- church_settings — todo usuário ativo lê (o comprovante precisa);
-- só admin edita.
-- ---------------------------------------------------------------------
drop policy if exists settings_read on public.church_settings;
create policy settings_read on public.church_settings
  for select to authenticated using (public.esta_ativo());

drop policy if exists settings_admin_write on public.church_settings;
create policy settings_admin_write on public.church_settings
  for update to authenticated
  using (public.sou_admin()) with check (public.sou_admin());

-- ---------------------------------------------------------------------
-- members — admin e operador consultam e cadastram; consulta só lê.
-- Ninguém exclui pela API (o trigger de histórico também barra).
-- ---------------------------------------------------------------------
drop policy if exists members_read on public.members;
create policy members_read on public.members
  for select to authenticated using (public.esta_ativo());

drop policy if exists members_insert on public.members;
create policy members_insert on public.members
  for insert to authenticated with check (public.pode_lancar());

drop policy if exists members_update on public.members;
create policy members_update on public.members
  for update to authenticated
  using (public.pode_lancar()) with check (public.pode_lancar());

drop policy if exists members_delete on public.members;
create policy members_delete on public.members
  for delete to authenticated using (public.sou_admin());

-- ---------------------------------------------------------------------
-- receipts
-- O operador vê os comprovantes que ele mesmo emitiu; admin e consulta
-- veem todos (consulta é um perfil de conferência/relatório).
-- ---------------------------------------------------------------------
drop policy if exists receipts_read on public.receipts;
create policy receipts_read on public.receipts
  for select to authenticated
  using (
    public.sou_admin()
    or public.meu_perfil() = 'consulta'
    or (public.meu_perfil() = 'operador' and created_by = auth.uid())
  );

-- A emissão passa pela função emitir_comprovante (security definer).
-- Mantemos o insert direto permitido a quem pode lançar, sempre em
-- nome do próprio usuário.
drop policy if exists receipts_insert on public.receipts;
create policy receipts_insert on public.receipts
  for insert to authenticated
  with check (public.pode_lancar() and created_by = auth.uid());

drop policy if exists receipts_update_admin on public.receipts;
create policy receipts_update_admin on public.receipts
  for update to authenticated
  using (public.sou_admin()) with check (public.sou_admin());

-- Sem policy de DELETE: nenhum perfil apaga comprovante.

-- ---------------------------------------------------------------------
-- receipt_items — segue a visibilidade do comprovante pai.
-- ---------------------------------------------------------------------
drop policy if exists items_read on public.receipt_items;
create policy items_read on public.receipt_items
  for select to authenticated
  using (exists (select 1 from public.receipts r where r.id = receipt_id));

drop policy if exists items_insert on public.receipt_items;
create policy items_insert on public.receipt_items
  for insert to authenticated
  with check (
    public.pode_lancar()
    and exists (select 1 from public.receipts r
                 where r.id = receipt_id and r.created_by = auth.uid())
  );

-- ---------------------------------------------------------------------
-- receipt_counters — ninguém toca direto; só a função de numeração,
-- que é security definer.
-- ---------------------------------------------------------------------
drop policy if exists counters_admin_read on public.receipt_counters;
create policy counters_admin_read on public.receipt_counters
  for select to authenticated using (public.sou_admin());

-- ---------------------------------------------------------------------
-- audit_logs — leitura só do admin; escrita só pelos triggers.
-- ---------------------------------------------------------------------
drop policy if exists audit_admin_read on public.audit_logs;
create policy audit_admin_read on public.audit_logs
  for select to authenticated using (public.sou_admin());

-- ---------------------------------------------------------------------
-- A view receipt_totals roda com os direitos de quem consulta
-- (security_invoker), então herda as policies de receipts.
-- ---------------------------------------------------------------------
alter view public.receipt_totals set (security_invoker = on);

-- ---------------------------------------------------------------------
-- Permissões de execução
-- ---------------------------------------------------------------------
revoke all on function public.emitir_comprovante(uuid, date, time, text, text, jsonb, text, uuid, uuid) from public, anon;
revoke all on function public.cancelar_comprovante(uuid, text) from public, anon;
revoke all on function public.proximo_numero_comprovante(smallint) from public, anon;
revoke all on function public.relatorio_mensal(text) from public, anon;

grant execute on function public.emitir_comprovante(uuid, date, time, text, text, jsonb, text, uuid, uuid) to authenticated;
grant execute on function public.cancelar_comprovante(uuid, text) to authenticated;
grant execute on function public.relatorio_mensal(text) to authenticated;
grant execute on function public.meu_perfil() to authenticated;

-- ---------------------------------------------------------------------
-- Privilégios de tabela. O Supabase concede isso por padrão, mas deixar
-- explícito evita depender de default privileges e documenta a intenção:
-- anon (visitante sem login) não tem acesso a nada.
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

grant select                         on public.church_settings  to authenticated;
grant update                         on public.church_settings  to authenticated;
grant select, insert, update         on public.profiles         to authenticated;
grant select, insert, update, delete on public.members          to authenticated;
grant select, insert, update         on public.receipts         to authenticated;
grant select, insert                 on public.receipt_items    to authenticated;
grant select                         on public.receipt_counters  to authenticated;
grant select                         on public.audit_logs       to authenticated;
grant select                         on public.receipt_totals   to authenticated;
grant usage, select on all sequences in schema public to authenticated;
