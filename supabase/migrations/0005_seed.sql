-- =====================================================================
-- 0005_seed.sql — dados iniciais reais da congregação e o registro
-- permanente NÃO IDENTIFICADO.
--
-- Nenhum nome de membro é criado aqui. A relação de dizimistas vem da
-- importação CSV/XLSX feita por você na tela "Membros e contribuintes".
-- =====================================================================

insert into public.church_settings (
  id, nome_igreja, congregacao, codigo, endereco, dirigente, tesoureiro, prefixo_comprovante)
values (
  1,
  'Igreja Evangélica Assembleia de Deus',
  'Congregação Balneário Central',
  '124',
  'Av. Márcio G. da Silva, Qd. B, Lt. 20, Jd. Balneário Meia Ponte, Goiânia/GO',
  'Pedro João Alves da Silva Filho',
  'Jonathan Ennenes Pereira',
  '124')
on conflict (id) do nothing;

insert into public.members (nome_completo, registro_especial, ativo, observacao)
select 'NÃO IDENTIFICADO', true, true,
       'Registro permanente do sistema. Use quando a pessoa não quiser se identificar '
       'ou quando o valor recebido não tiver identificação.'
where not exists (select 1 from public.members where registro_especial);
