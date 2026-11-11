-- =====================================================================
-- Permissões das tabelas para usuários logados (papel authenticated).
--
-- Projetos novos do Supabase não liberam mais as tabelas do schema public
-- automaticamente. Sem isto, o painel recebe "permission denied" ao ler.
-- Quem vê/grava o quê continua controlado pelo RLS (20261109000002_seguranca).
-- =====================================================================

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
