-- =====================================================================
-- Veículos atendidos (pedidos com placa do relatório de produtos).
--
-- Uma linha por relatório (vendedor-mês) × placa × produto. Alimenta a aba
-- Veículos: produtos mais aplicados por marca/modelo e lista de veículos.
-- Reimportar o relatório de produtos substitui as linhas (on delete cascade
-- e a função importar_relatorio_produtos, redefinida abaixo).
-- =====================================================================

create table public.veiculos_produto_mes (
  relatorio_id     text not null references public.relatorios_produtos (id) on delete cascade,
  vendedor_codigo  text not null references public.vendedores (codigo),
  mes              public.mes_ref not null,
  placa            text not null,
  placa_texto      text not null default '',
  veiculo          text not null default '',
  marca            text not null default '',
  modelo           text not null default '',
  ano              integer,
  km               integer,
  cliente_nome     text not null default '',
  cliente_telefone text not null default '',
  ultima_data      date,
  pedidos          integer not null default 0,
  produto_codigo   text not null,
  produto_nome     text not null default '',
  qtde             numeric(14,3) not null default 0,
  valor_total      numeric(14,2) not null default 0,
  primary key (relatorio_id, placa, produto_codigo)
);
create index veiculos_produto_mes_mes_idx on public.veiculos_produto_mes (mes);
create index veiculos_produto_mes_modelo_idx on public.veiculos_produto_mes (marca, modelo);
create index veiculos_produto_mes_placa_idx on public.veiculos_produto_mes (placa);

alter table public.veiculos_produto_mes enable row level security;
revoke all on public.veiculos_produto_mes from anon;
grant select, insert, update, delete on public.veiculos_produto_mes to authenticated;

create policy gestao_tudo on public.veiculos_produto_mes
  for all to authenticated
  using ((select public.eh_gestao())) with check ((select public.eh_gestao()));

-- FUTURO (acesso dos vendedores):
-- create policy vendedor_leitura on public.veiculos_produto_mes
--   for select to authenticated
--   using (vendedor_codigo = (select public.meu_vendedor_codigo()));

-- ---------------------------------------------------------------------
-- importar_relatorio_produtos: igual à anterior, e agora grava também
-- dados -> 'veiculos' (opcional):
--   [ { "vendedorCodigo": "009", "placa": "QWS2F81", "placaTexto": "QWS-2F81",
--       "veiculo": "RENAULT RE-KWID 1.0 2020 BRANCO", "marca": "RENAULT",
--       "modelo": "RENAULT RE-KWID 1.0", "ano": 2020, "km": null,
--       "clienteNome": "...", "clienteTelefone": "...", "ultimaData": "2026-10-09",
--       "pedidos": 1, "produtoCodigo": "0287906", "produtoNome": "...",
--       "qtde": 3, "valorTotal": 253.5 }, ... ]
-- ---------------------------------------------------------------------
create or replace function public.importar_relatorio_produtos(dados jsonb)
returns setof public.relatorios_produtos
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_mes  text := dados ->> 'mes';
  v      record;
  v_id   text;
  v_nome text;
  v_rel  public.relatorios_produtos;
begin
  if not public.eh_gestao() then
    raise exception 'Sem permissão para importar relatórios.' using errcode = '42501';
  end if;
  if v_mes is null
     or jsonb_typeof(dados -> 'vendedores') is distinct from 'array'
     or jsonb_array_length(dados -> 'vendedores') = 0 then
    raise exception 'Relatório de produtos sem mês ou sem vendedores.' using errcode = '22023';
  end if;

  for v in
    select distinct on (x.codigo) trim(x.codigo) as codigo, x.nome
    from jsonb_to_recordset(dados -> 'vendedores') as x(codigo text, nome text)
    where nullif(trim(x.codigo), '') is not null
    order by x.codigo
  loop
    -- O arquivo pode trazer só o código; usa o nome já cadastrado.
    insert into public.vendedores (codigo, nome)
    values (v.codigo, coalesce(nullif(trim(v.nome), ''), v.codigo))
    on conflict (codigo) do nothing;

    select nome into v_nome from public.vendedores where codigo = v.codigo;
    v_id := v.codigo || '-' || v_mes;

    insert into public.relatorios_produtos as r (
      id, vendedor_codigo, vendedor_nome, mes, data_inicial, data_final, parcial,
      nome_arquivo, importado_por, importado_em, qtd_produtos
    )
    select
      v_id, v.codigo, v_nome, v_mes,
      (dados ->> 'dataInicial')::date, (dados ->> 'dataFinal')::date,
      coalesce((dados ->> 'parcial')::boolean, false),
      coalesce(dados ->> 'nomeArquivo', ''), auth.uid(), now(),
      count(distinct l."produtoCodigo")
    from jsonb_to_recordset(dados -> 'linhas') as l("vendedorCodigo" text, "produtoCodigo" text)
    where l."vendedorCodigo" = v.codigo
    on conflict (id) do update set
      vendedor_nome = excluded.vendedor_nome,
      data_inicial  = excluded.data_inicial,
      data_final    = excluded.data_final,
      parcial       = excluded.parcial,
      nome_arquivo  = excluded.nome_arquivo,
      importado_por = excluded.importado_por,
      importado_em  = excluded.importado_em,
      qtd_produtos  = excluded.qtd_produtos
    returning * into v_rel;

    delete from public.vendas_produto_mes where relatorio_id = v_id;
    delete from public.veiculos_produto_mes where relatorio_id = v_id;

    insert into public.vendas_produto_mes (
      relatorio_id, vendedor_codigo, mes, produto_codigo, produto_nome, canal, qtde, valor_total
    )
    select
      v_id, v.codigo, v_mes, l."produtoCodigo", coalesce(max(l."produtoNome"), ''), l.canal,
      round(coalesce(sum(l.qtde), 0), 3), round(coalesce(sum(l."valorTotal"), 0), 2)
    from jsonb_to_recordset(dados -> 'linhas') as l(
      "vendedorCodigo" text, "produtoCodigo" text, "produtoNome" text,
      canal text, qtde numeric, "valorTotal" numeric
    )
    where l."vendedorCodigo" = v.codigo
    group by l."produtoCodigo", l.canal;

    if jsonb_typeof(dados -> 'veiculos') = 'array' then
      insert into public.veiculos_produto_mes (
        relatorio_id, vendedor_codigo, mes, placa, placa_texto, veiculo, marca, modelo, ano, km,
        cliente_nome, cliente_telefone, ultima_data, pedidos, produto_codigo, produto_nome, qtde, valor_total
      )
      select
        v_id, v.codigo, v_mes, upper(trim(x.placa)),
        coalesce(max(x."placaTexto"), ''), coalesce(max(x.veiculo), ''),
        coalesce(max(x.marca), ''), coalesce(max(x.modelo), ''),
        max(x.ano), max(x.km),
        coalesce(max(x."clienteNome"), ''), coalesce(max(x."clienteTelefone"), ''),
        max(x."ultimaData"), coalesce(max(x.pedidos), 0),
        x."produtoCodigo", coalesce(max(x."produtoNome"), ''),
        round(coalesce(sum(x.qtde), 0), 3), round(coalesce(sum(x."valorTotal"), 0), 2)
      from jsonb_to_recordset(dados -> 'veiculos') as x(
        "vendedorCodigo" text, placa text, "placaTexto" text, veiculo text, marca text, modelo text,
        ano integer, km integer, "clienteNome" text, "clienteTelefone" text, "ultimaData" date,
        pedidos integer, "produtoCodigo" text, "produtoNome" text, qtde numeric, "valorTotal" numeric
      )
      where x."vendedorCodigo" = v.codigo
        and nullif(trim(x.placa), '') is not null
        and nullif(trim(x."produtoCodigo"), '') is not null
      group by upper(trim(x.placa)), x."produtoCodigo";
    end if;

    return next v_rel;
  end loop;
end;
$$;

revoke all on function public.importar_relatorio_produtos(jsonb) from anon, public;
grant execute on function public.importar_relatorio_produtos(jsonb) to authenticated;
