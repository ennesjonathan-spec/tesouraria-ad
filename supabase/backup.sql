-- =====================================================================
-- Backup manual — rode no SQL Editor do Supabase e baixe o resultado
-- de cada consulta em CSV (botão "Download CSV").
-- Guarde os cinco arquivos juntos, na mesma pasta, com a data no nome.
-- =====================================================================

-- 1) Comprovantes com os totais
select r.numero_comprovante, r.nome_exibido, r.data_recebimento, r.hora_recebimento,
       r.competencia, r.forma_recebimento, r.status, r.motivo_cancelamento,
       t.total_dizimo, t.total_oferta, t.total_geral, r.observacao, r.created_at
  from public.receipts r
  join public.receipt_totals t on t.id = r.id
 order by r.numero_comprovante;

-- 2) Itens, linha a linha (é daqui que sai todo relatório)
select r.numero_comprovante, i.tipo, i.subcategoria, i.valor, i.observacao
  from public.receipt_items i
  join public.receipts r on r.id = i.receipt_id
 order by r.numero_comprovante, i.created_at;

-- 3) Membros
select nome_completo, telefone, observacao, ativo, registro_especial, created_at
  from public.members
 order by nome_completo;

-- 4) Configurações da igreja
select * from public.church_settings;

-- 5) Usuários e perfis de acesso
select nome, email, perfil, ativo, created_at from public.profiles order by nome;
