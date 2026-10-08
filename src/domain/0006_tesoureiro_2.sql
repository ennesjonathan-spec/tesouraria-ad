-- Adiciona o 2º tesoureiro aos dados da igreja (aparece nos comprovantes).
-- Pode rodar mais de uma vez sem problema.
alter table public.church_settings
  add column if not exists tesoureiro_2 text not null default '';

update public.church_settings
   set tesoureiro   = 'Jonathan Ennes Pereira',
       tesoureiro_2 = 'Maria José Machado Lemos',
       updated_at   = now()
 where id = 1;

notify pgrst, 'reload schema';
