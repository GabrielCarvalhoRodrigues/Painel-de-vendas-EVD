-- =====================================================================
-- Painel de Vendas Evaldo: estrutura do banco
-- Tabelas, índices e gatilhos. As regras de acesso (RLS) ficam em
-- 20261109000002_seguranca.sql e a importação em 20261109000003_importacao.sql.
-- =====================================================================

-- Mês de referência no formato AAAA-MM (ex.: 2026-10), o mesmo que o painel usa.
create domain public.mes_ref as text
  check (value ~ '^\d{4}-(0[1-9]|1[0-2])$');

-- Mantém a coluna atualizado_em sempre em dia.
create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- vendedores: cadastro dos vendedores do ERP.
-- O nome vem do relatório na primeira importação e pode ser editado no painel
-- (reimportar não sobrescreve o nome editado).
-- ---------------------------------------------------------------------
create table public.vendedores (
  codigo        text primary key check (codigo <> ''),   -- código no ERP, ex.: '004'
  nome          text not null,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- perfis: um por usuário do login (auth.users).
-- papel 'gestao' vê tudo; 'vendedor' (futuro) verá só os próprios dados.
-- ---------------------------------------------------------------------
create table public.perfis (
  id              uuid primary key references auth.users (id) on delete cascade,
  nome            text not null,
  papel           text not null check (papel in ('gestao', 'vendedor')),
  vendedor_codigo text references public.vendedores (codigo),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  -- gestão não tem código de vendedor; vendedor precisa ter.
  constraint perfis_papel_vendedor check (
    (papel = 'gestao' and vendedor_codigo is null)
    or (papel = 'vendedor' and vendedor_codigo is not null)
  )
);

-- ---------------------------------------------------------------------
-- clientes: cadastro dos clientes do ERP + dados de contato do painel.
-- vendedor_codigo = último vendedor que vendeu para o cliente (atualizado na
-- importação). O mesmo cliente pode comprar de vários vendedores; o histórico
-- completo está em vendas_cliente_mes.
-- ---------------------------------------------------------------------
create table public.clientes (
  codigo          text primary key check (codigo <> ''),  -- texto, mantém zeros à esquerda
  nome            text not null default '',
  telefone        text,
  observacoes     text,                                    -- anotação atual do cliente
  status_contato  text not null default 'nao_contatado'
                  check (status_contato in ('nao_contatado', 'contatado', 'recuperado')),
  vendedor_codigo text references public.vendedores (codigo),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
create index clientes_vendedor_idx on public.clientes (vendedor_codigo);

-- ---------------------------------------------------------------------
-- relatorios_importados: um relatório "VENDAS POR MARK-UP" por vendedor e mês.
-- id = 'vendedor-mes' (ex.: '004-2026-10'): reimportar o mesmo período substitui.
-- ---------------------------------------------------------------------
create table public.relatorios_importados (
  id              text primary key,
  vendedor_codigo text not null references public.vendedores (codigo),
  vendedor_nome   text not null default '',        -- nome como veio no arquivo
  mes             public.mes_ref not null,
  data_inicial    date not null,
  data_final      date not null,
  parcial         boolean not null default false,  -- mês ainda incompleto
  empresa         text not null default '',
  nome_arquivo    text not null default '',
  importado_por   uuid default auth.uid() references auth.users (id) on delete set null,
  importado_em    timestamptz not null default now(),
  qtd_clientes    integer not null default 0,
  total_vendido   numeric(14,2) not null default 0,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  constraint relatorios_importados_id_ck check (id = vendedor_codigo || '-' || mes),
  constraint relatorios_importados_periodo_ck check (
    data_final >= data_inicial and to_char(data_inicial, 'YYYY-MM') = mes
  ),
  constraint relatorios_importados_unico unique (vendedor_codigo, mes)
);
create index relatorios_importados_mes_idx on public.relatorios_importados (mes);

-- ---------------------------------------------------------------------
-- vendas_cliente_mes: uma linha por cliente no relatório (cliente × vendedor × mês).
-- Apagar o relatório apaga as linhas dele.
-- ---------------------------------------------------------------------
create table public.vendas_cliente_mes (
  relatorio_id    text not null references public.relatorios_importados (id) on delete cascade,
  vendedor_codigo text not null references public.vendedores (codigo),
  mes             public.mes_ref not null,
  cliente_codigo  text not null references public.clientes (codigo),
  prazo_medio     numeric(8,2)  not null default 0,
  qtd_vendas      numeric(12,2) not null default 0,
  qtde            numeric(14,3) not null default 0,
  valor_total     numeric(14,2) not null default 0,  -- pode ser negativo (devolução)
  valor_custo     numeric(14,2) not null default 0,
  resultado       numeric(14,2) not null default 0,
  primary key (relatorio_id, cliente_codigo)
);
create index vendas_cliente_mes_vendedor_mes_idx on public.vendas_cliente_mes (vendedor_codigo, mes);
create index vendas_cliente_mes_mes_idx on public.vendas_cliente_mes (mes);
create index vendas_cliente_mes_cliente_idx on public.vendas_cliente_mes (cliente_codigo, mes);

-- ---------------------------------------------------------------------
-- metas: meta de faturamento do vendedor no mês.
-- (A regra "vale para os meses seguintes até mudar" continua no painel.)
-- ---------------------------------------------------------------------
create table public.metas (
  vendedor_codigo text not null references public.vendedores (codigo),
  mes             public.mes_ref not null,
  valor           numeric(14,2) not null check (valor >= 0),
  atualizado_por  uuid default auth.uid() references auth.users (id) on delete set null,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  primary key (vendedor_codigo, mes)
);
create index metas_mes_idx on public.metas (mes);

-- ---------------------------------------------------------------------
-- contatos_clientes: histórico de contatos (status e anotações), com data e autor.
-- Preenchido automaticamente quando o status ou a anotação do cliente muda.
-- ---------------------------------------------------------------------
create table public.contatos_clientes (
  id              bigint generated always as identity primary key,
  cliente_codigo  text not null references public.clientes (codigo) on delete cascade,
  vendedor_codigo text references public.vendedores (codigo),
  status          text not null check (status in ('nao_contatado', 'contatado', 'recuperado')),
  anotacao        text,
  autor           uuid default auth.uid() references auth.users (id) on delete set null,
  criado_em       timestamptz not null default now()
);
create index contatos_clientes_cliente_idx on public.contatos_clientes (cliente_codigo, criado_em desc);
create index contatos_clientes_vendedor_idx on public.contatos_clientes (vendedor_codigo);

-- ---------------------------------------------------------------------
-- relatorios_produtos: relatório "Movimento de clientes" (produtos vendidos),
-- um registro por vendedor e mês. Mesmo esquema de id: 'vendedor-mes'.
-- ---------------------------------------------------------------------
create table public.relatorios_produtos (
  id              text primary key,
  vendedor_codigo text not null references public.vendedores (codigo),
  vendedor_nome   text not null default '',
  mes             public.mes_ref not null,
  data_inicial    date not null,
  data_final      date not null,
  parcial         boolean not null default false,
  nome_arquivo    text not null default '',
  importado_por   uuid default auth.uid() references auth.users (id) on delete set null,
  importado_em    timestamptz not null default now(),
  qtd_produtos    integer not null default 0,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  constraint relatorios_produtos_id_ck check (id = vendedor_codigo || '-' || mes),
  constraint relatorios_produtos_periodo_ck check (
    data_final >= data_inicial and to_char(data_inicial, 'YYYY-MM') = mes
  ),
  constraint relatorios_produtos_unico unique (vendedor_codigo, mes)
);
create index relatorios_produtos_mes_idx on public.relatorios_produtos (mes);

-- ---------------------------------------------------------------------
-- vendas_produto_mes: produto vendido por vendedor no mês, somado por canal.
-- canal: 'oficina' (pedido com placa) ou 'balcao' (sem placa).
-- ---------------------------------------------------------------------
create table public.vendas_produto_mes (
  relatorio_id    text not null references public.relatorios_produtos (id) on delete cascade,
  vendedor_codigo text not null references public.vendedores (codigo),
  mes             public.mes_ref not null,
  produto_codigo  text not null,
  produto_nome    text not null default '',
  canal           text not null check (canal in ('balcao', 'oficina')),
  qtde            numeric(14,3) not null default 0,
  valor_total     numeric(14,2) not null default 0,
  primary key (relatorio_id, canal, produto_codigo)
);
create index vendas_produto_mes_mes_idx on public.vendas_produto_mes (mes);
create index vendas_produto_mes_vendedor_mes_idx on public.vendas_produto_mes (vendedor_codigo, mes);
create index vendas_produto_mes_produto_idx on public.vendas_produto_mes (produto_codigo);

-- ---------------------------------------------------------------------
-- Gatilhos
-- ---------------------------------------------------------------------
create trigger vendedores_atualizado_em before update on public.vendedores
  for each row execute function public.tocar_atualizado_em();
create trigger perfis_atualizado_em before update on public.perfis
  for each row execute function public.tocar_atualizado_em();
create trigger clientes_atualizado_em before update on public.clientes
  for each row execute function public.tocar_atualizado_em();
create trigger relatorios_importados_atualizado_em before update on public.relatorios_importados
  for each row execute function public.tocar_atualizado_em();
create trigger metas_atualizado_em before update on public.metas
  for each row execute function public.tocar_atualizado_em();
create trigger relatorios_produtos_atualizado_em before update on public.relatorios_produtos
  for each row execute function public.tocar_atualizado_em();

-- Grava no histórico cada mudança de status ou de anotação do cliente.
-- Roda com as permissões de quem alterou (respeita o RLS).
create or replace function public.registrar_contato()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status_contato = 'nao_contatado' and coalesce(new.observacoes, '') = '' then
      return new;
    end if;
  elsif new.status_contato is not distinct from old.status_contato
    and new.observacoes is not distinct from old.observacoes then
    return new;
  end if;

  insert into public.contatos_clientes (cliente_codigo, vendedor_codigo, status, anotacao)
  values (new.codigo, new.vendedor_codigo, new.status_contato, new.observacoes);
  return new;
end;
$$;

create trigger clientes_registrar_contato after insert or update on public.clientes
  for each row execute function public.registrar_contato();
