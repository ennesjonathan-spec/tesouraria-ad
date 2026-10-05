-- =====================================================================
-- 0002_functions.sql — numeração, emissão atômica, cancelamento,
-- auditoria e gatilhos de integridade.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers de perfil (usados pelas policies e pelas funções)
-- ---------------------------------------------------------------------
create or replace function public.meu_perfil()
returns perfil_acesso language sql stable security definer set search_path = public as $$
  select p.perfil from public.profiles p where p.id = auth.uid() and p.ativo
$$;

create or replace function public.sou_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_perfil() = 'admin', false)
$$;

create or replace function public.pode_lancar()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_perfil() in ('admin', 'operador'), false)
$$;

create or replace function public.esta_ativo()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.ativo)
$$;

-- ---------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists touch_profiles on public.profiles;
create trigger touch_profiles before update on public.profiles
  for each row execute function public.tg_touch_updated_at();

drop trigger if exists touch_members on public.members;
create trigger touch_members before update on public.members
  for each row execute function public.tg_touch_updated_at();

drop trigger if exists touch_receipts on public.receipts;
create trigger touch_receipts before update on public.receipts
  for each row execute function public.tg_touch_updated_at();

drop trigger if exists touch_settings on public.church_settings;
create trigger touch_settings before update on public.church_settings
  for each row execute function public.tg_touch_updated_at();

-- ---------------------------------------------------------------------
-- Novo usuário do Auth ganha um profile automaticamente.
-- O primeiro usuário da instalação entra como admin; os demais, como
-- 'consulta' — um admin promove depois na tela de Usuários.
-- ---------------------------------------------------------------------
create or replace function public.tg_on_auth_user_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ja_existe boolean;
begin
  select exists (select 1 from public.profiles) into ja_existe;
  insert into public.profiles (id, nome, email, perfil, ativo)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
    new.email,
    case when ja_existe then 'consulta'::perfil_acesso else 'admin'::perfil_acesso end,
    true
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.tg_on_auth_user_created();

-- ---------------------------------------------------------------------
-- Protege o registro NÃO IDENTIFICADO
-- ---------------------------------------------------------------------
create or replace function public.tg_protege_registro_especial()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.registro_especial then
      raise exception 'O registro NÃO IDENTIFICADO não pode ser excluído.';
    end if;
    return old;
  end if;

  if old.registro_especial then
    if new.nome_completo is distinct from old.nome_completo then
      raise exception 'O registro NÃO IDENTIFICADO não pode ser renomeado.';
    end if;
    if new.ativo is distinct from true then
      raise exception 'O registro NÃO IDENTIFICADO não pode ser inativado.';
    end if;
    if new.registro_especial is distinct from true then
      raise exception 'A marcação de registro especial não pode ser removida.';
    end if;
  elsif new.registro_especial then
    raise exception 'Não é permitido criar outro registro especial.';
  end if;
  return new;
end $$;

drop trigger if exists protege_registro_especial on public.members;
create trigger protege_registro_especial before update or delete on public.members
  for each row execute function public.tg_protege_registro_especial();

-- Membro com histórico financeiro é inativado, nunca excluído.
create or replace function public.tg_impede_exclusao_com_historico()
returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.receipts r where r.member_id = old.id) then
    raise exception 'Este cadastro possui comprovantes emitidos. Inative-o em vez de excluir.';
  end if;
  return old;
end $$;

drop trigger if exists impede_exclusao_com_historico on public.members;
create trigger impede_exclusao_com_historico before delete on public.members
  for each row execute function public.tg_impede_exclusao_com_historico();

-- ---------------------------------------------------------------------
-- Comprovante confirmado é imutável, exceto o ato de cancelar.
-- ---------------------------------------------------------------------
create or replace function public.tg_receipts_imutavel()
returns trigger language plpgsql as $$
begin
  if old.status = 'cancelado' then
    raise exception 'Comprovante já cancelado não pode ser alterado.';
  end if;
  if new.numero_comprovante  is distinct from old.numero_comprovante
  or new.member_id           is distinct from old.member_id
  or new.nome_exibido        is distinct from old.nome_exibido
  or new.data_recebimento    is distinct from old.data_recebimento
  or new.hora_recebimento    is distinct from old.hora_recebimento
  or new.competencia         is distinct from old.competencia
  or new.forma_recebimento   is distinct from old.forma_recebimento
  or new.observacao          is distinct from old.observacao
  or new.created_by          is distinct from old.created_by
  or new.created_at          is distinct from old.created_at
  or new.client_uuid         is distinct from old.client_uuid then
    raise exception
      'Um comprovante confirmado não pode ser editado. Cancele-o com o motivo e emita um novo corrigido.';
  end if;
  return new;
end $$;

drop trigger if exists receipts_imutavel on public.receipts;
create trigger receipts_imutavel before update on public.receipts
  for each row execute function public.tg_receipts_imutavel();

create or replace function public.tg_bloqueia_delete()
returns trigger language plpgsql as $$
begin
  raise exception 'Registros financeiros não são excluídos. Use o cancelamento, que preserva o histórico.';
end $$;

drop trigger if exists receipts_sem_delete on public.receipts;
create trigger receipts_sem_delete before delete on public.receipts
  for each row execute function public.tg_bloqueia_delete();

-- Itens não mudam depois que o comprovante existe.
create or replace function public.tg_items_imutavel()
returns trigger language plpgsql as $$
begin
  raise exception
    'Os itens de um comprovante emitido não podem ser alterados nem excluídos. '
    'Cancele o comprovante e emita um novo corrigido.';
end $$;

drop trigger if exists items_imutavel on public.receipt_items;
create trigger items_imutavel before update or delete on public.receipt_items
  for each row execute function public.tg_items_imutavel();

-- Não se acrescenta item a um comprovante já cancelado.
create or replace function public.tg_items_sem_cancelado()
returns trigger language plpgsql as $$
declare st status_comprovante;
begin
  select status into st from public.receipts where id = new.receipt_id;
  if st is null then
    raise exception 'Comprovante não encontrado para este item.';
  end if;
  if st = 'cancelado' then
    raise exception 'Não é possível incluir itens em um comprovante cancelado.';
  end if;
  return new;
end $$;

drop trigger if exists items_sem_cancelado on public.receipt_items;
create trigger items_sem_cancelado before insert on public.receipt_items
  for each row execute function public.tg_items_sem_cancelado();

-- ---------------------------------------------------------------------
-- Numeração sequencial atômica: 124-2026-000001
-- O UPDATE ... RETURNING trava a linha do contador, então duas emissões
-- simultâneas nunca recebem o mesmo número.
-- ---------------------------------------------------------------------
create or replace function public.proximo_numero_comprovante(p_ano smallint default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_prefixo text;
  v_ano     smallint;
  v_seq     integer;
begin
  select prefixo_comprovante into v_prefixo from public.church_settings where id = 1;
  v_prefixo := coalesce(nullif(btrim(v_prefixo), ''), '000');
  v_ano := coalesce(p_ano, extract(year from (now() at time zone 'America/Sao_Paulo'))::smallint);

  insert into public.receipt_counters (prefixo, ano, ultimo)
  values (v_prefixo, v_ano, 1)
  on conflict (prefixo, ano) do update set ultimo = public.receipt_counters.ultimo + 1
  returning ultimo into v_seq;

  return v_prefixo || '-' || v_ano::text || '-' || lpad(v_seq::text, 6, '0');
end $$;

-- ---------------------------------------------------------------------
-- Emissão do comprovante — uma transação, tudo ou nada.
-- Recebe os itens como jsonb: [{"tipo":"dizimo","subcategoria":null,"valor":"250.00"}]
-- p_client_uuid é a chave de idempotência do rascunho offline.
-- ---------------------------------------------------------------------
create or replace function public.emitir_comprovante(
  p_member_id        uuid,
  p_data_recebimento date,
  p_hora_recebimento time,
  p_competencia      text,
  p_forma            text,
  p_itens            jsonb,
  p_observacao       text default null,
  p_client_uuid      uuid default null,
  p_original_id      uuid default null
) returns public.receipts language plpgsql security definer set search_path = public as $$
declare
  v_receipt public.receipts;
  v_nome    text;
  v_num     text;
  v_qtd     integer;
  v_item    jsonb;
  v_valor   numeric(14,2);
begin
  if not public.pode_lancar() then
    raise exception 'Seu perfil não tem permissão para registrar recebimentos.';
  end if;

  -- Idempotência: o mesmo rascunho reenviado devolve o comprovante já criado.
  if p_client_uuid is not null then
    select * into v_receipt from public.receipts where client_uuid = p_client_uuid;
    if found then return v_receipt; end if;
  end if;

  select nome_completo into v_nome from public.members where id = p_member_id;
  if v_nome is null then
    raise exception 'Membro não encontrado.';
  end if;

  if jsonb_typeof(p_itens) <> 'array' then
    raise exception 'A lista de itens é inválida.';
  end if;
  v_qtd := jsonb_array_length(p_itens);
  if v_qtd = 0 then
    raise exception 'Informe pelo menos um valor de dízimo ou oferta.';
  end if;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_valor := (v_item ->> 'valor')::numeric(14,2);
    if v_valor is null or v_valor <= 0 then
      raise exception 'Todos os valores devem ser maiores que zero.';
    end if;
    if (v_item ->> 'tipo') not in ('dizimo', 'oferta') then
      raise exception 'O tipo do item deve ser dízimo ou oferta.';
    end if;
  end loop;

  v_num := public.proximo_numero_comprovante(
             extract(year from p_data_recebimento)::smallint);

  insert into public.receipts (
    numero_comprovante, member_id, nome_exibido, data_recebimento, hora_recebimento,
    competencia, forma_recebimento, observacao, client_uuid, receipt_original_id, created_by)
  values (
    v_num, p_member_id, v_nome, p_data_recebimento, p_hora_recebimento,
    p_competencia, p_forma, nullif(btrim(p_observacao), ''), p_client_uuid, p_original_id, auth.uid())
  returning * into v_receipt;

  insert into public.receipt_items (receipt_id, tipo, subcategoria, valor, observacao)
  select
    v_receipt.id,
    (e ->> 'tipo')::tipo_lancamento,
    nullif(btrim(e ->> 'subcategoria'), ''),
    (e ->> 'valor')::numeric(14,2),
    nullif(btrim(e ->> 'observacao'), '')
  from jsonb_array_elements(p_itens) e;

  return v_receipt;
end $$;

-- ---------------------------------------------------------------------
-- Cancelamento (somente admin) — preserva o original no histórico.
-- ---------------------------------------------------------------------
create or replace function public.cancelar_comprovante(p_id uuid, p_motivo text)
returns public.receipts language plpgsql security definer set search_path = public as $$
declare v_receipt public.receipts;
begin
  if not public.sou_admin() then
    raise exception 'Somente o administrador/tesoureiro pode cancelar um comprovante.';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Informe o motivo do cancelamento.';
  end if;

  update public.receipts
     set status = 'cancelado',
         motivo_cancelamento = btrim(p_motivo),
         cancelado_em = now(),
         cancelado_por = auth.uid()
   where id = p_id and status = 'valido'
  returning * into v_receipt;

  if not found then
    raise exception 'Comprovante não encontrado ou já cancelado.';
  end if;
  return v_receipt;
end $$;

-- ---------------------------------------------------------------------
-- Auditoria genérica
-- ---------------------------------------------------------------------
create or replace function public.tg_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_id    text;
begin
  select email into v_email from public.profiles where id = auth.uid();
  v_id := coalesce(
    (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id',
    '');

  insert into public.audit_logs (
    usuario, usuario_email, acao, tabela_afetada, registro_afetado,
    dados_anteriores, dados_novos)
  values (
    auth.uid(), v_email, tg_op, tg_table_name, v_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end);

  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists audit_members on public.members;
create trigger audit_members after insert or update or delete on public.members
  for each row execute function public.tg_audit();

drop trigger if exists audit_receipts on public.receipts;
create trigger audit_receipts after insert or update on public.receipts
  for each row execute function public.tg_audit();

drop trigger if exists audit_items on public.receipt_items;
create trigger audit_items after insert on public.receipt_items
  for each row execute function public.tg_audit();

drop trigger if exists audit_profiles on public.profiles;
create trigger audit_profiles after insert or update on public.profiles
  for each row execute function public.tg_audit();

drop trigger if exists audit_settings on public.church_settings;
create trigger audit_settings after update on public.church_settings
  for each row execute function public.tg_audit();

-- ---------------------------------------------------------------------
-- Relatório mensal calculado no banco (segunda opinião sobre o cálculo
-- do app: a tela confere um contra o outro).
-- ---------------------------------------------------------------------
create or replace function public.relatorio_mensal(p_competencia text)
returns jsonb language sql stable security definer set search_path = public as $$
  with validos as (
    select * from public.receipt_totals
     where competencia = p_competencia and status = 'valido'
  ),
  itens as (
    select i.tipo, i.subcategoria, i.valor, v.forma_recebimento, v.nome_exibido, v.nao_identificado
      from public.receipt_items i
      join validos v on v.id = i.receipt_id
  )
  select jsonb_build_object(
    'competencia', p_competencia,
    'total_dizimos', (select coalesce(sum(valor), 0) from itens where tipo = 'dizimo'),
    'total_ofertas', (select coalesce(sum(valor), 0) from itens where tipo = 'oferta'),
    'total_geral',   (select coalesce(sum(valor), 0) from itens),
    'qtd_comprovantes', (select count(*) from validos),
    'qtd_cancelados', (select count(*) from public.receipt_totals
                        where competencia = p_competencia and status = 'cancelado'),
    'por_forma', (select coalesce(jsonb_object_agg(forma_recebimento, soma), '{}'::jsonb)
                    from (select forma_recebimento, sum(valor) soma from itens
                           group by forma_recebimento) t),
    'por_subcategoria', (select coalesce(jsonb_object_agg(chave, soma), '{}'::jsonb)
                    from (select coalesce(subcategoria, '(sem subcategoria)') chave,
                                 sum(valor) soma from itens where tipo = 'oferta'
                           group by 1) t),
    'identificado',     (select coalesce(sum(valor), 0) from itens where not nao_identificado),
    'nao_identificado', (select coalesce(sum(valor), 0) from itens where nao_identificado),
    'dizimistas', (select coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'total', soma)
                            order by nome), '[]'::jsonb)
                    from (select nome_exibido nome, sum(valor) soma from itens
                           where tipo = 'dizimo' group by 1) t),
    'ofertantes', (select coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'total', soma)
                            order by nome), '[]'::jsonb)
                    from (select nome_exibido nome, sum(valor) soma from itens
                           where tipo = 'oferta' group by 1) t)
  )
$$;
