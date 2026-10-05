# Testes do banco

`01_cenarios.sql` roda 51 verificações contra um PostgreSQL de verdade: os seis
cenários do fechamento (A a F), as regras de integridade e o que cada perfil de
acesso enxerga.

**Não rode nada desta pasta no Supabase.** Ela cria usuários e comprovantes de
teste. É só para um banco local descartável.

## Como rodar

Com PostgreSQL 14 ou mais novo instalado:

```bash
createdb tesouraria_teste

psql -d tesouraria_teste -v ON_ERROR_STOP=1 -f supabase/tests/00_stub_supabase.sql
psql -d tesouraria_teste -v ON_ERROR_STOP=1 -f supabase/migrations/0001_schema.sql
psql -d tesouraria_teste -v ON_ERROR_STOP=1 -f supabase/migrations/0002_functions.sql
psql -d tesouraria_teste -v ON_ERROR_STOP=1 -f supabase/migrations/0003_rls.sql
psql -d tesouraria_teste -v ON_ERROR_STOP=1 -f supabase/migrations/0004_storage.sql
psql -d tesouraria_teste -v ON_ERROR_STOP=1 -f supabase/migrations/0005_seed.sql

psql -d tesouraria_teste -v ON_ERROR_STOP=1 -f supabase/tests/01_cenarios.sql
```

Cada verificação imprime `OK` com a descrição. Qualquer falha interrompe a
execução com `FALHOU` e a mensagem correspondente.

`00_stub_supabase.sql` imita o mínimo do Supabase que o schema precisa
(os schemas `auth` e `storage`, a função `auth.uid()` e os papéis `anon` e
`authenticated`). No Supabase real isso tudo já existe.

Depois de rodar, descarte o banco:

```bash
dropdb tesouraria_teste
```
