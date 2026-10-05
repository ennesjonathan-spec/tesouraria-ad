-- =====================================================================
-- Bateria de testes dos cenários A a F e das regras de segurança.
-- Roda contra um Postgres local com o stub de auth/storage.
-- Qualquer falha aborta com "FALHOU".
-- =====================================================================
\set ON_ERROR_STOP on
set client_min_messages = notice;

create or replace function pg_temp.ok(cond boolean, msg text)
returns void language plpgsql as $$
begin
  if cond then raise notice 'OK    %', msg;
  else raise exception 'FALHOU  %', msg; end if;
end $$;

create or replace function pg_temp.login(p_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id::text, false);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.virar_postgres() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set local role postgres';
end $$;

-- ---------------------------------------------------------------------
do $$
declare
  v_admin uuid; v_oper uuid; v_cons uuid;
  v_nao_id uuid; v_m1 uuid; v_m2 uuid; v_m3 uuid;
  rA public.receipts; rB public.receipts; rC public.receipts; rD public.receipts; rE public.receipts;
  v_tot numeric; v_rel jsonb; v_cnt int;
begin
  -- Usuários: o primeiro vira admin pelo trigger de auth.users
  insert into auth.users (email, raw_user_meta_data)
    values ('tesoureiro@igreja.local', '{"nome":"Jonathan (teste)"}') returning id into v_admin;
  insert into auth.users (email, raw_user_meta_data)
    values ('operador@igreja.local', '{"nome":"Operador (teste)"}') returning id into v_oper;
  insert into auth.users (email, raw_user_meta_data)
    values ('consulta@igreja.local', '{"nome":"Consulta (teste)"}') returning id into v_cons;

  perform pg_temp.ok(
    (select perfil from public.profiles where id = v_admin) = 'admin',
    'O primeiro usuário da instalação entra como admin');
  perform pg_temp.ok(
    (select perfil from public.profiles where id = v_oper) = 'consulta',
    'Usuários seguintes entram como consulta, sem acesso financeiro');

  -- A partir daqui atuamos como o tesoureiro logado.
  perform pg_temp.login(v_admin);
  update public.profiles set perfil = 'operador' where id = v_oper;
  update public.profiles set perfil = 'consulta' where id = v_cons;
  perform pg_temp.ok((select perfil from public.profiles where id = v_oper) = 'operador',
    'Admin promove um usuário a operador');

  select id into v_nao_id from public.members where registro_especial;
  perform pg_temp.ok(v_nao_id is not null, 'Registro NÃO IDENTIFICADO existe após o seed');

  -- =============== CENÁRIO A: só dízimo, R$ 250,00 ===================
  insert into public.members (nome_completo, telefone)
    values ('Maria Aparecida de Teste', '62999990001') returning id into v_m1;
  insert into public.members (nome_completo)
    values ('José Carlos de Teste') returning id into v_m2;

  rA := public.emitir_comprovante(
    v_m1, date '2026-10-04', time '19:30', '10/2026', 'PIX',
    '[{"tipo":"dizimo","valor":"250.00"}]'::jsonb);

  select total_geral into v_tot from public.receipt_totals where id = rA.id;
  perform pg_temp.ok(v_tot = 250.00, 'Cenário A — total do comprovante é R$ 250,00');
  perform pg_temp.ok(
    (select total_oferta from public.receipt_totals where id = rA.id) = 0,
    'Cenário A — não gera linha de oferta');
  perform pg_temp.ok(rA.numero_comprovante = '124-2026-000001',
    'Cenário A — numeração começa em 124-2026-000001');

  -- =============== CENÁRIO B: dízimo 300 + oferta 50 =================
  rB := public.emitir_comprovante(
    v_m2, date '2026-10-04', time '19:35', '10/2026', 'Dinheiro',
    '[{"tipo":"dizimo","valor":"300.00"},
      {"tipo":"oferta","subcategoria":"Oferta de culto","valor":"50.00"}]'::jsonb);

  perform pg_temp.ok(
    (select total_geral from public.receipt_totals where id = rB.id) = 350.00,
    'Cenário B — total é R$ 350,00');
  perform pg_temp.ok(
    (select count(*) from public.receipt_items where receipt_id = rB.id) = 2,
    'Cenário B — as duas linhas ficam separadas no comprovante');
  perform pg_temp.ok(rB.numero_comprovante = '124-2026-000002',
    'Cenário B — numeração sequencial sem repetição');

  -- =============== CENÁRIO C: NÃO IDENTIFICADO, oferta 93 ============
  rC := public.emitir_comprovante(
    v_nao_id, date '2026-10-04', time '19:40', '10/2026', 'Dinheiro',
    '[{"tipo":"oferta","subcategoria":"Oferta de culto","valor":"93.00"}]'::jsonb);
  perform pg_temp.ok(
    (select total_geral from public.receipt_totals where id = rC.id) = 93.00,
    'Cenário C — oferta não identificada de R$ 93,00');
  perform pg_temp.ok(
    (select nao_identificado from public.receipt_totals where id = rC.id),
    'Cenário C — comprovante marcado como não identificado');
  perform pg_temp.ok(rC.nome_exibido = 'NÃO IDENTIFICADO',
    'Cenário C — nome exibido gravado no momento da emissão');

  -- =============== CENÁRIO E: membro criado no lançamento ============
  insert into public.members (nome_completo) values ('Novo Irmão de Teste') returning id into v_m3;
  rE := public.emitir_comprovante(
    v_m3, date '2026-10-04', time '19:45', '10/2026', 'Transferência bancária',
    '[{"tipo":"dizimo","valor":"120.50"}]'::jsonb);
  perform pg_temp.ok(
    (select total_geral from public.receipt_totals where id = rE.id) = 120.50,
    'Cenário E — membro cadastrado durante o lançamento já emite comprovante');

  -- =============== CENÁRIO D: cancelamento ===========================
  rD := public.emitir_comprovante(
    v_m1, date '2026-10-04', time '19:50', '10/2026', 'PIX',
    '[{"tipo":"dizimo","valor":"999.99"}]'::jsonb);
  perform public.cancelar_comprovante(rD.id, 'Valor digitado errado durante o culto.');

  perform pg_temp.ok(
    (select status from public.receipts where id = rD.id) = 'cancelado',
    'Cenário D — comprovante fica com status cancelado');
  perform pg_temp.ok(
    exists (select 1 from public.receipts where id = rD.id),
    'Cenário D — o original permanece no histórico');
  perform pg_temp.ok(
    (select motivo_cancelamento from public.receipts where id = rD.id) is not null,
    'Cenário D — o motivo do cancelamento fica registrado');

  v_rel := public.relatorio_mensal('10/2026');
  perform pg_temp.ok((v_rel ->> 'qtd_cancelados')::int = 1,
    'Cenário D — cancelado aparece separado no relatório');
  perform pg_temp.ok(
    (v_rel ->> 'total_dizimos')::numeric = 670.50,
    'Cenário D — cancelado NÃO entra no total de dízimos (250 + 300 + 120,50)');

  -- reemissão corrigida, amarrada ao cancelado
  rD := public.emitir_comprovante(
    v_m1, date '2026-10-04', time '19:52', '10/2026', 'PIX',
    '[{"tipo":"dizimo","valor":"99.99"}]'::jsonb, 'Reemissão do 124-2026-000005',
    null, rD.id);
  perform pg_temp.ok(rD.receipt_original_id is not null,
    'Cenário D — o novo comprovante aponta para o cancelado');

  -- =============== CENÁRIO F: conferências do fechamento =============
  v_rel := public.relatorio_mensal('10/2026');

  perform pg_temp.ok(
    (select coalesce(sum((e ->> 'total')::numeric), 0)
       from jsonb_array_elements(v_rel -> 'dizimistas') e)
    = (v_rel ->> 'total_dizimos')::numeric,
    'Cenário F — soma da relação nominal de dízimos = total de dízimos (diferença R$ 0,00)');

  perform pg_temp.ok(
    (select coalesce(sum((e ->> 'total')::numeric), 0)
       from jsonb_array_elements(v_rel -> 'ofertantes') e)
    = (v_rel ->> 'total_ofertas')::numeric,
    'Cenário F — soma das ofertas por pessoa = total de ofertas');

  perform pg_temp.ok(
    (v_rel ->> 'total_dizimos')::numeric + (v_rel ->> 'total_ofertas')::numeric
    = (v_rel ->> 'total_geral')::numeric,
    'Cenário F — dízimos + ofertas = total geral');

  perform pg_temp.ok(
    (select coalesce(sum(v::numeric), 0) from jsonb_each_text(v_rel -> 'por_forma') as t(k, v))
    = (v_rel ->> 'total_geral')::numeric,
    'Cenário F — dinheiro + PIX + transferência + outras = total geral');

  perform pg_temp.ok(
    (v_rel ->> 'identificado')::numeric + (v_rel ->> 'nao_identificado')::numeric
    = (v_rel ->> 'total_geral')::numeric,
    'Cenário F — identificados + não identificados = total geral');

  perform pg_temp.ok((v_rel ->> 'total_geral')::numeric = 913.49,
    'Cenário F — total geral do mês de teste fecha em R$ 913,49');

  raise notice '--- validações de integridade e segurança ---';

  -- Valor zero ou negativo
  begin
    perform public.emitir_comprovante(v_m1, current_date, time '10:00', '10/2026', 'PIX',
      '[{"tipo":"dizimo","valor":"0"}]'::jsonb);
    raise exception 'FALHOU  valor zero deveria ser recusado';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform pg_temp.ok(true, 'Valor zero é recusado');
  end;
  begin
    perform public.emitir_comprovante(v_m1, current_date, time '10:00', '10/2026', 'PIX',
      '[{"tipo":"dizimo","valor":"-5.00"}]'::jsonb);
    raise exception 'FALHOU  valor negativo deveria ser recusado';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform pg_temp.ok(true, 'Valor negativo é recusado');
  end;

  -- Comprovante sem itens
  begin
    perform public.emitir_comprovante(v_m1, current_date, time '10:00', '10/2026', 'PIX',
      '[]'::jsonb);
    raise exception 'FALHOU  comprovante sem item deveria ser recusado';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform pg_temp.ok(true, 'Comprovante sem nenhum item é recusado');
  end;

  -- Competência fora do formato
  begin
    perform public.emitir_comprovante(v_m1, current_date, time '10:00', '2026-10', 'PIX',
      '[{"tipo":"dizimo","valor":"10.00"}]'::jsonb);
    raise exception 'FALHOU  competência inválida deveria ser recusada';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform pg_temp.ok(true, 'Competência fora do formato MM/AAAA é recusada');
  end;

  -- Imutabilidade
  begin
    update public.receipts set nome_exibido = 'Outro Nome' where id = rA.id;
    raise exception 'FALHOU  edição de comprovante deveria ser bloqueada';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform pg_temp.ok(true, 'Comprovante confirmado não pode ser editado');
  end;
  begin
    update public.receipt_items set valor = 1.00 where receipt_id = rA.id;
    raise exception 'FALHOU  edição de item deveria ser bloqueada';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform pg_temp.ok(true, 'Item de comprovante emitido não pode ser alterado');
  end;
  begin
    delete from public.receipts where id = rA.id;
    raise exception 'FALHOU  exclusão de comprovante deveria ser bloqueada';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform pg_temp.ok(true, 'Comprovante não pode ser excluído');
  end;

  -- NÃO IDENTIFICADO protegido
  begin
    update public.members set nome_completo = 'Anônimo' where id = v_nao_id;
    raise exception 'FALHOU  renomear NÃO IDENTIFICADO deveria ser bloqueado';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform pg_temp.ok(true, 'NÃO IDENTIFICADO não pode ser renomeado');
  end;
  begin
    update public.members set ativo = false where id = v_nao_id;
    raise exception 'FALHOU  inativar NÃO IDENTIFICADO deveria ser bloqueado';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform pg_temp.ok(true, 'NÃO IDENTIFICADO não pode ser inativado');
  end;
  begin
    delete from public.members where id = v_nao_id;
    raise exception 'FALHOU  excluir NÃO IDENTIFICADO deveria ser bloqueado';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform pg_temp.ok(true, 'NÃO IDENTIFICADO não pode ser excluído');
  end;

  -- Membro com histórico é inativado, não excluído
  begin
    delete from public.members where id = v_m1;
    raise exception 'FALHOU  exclusão de membro com histórico deveria ser bloqueada';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform pg_temp.ok(true, 'Membro com comprovantes não pode ser excluído, só inativado');
  end;
  update public.members set ativo = false where id = v_m2;
  perform pg_temp.ok((select not ativo from public.members where id = v_m2),
    'Membro pode ser inativado preservando o histórico');

  -- Idempotência do rascunho offline
  declare v_cu uuid := gen_random_uuid(); r1 public.receipts; r2 public.receipts;
  begin
    r1 := public.emitir_comprovante(v_m1, date '2026-10-05', time '09:00', '10/2026', 'PIX',
            '[{"tipo":"oferta","valor":"10.00"}]'::jsonb, null, v_cu);
    r2 := public.emitir_comprovante(v_m1, date '2026-10-05', time '09:00', '10/2026', 'PIX',
            '[{"tipo":"oferta","valor":"10.00"}]'::jsonb, null, v_cu);
    perform pg_temp.ok(r1.id = r2.id and r1.numero_comprovante = r2.numero_comprovante,
      'Rascunho offline reenviado não gera segundo número oficial');
  end;

  raise notice '--- perfis de acesso ---';

  -- Operador: emite, mas não cancela
  perform pg_temp.login(v_oper);
  declare rOp public.receipts;
  begin
    rOp := public.emitir_comprovante(v_m3, date '2026-10-05', time '10:00', '10/2026', 'Dinheiro',
             '[{"tipo":"oferta","valor":"25.00"}]'::jsonb);
    perform pg_temp.ok(rOp.created_by = v_oper, 'Operador consegue emitir comprovante');
    begin
      perform public.cancelar_comprovante(rOp.id, 'tentativa indevida de cancelamento');
      raise exception 'FALHOU  operador não deveria cancelar';
    exception when others then
      if sqlerrm like 'FALHOU%' then raise; end if;
      perform pg_temp.ok(true, 'Operador não pode cancelar comprovante');
    end;
    -- Operador só vê os próprios comprovantes
    select count(*) into v_cnt from public.receipts;
    perform pg_temp.ok(v_cnt = 1, 'Operador vê apenas os comprovantes que ele emitiu');
  end;

  -- Consulta: lê tudo, não lança
  perform pg_temp.login(v_cons);
  select count(*) into v_cnt from public.receipts;
  perform pg_temp.ok(v_cnt >= 7, 'Perfil consulta lê todos os comprovantes para conferência');
  begin
    perform public.emitir_comprovante(v_m3, current_date, time '11:00', '10/2026', 'PIX',
      '[{"tipo":"dizimo","valor":"1.00"}]'::jsonb);
    raise exception 'FALHOU  perfil consulta não deveria emitir';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform pg_temp.ok(true, 'Perfil consulta não pode emitir comprovante');
  end;
  begin
    insert into public.members (nome_completo) values ('Tentativa Indevida');
    raise exception 'FALHOU  perfil consulta não deveria cadastrar membro';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform pg_temp.ok(true, 'Perfil consulta não pode cadastrar membro');
  end;
  select count(*) into v_cnt from public.audit_logs;
  perform pg_temp.ok(v_cnt = 0, 'Perfil consulta não lê o registro de auditoria');

  -- Usuário inativado perde acesso (o admin é quem inativa)
  perform pg_temp.login(v_admin);
  update public.profiles set ativo = false where id = v_cons;
  perform pg_temp.login(v_cons);
  select count(*) into v_cnt from public.receipts;
  perform pg_temp.ok(v_cnt = 0, 'Usuário inativado não vê nenhum dado financeiro');
  select count(*) into v_cnt from public.members;
  perform pg_temp.ok(v_cnt = 0, 'Usuário inativado não vê a relação de membros');

  -- Visitante sem login (anon) não vê nada
  execute 'set local role anon';
  begin
    select count(*) into v_cnt from public.members;
    raise exception 'FALHOU  anon não deveria ler members';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform pg_temp.ok(true, 'Visitante sem login não acessa a relação de membros');
  end;
  begin
    select count(*) into v_cnt from public.receipts;
    raise exception 'FALHOU  anon não deveria ler receipts';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform pg_temp.ok(true, 'Visitante sem login não acessa comprovantes');
  end;

  -- Auditoria registrou tudo
  perform pg_temp.virar_postgres();
  select count(*) into v_cnt from public.audit_logs;
  perform pg_temp.ok(v_cnt > 20, format('Auditoria registrou %s eventos', v_cnt));

  raise notice '';
  raise notice '=========================================';
  raise notice ' TODOS OS CENÁRIOS PASSARAM';
  raise notice '=========================================';
end $$;
