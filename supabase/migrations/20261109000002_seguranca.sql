-- =====================================================================
-- Painel de Vendas Evaldo: regras de acesso (Row Level Security)
--
-- Regra atual: só usuários logados com papel 'gestao' em public.perfis leem
-- e gravam. Usuário sem perfil, ou não logado, não vê nada.
-- Perfis são criados/alterados só pelo painel do Supabase (não pelo app).
-- =====================================================================

-- O usuário logado é da gestão?
-- security definer: consulta perfis sem depender do RLS de perfis (evita recursão).
create or replace function public.eh_gestao()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis p
    where p.id = (select auth.uid()) and p.papel = 'gestao'
  );
$$;

-- ---------------------------------------------------------------------
-- Visitante não logado (papel anon) não tem acesso a nenhuma tabela nem função.
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon, public;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon, public;

grant execute on function public.eh_gestao() to authenticated;
grant execute on function public.tocar_atualizado_em() to authenticated;
grant execute on function public.registrar_contato() to authenticated;

-- ---------------------------------------------------------------------
-- RLS ativo em todas as tabelas
-- ---------------------------------------------------------------------
alter table public.perfis                enable row level security;
alter table public.vendedores            enable row level security;
alter table public.clientes              enable row level security;
alter table public.relatorios_importados enable row level security;
alter table public.vendas_cliente_mes    enable row level security;
alter table public.metas                 enable row level security;
alter table public.contatos_clientes     enable row level security;
alter table public.relatorios_produtos   enable row level security;
alter table public.vendas_produto_mes    enable row level security;

-- perfis: cada um lê o próprio; a gestão lê todos. Ninguém altera pelo app.
create policy perfis_leitura on public.perfis
  for select to authenticated
  using (id = (select auth.uid()) or (select public.eh_gestao()));

-- Demais tabelas: gestão lê e grava tudo.
create policy gestao_tudo on public.vendedores
  for all to authenticated
  using ((select public.eh_gestao())) with check ((select public.eh_gestao()));

create policy gestao_tudo on public.clientes
  for all to authenticated
  using ((select public.eh_gestao())) with check ((select public.eh_gestao()));

create policy gestao_tudo on public.relatorios_importados
  for all to authenticated
  using ((select public.eh_gestao())) with check ((select public.eh_gestao()));

create policy gestao_tudo on public.vendas_cliente_mes
  for all to authenticated
  using ((select public.eh_gestao())) with check ((select public.eh_gestao()));

create policy gestao_tudo on public.metas
  for all to authenticated
  using ((select public.eh_gestao())) with check ((select public.eh_gestao()));

-- Histórico de contatos: gestão lê e acrescenta; não edita nem apaga o histórico.
create policy gestao_leitura on public.contatos_clientes
  for select to authenticated
  using ((select public.eh_gestao()));
create policy gestao_inclusao on public.contatos_clientes
  for insert to authenticated
  with check ((select public.eh_gestao()));

create policy gestao_tudo on public.relatorios_produtos
  for all to authenticated
  using ((select public.eh_gestao())) with check ((select public.eh_gestao()));

create policy gestao_tudo on public.vendas_produto_mes
  for all to authenticated
  using ((select public.eh_gestao())) with check ((select public.eh_gestao()));

-- =====================================================================
-- FUTURO: acesso dos vendedores (NÃO ATIVO)
--
-- Para liberar, crie uma nova migration com o conteúdo abaixo (sem os "--").
-- O vendedor vê só as linhas com o código dele; não vê metas de outros,
-- não importa relatórios e não vê perfis de outras pessoas.
-- =====================================================================
--
-- create or replace function public.meu_vendedor_codigo()
-- returns text
-- language sql
-- stable
-- security definer
-- set search_path = ''
-- as $$
--   select p.vendedor_codigo from public.perfis p
--   where p.id = (select auth.uid()) and p.papel = 'vendedor';
-- $$;
-- grant execute on function public.meu_vendedor_codigo() to authenticated;
--
-- create policy vendedor_leitura on public.vendedores
--   for select to authenticated
--   using (codigo = (select public.meu_vendedor_codigo()));
--
-- create policy vendedor_leitura on public.relatorios_importados
--   for select to authenticated
--   using (vendedor_codigo = (select public.meu_vendedor_codigo()));
--
-- create policy vendedor_leitura on public.vendas_cliente_mes
--   for select to authenticated
--   using (vendedor_codigo = (select public.meu_vendedor_codigo()));
--
-- create policy vendedor_leitura on public.metas
--   for select to authenticated
--   using (vendedor_codigo = (select public.meu_vendedor_codigo()));
--
-- create policy vendedor_leitura on public.relatorios_produtos
--   for select to authenticated
--   using (vendedor_codigo = (select public.meu_vendedor_codigo()));
--
-- create policy vendedor_leitura on public.vendas_produto_mes
--   for select to authenticated
--   using (vendedor_codigo = (select public.meu_vendedor_codigo()));
--
-- -- Clientes: os que compraram dele em algum mês.
-- create policy vendedor_leitura on public.clientes
--   for select to authenticated
--   using (exists (
--     select 1 from public.vendas_cliente_mes v
--     where v.cliente_codigo = clientes.codigo
--       and v.vendedor_codigo = (select public.meu_vendedor_codigo())
--   ));
--
-- -- Se o vendedor puder anotar contatos dos próprios clientes:
-- create policy vendedor_contato on public.clientes
--   for update to authenticated
--   using (exists (
--     select 1 from public.vendas_cliente_mes v
--     where v.cliente_codigo = clientes.codigo
--       and v.vendedor_codigo = (select public.meu_vendedor_codigo())
--   ))
--   with check (true);
-- create policy vendedor_leitura on public.contatos_clientes
--   for select to authenticated
--   using (vendedor_codigo = (select public.meu_vendedor_codigo()));
-- create policy vendedor_inclusao on public.contatos_clientes
--   for insert to authenticated
--   with check (vendedor_codigo = (select public.meu_vendedor_codigo()));
