-- =====================================================================
-- 0004_storage.sql — bucket do logo da igreja.
-- Público para leitura (o logo aparece no comprovante), gravação
-- restrita a admin. Nenhum outro arquivo vai para este bucket.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('igreja', 'igreja', true, 2097152,
        array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/png','image/jpeg','image/webp','image/svg+xml'];

drop policy if exists igreja_leitura on storage.objects;
create policy igreja_leitura on storage.objects
  for select using (bucket_id = 'igreja');

drop policy if exists igreja_admin_insert on storage.objects;
create policy igreja_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'igreja' and public.sou_admin());

drop policy if exists igreja_admin_update on storage.objects;
create policy igreja_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'igreja' and public.sou_admin());

drop policy if exists igreja_admin_delete on storage.objects;
create policy igreja_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'igreja' and public.sou_admin());
