/**
 * Confere no Supabase DE VERDADE que um visitante não logado não lê nenhuma tabela.
 * Só roda quando o .env está preenchido (no GitHub Actions ele é pulado).
 * Se falhar com "tabela não encontrada", as migrations ainda não foram aplicadas.
 */
import { describe, expect, it } from 'vitest';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

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

describe.skipIf(!url || !chave || process.env.SEM_SUPABASE_REAL)('Supabase real: acesso sem login', () => {
  it.each(TABELAS)('%s está bloqueada para quem não está logado', async (tabela) => {
    const resposta = await fetch(`${url}/rest/v1/${tabela}?select=*&limit=1`, { headers: { apikey: chave! } });
    const corpo = await resposta.json();
    expect(corpo.code, `resposta: ${JSON.stringify(corpo)}`).not.toBe('PGRST205'); // tabela não existe = migrations não aplicadas
    expect(resposta.ok, `a tabela ${tabela} devolveu dados sem login!`).toBe(false);
    expect(corpo.code).toBe('42501');
  }, 15_000);
});
