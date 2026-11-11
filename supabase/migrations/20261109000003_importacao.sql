-- =====================================================================
-- Painel de Vendas Evaldo: importação dos relatórios do ERP
--
-- Cada função roda numa transação só: se qualquer passo falhar, nada é
-- gravado (o relatório anterior continua intacto).
-- security invoker: roda com as permissões de quem chamou, então o RLS vale.
-- =====================================================================

-- ---------------------------------------------------------------------
-- importar_relatorio: relatório "VENDAS POR MARK-UP" de um vendedor e mês.
--
-- dados = {
--   "nomeArquivo": "vendas-004-2026-10.csv",
--   "cabecalho": { "vendedorCodigo": "004", "vendedorNome": "...", "empresa": "...",
--                  "dataInicial": "2026-10-01", "dataFinal": "2026-10-27",
--                  "mes": "2026-10", "parcial": true },
--   "linhas": [ { "clienteCodigo": "00004219", "clienteNome": "...", "prazoMedio": 11.06,
--                 "qtdVendas": 8, "qtde": 19, "valorTotal": 1434.4,
--                 "valorCusto": 901.57, "resultado": 532.83 }, ... ]
-- }
--
-- Se já existir relatório do mesmo vendedor e mês, ele é substituído.
-- Telefone, anotação e status dos clientes são mantidos.
-- ---------------------------------------------------------------------
create or replace function public.importar_relatorio(dados jsonb)
returns public.relatorios_importados
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cab        jsonb := dados -> 'cabecalho';
  v_vendedor text  := nullif(trim(cab ->> 'vendedorCodigo'), '');
  v_mes      text  := cab ->> 'mes';
  v_id       text;
  v_rel      public.relatorios_importados;
begin
  if not public.eh_gestao() then
    raise exception 'Sem permissão para importar relatórios.' using errcode = '42501';
  end if;
  if v_vendedor is null or v_mes is null then
    raise exception 'Relatório sem vendedor ou sem mês.' using errcode = '22023';
  end if;
  if jsonb_typeof(dados -> 'linhas') is distinct from 'array'
     or jsonb_array_length(dados -> 'linhas') = 0 then
    raise exception 'O relatório não tem linhas de clientes.' using errcode = '22023';
  end if;

  v_id := v_vendedor || '-' || v_mes;

  -- Vendedor novo entra com o nome do arquivo; se já existe, mantém o nome editado.
  insert into public.vendedores (codigo, nome)
  values (v_vendedor, coalesce(nullif(trim(cab ->> 'vendedorNome'), ''), v_vendedor))
  on conflict (codigo) do nothing;

  -- Clientes: cria os novos e atualiza o nome; não mexe em telefone/anotação/status.
  insert into public.clientes (codigo, nome)
  select distinct on (l."clienteCodigo") l."clienteCodigo", coalesce(l."clienteNome", '')
  from jsonb_to_recordset(dados -> 'linhas') as l("clienteCodigo" text, "clienteNome" text)
  order by l."clienteCodigo"
  on conflict (codigo) do update
    set nome = excluded.nome
    where public.clientes.nome is distinct from excluded.nome;

  -- Cabeçalho do relatório (substitui o anterior do mesmo vendedor e mês).
  insert into public.relatorios_importados as r (
    id, vendedor_codigo, vendedor_nome, mes, data_inicial, data_final, parcial,
    empresa, nome_arquivo, importado_por, importado_em, qtd_clientes, total_vendido
  )
  select
    v_id, v_vendedor, coalesce(cab ->> 'vendedorNome', ''), v_mes,
    (cab ->> 'dataInicial')::date, (cab ->> 'dataFinal')::date,
    coalesce((cab ->> 'parcial')::boolean, false),
    coalesce(cab ->> 'empresa', ''), coalesce(dados ->> 'nomeArquivo', ''),
    auth.uid(), now(),
    count(distinct l."clienteCodigo"),
    round(coalesce(sum(l."valorTotal"), 0), 2)
  from jsonb_to_recordset(dados -> 'linhas') as l("clienteCodigo" text, "valorTotal" numeric)
  on conflict (id) do update set
    vendedor_nome = excluded.vendedor_nome,
    data_inicial  = excluded.data_inicial,
    data_final    = excluded.data_final,
    parcial       = excluded.parcial,
    empresa       = excluded.empresa,
    nome_arquivo  = excluded.nome_arquivo,
    importado_por = excluded.importado_por,
    importado_em  = excluded.importado_em,
    qtd_clientes  = excluded.qtd_clientes,
    total_vendido = excluded.total_vendido
  returning * into v_rel;

  -- Linhas: troca todas as do relatório.
  delete from public.vendas_cliente_mes where relatorio_id = v_id;

  insert into public.vendas_cliente_mes (
    relatorio_id, vendedor_codigo, mes, cliente_codigo,
    prazo_medio, qtd_vendas, qtde, valor_total, valor_custo, resultado
  )
  select
    v_id, v_vendedor, v_mes, l."clienteCodigo",
    round(coalesce(l."prazoMedio", 0), 2),
    round(coalesce(l."qtdVendas", 0), 2),
    round(coalesce(l.qtde, 0), 3),
    round(coalesce(l."valorTotal", 0), 2),
    round(coalesce(l."valorCusto", 0), 2),
    round(coalesce(l.resultado, 0), 2)
  from jsonb_to_recordset(dados -> 'linhas') as l(
    "clienteCodigo" text, "prazoMedio" numeric, "qtdVendas" numeric, qtde numeric,
    "valorTotal" numeric, "valorCusto" numeric, resultado numeric
  );

  -- Último vendedor que vendeu para cada cliente do relatório.
  update public.clientes c
  set vendedor_codigo = u.vendedor_codigo
  from (
    select distinct on (v.cliente_codigo) v.cliente_codigo, v.vendedor_codigo
    from public.vendas_cliente_mes v
    where v.cliente_codigo in (
      select l."clienteCodigo"
      from jsonb_to_recordset(dados -> 'linhas') as l("clienteCodigo" text)
    )
      and v.valor_total > 0
    order by v.cliente_codigo, v.mes desc, v.valor_total desc
  ) u
  where c.codigo = u.cliente_codigo
    and c.vendedor_codigo is distinct from u.vendedor_codigo;

  return v_rel;
end;
$$;

-- ---------------------------------------------------------------------
-- importar_relatorio_produtos: relatório "Movimento de clientes" de um mês,
-- com um ou vários vendedores. Grava um relatório por vendedor e substitui
-- o do mesmo vendedor e mês.
--
-- dados = {
--   "nomeArquivo": "...", "mes": "2026-10", "dataInicial": "2026-10-01",
--   "dataFinal": "2026-10-27", "parcial": true,
--   "vendedores": [ { "codigo": "004", "nome": "..." }, ... ],
--   "linhas": [ { "vendedorCodigo": "004", "produtoCodigo": "0001021",
--                 "produtoNome": "...", "canal": "oficina", "qtde": 2,
--                 "valorTotal": 79.8 }, ... ]
-- }
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

    return next v_rel;
  end loop;
end;
$$;

revoke all on function public.importar_relatorio(jsonb) from anon, public;
revoke all on function public.importar_relatorio_produtos(jsonb) from anon, public;
grant execute on function public.importar_relatorio(jsonb) to authenticated;
grant execute on function public.importar_relatorio_produtos(jsonb) to authenticated;
