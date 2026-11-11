/**
 * Testa as migrations de supabase/migrations/ num Postgres em memória (PGlite),
 * com uma simulação mínima do Supabase (papéis anon/authenticated e auth.uid()).
 * Cobre: importação, reimportação substituindo o mesmo período, operação
 * "tudo ou nada" e o bloqueio de acesso sem login / sem perfil.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const GESTAO = '11111111-1111-1111-1111-111111111111';
const SEM_PERFIL = '22222222-2222-2222-2222-222222222222';

const TABELAS = [
  'perfis',
  'vendedores',
  'clientes',
  'relatorios_importados',
  'vendas_cliente_mes',
  'metas',
  'contatos_clientes',
  'relatorios_produtos',
  'vendas_produto_mes',
];

let db: PGlite;

/** Roda `fn` como um usuário: anon (não logado) ou authenticated com o id dado. */
async function como<T>(papel: 'anon' | 'authenticated', uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${papel};`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role;');
  }
}

async function q<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

async function contar(tabela: string): Promise<number> {
  return (await q<{ n: number }>(`select count(*)::int as n from public.${tabela}`))[0].n;
}

const linha = (clienteCodigo: string | null, clienteNome: string, valorTotal: number) => ({
  clienteCodigo,
  clienteNome,
  prazoMedio: 11.06,
  qtdVendas: 2,
  qtde: 3,
  valorTotal,
  valorCusto: valorTotal * 0.6,
  resultado: valorTotal * 0.4,
});

const relatorio = (linhas: ReturnType<typeof linha>[], dataFinal = '2026-10-27') => ({
  nomeArquivo: 'teste.csv',
  cabecalho: {
    vendedorCodigo: '004',
    vendedorNome: 'RICARDO TAVARES',
    empresa: '001-EMPRESA',
    dataInicial: '2026-10-01',
    dataFinal,
    mes: '2026-10',
    parcial: dataFinal !== '2026-10-31',
  },
  linhas,
});

const importar = (dados: unknown) => q<Record<string, unknown>>('select * from public.importar_relatorio($1)', [dados]);

beforeAll(async () => {
  db = new PGlite();
  // O que o Supabase já traz pronto (simplificado).
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    grant references on auth.users to authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;
  `);
  const pasta = join(process.cwd(), 'supabase', 'migrations');
  for (const arquivo of readdirSync(pasta).sort()) {
    await db.exec(readFileSync(join(pasta, arquivo), 'utf8'));
  }
  await db.exec(`
    insert into auth.users values ('${GESTAO}'), ('${SEM_PERFIL}');
    insert into public.perfis (id, nome, papel) values ('${GESTAO}', 'Gestora Teste', 'gestao');
  `);
}, 60_000);

describe('importação (gestão)', () => {
  it('importa, e reimportar o mesmo período substitui as linhas', () =>
    como('authenticated', GESTAO, async () => {
      const [r] = await importar(relatorio([linha('00004219', 'HELENA', 1434.4), linha('00000011', 'CLIENTE CONSUMIDOR', 100), linha('00001876', 'MOTO', -260)]));
      expect(r.id).toBe('004-2026-10');
      expect(r.importado_por).toBe(GESTAO);
      expect(await contar('vendas_cliente_mes')).toBe(3);

      await q(`update public.clientes set telefone = '11999990000', status_contato = 'contatado', observacoes = 'ligar sexta' where codigo = '00004219'`);
      await q(`update public.vendedores set nome = 'Ricardo (editado)' where codigo = '004'`);

      const [r2] = await importar(relatorio([linha('00004219', 'HELENA B', 2000), linha('00007345', 'OFICINA', 50)], '2026-10-31'));
      expect(r2.parcial).toBe(false);
      expect(await contar('relatorios_importados')).toBe(1);
      expect(await contar('vendas_cliente_mes')).toBe(2);
      expect(Number((await q<{ total_vendido: string }>('select total_vendido from public.relatorios_importados'))[0].total_vendido)).toBe(2050);

      const [cliente] = await q(`select * from public.clientes where codigo = '00004219'`);
      expect(cliente).toMatchObject({ telefone: '11999990000', status_contato: 'contatado', observacoes: 'ligar sexta', nome: 'HELENA B', vendedor_codigo: '004' });
      expect((await q(`select nome from public.vendedores where codigo = '004'`))[0].nome).toBe('Ricardo (editado)');
    }));

  it('importação com erro não deixa dados pela metade', () =>
    como('authenticated', GESTAO, async () => {
      const antes = await contar('vendas_cliente_mes');
      await expect(importar(relatorio([linha('00000001', 'A', 10), linha(null, 'SEM CÓDIGO', 10)]))).rejects.toThrow();
      expect(await contar('vendas_cliente_mes')).toBe(antes);
      expect((await q(`select count(*)::int as n from public.clientes where codigo = '00000001'`))[0].n).toBe(0);
    }));

  it('grava histórico de contato com autor', () =>
    como('authenticated', GESTAO, async () => {
      const [h] = await q(`select * from public.contatos_clientes where cliente_codigo = '00004219' order by id desc limit 1`);
      expect(h).toMatchObject({ status: 'contatado', anotacao: 'ligar sexta', autor: GESTAO });
    }));

  it('produtos: um relatório por vendedor e reenvio substitui', () =>
    como('authenticated', GESTAO, async () => {
      const dados = {
        nomeArquivo: 'p.csv',
        mes: '2026-10',
        dataInicial: '2026-10-01',
        dataFinal: '2026-10-27',
        parcial: true,
        vendedores: [
          { codigo: '004', nome: '004' },
          { codigo: '007', nome: 'BRUNO LACERDA' },
        ],
        linhas: [
          { vendedorCodigo: '004', produtoCodigo: '0101', produtoNome: 'FILTRO', canal: 'oficina', qtde: 2, valorTotal: 80 },
          { vendedorCodigo: '004', produtoCodigo: '0101', produtoNome: 'FILTRO', canal: 'balcao', qtde: 3, valorTotal: 120 },
          { vendedorCodigo: '007', produtoCodigo: '0101', produtoNome: 'FILTRO', canal: 'oficina', qtde: 1, valorTotal: 40 },
        ],
      };
      const rel = await q<{ id: string; vendedor_nome: string }>('select * from public.importar_relatorio_produtos($1)', [dados]);
      expect(rel.map((r) => r.id).sort()).toEqual(['004-2026-10', '007-2026-10']);
      expect(rel.find((r) => r.id === '004-2026-10')!.vendedor_nome).toBe('Ricardo (editado)');
      await q('select * from public.importar_relatorio_produtos($1)', [dados]);
      expect(await contar('vendas_produto_mes')).toBe(3);
    }));

  it('o app não consegue mudar o papel de ninguém', () =>
    como('authenticated', GESTAO, async () => {
      await q(`update public.perfis set papel = 'vendedor', vendedor_codigo = '004' where id = '${GESTAO}'`).catch(() => {});
      expect((await q(`select papel from public.perfis where id = '${GESTAO}'`))[0].papel).toBe('gestao');
    }));
});

describe('bloqueio de acesso', () => {
  it.each(TABELAS)('não logado não lê %s', (tabela) =>
    como('anon', null, async () => {
      await expect(q(`select * from public.${tabela}`)).rejects.toThrow(/permission denied/);
    }),
  );

  it('não logado não executa a importação', () =>
    como('anon', null, async () => {
      await expect(importar(relatorio([linha('9', 'X', 1)]))).rejects.toThrow(/permission denied/);
    }));

  it.each(TABELAS)('logado sem perfil vê %s vazia', (tabela) =>
    como('authenticated', SEM_PERFIL, async () => {
      expect(await contar(tabela)).toBe(0);
    }),
  );

  it('logado sem perfil não importa nem grava', () =>
    como('authenticated', SEM_PERFIL, async () => {
      await expect(importar(relatorio([linha('9', 'X', 1)]))).rejects.toThrow(/Sem permissão/);
      await expect(q(`insert into public.metas (vendedor_codigo, mes, valor) values ('004', '2026-11', 1)`)).rejects.toThrow(/row-level security/);
    }));
});
