/** Camada de dados: o que é enviado ao Supabase e como a resposta vira dados do painel (Supabase simulado). */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RelatorioLido } from '../tipos';

interface Chamada {
  tabela?: string;
  rpc?: string;
  args?: unknown;
  metodos: [string, unknown[]][];
}

const chamadas: Chamada[] = [];
let respostas: { data: unknown; error: unknown }[] = [];

/** Construtor de consultas falso: grava os métodos chamados e devolve a próxima resposta da fila. */
function consulta(c: Chamada) {
  const proxy: Record<string, unknown> = new Proxy(
    {},
    {
      get(_alvo, nome: string) {
        if (nome === 'then') {
          const r = respostas.shift() ?? { data: [], error: null };
          return (ok: (v: unknown) => unknown) => Promise.resolve(r).then(ok);
        }
        return (...args: unknown[]) => {
          c.metodos.push([nome, args]);
          return proxy;
        };
      },
    },
  );
  return proxy;
}

vi.mock('../dados/supabase', () => ({
  configurado: true,
  veioDaRecuperacao: false,
  erroNoLink: '',
  supabase: {
    from(tabela: string) {
      const c: Chamada = { tabela, metodos: [] };
      chamadas.push(c);
      return consulta(c);
    },
    rpc(nome: string, args: unknown) {
      const c: Chamada = { rpc: nome, args, metodos: [] };
      chamadas.push(c);
      return consulta(c);
    },
  },
}));

const repo = await import('../dados/repositorio');

const lido: RelatorioLido = {
  nomeArquivo: 'teste.csv',
  cabecalho: {
    vendedorCodigo: '004',
    vendedorNome: 'RICARDO TAVARES',
    empresa: '001-X',
    dataInicial: '2026-10-01',
    dataFinal: '2026-10-27',
    mes: '2026-10',
    parcial: true,
  },
  linhas: [{ clienteCodigo: '00004219', clienteNome: 'HELENA', prazoMedio: 10, qtdVendas: 1, qtde: 1, valorTotal: 100, valorCusto: 50, resultado: 50 }],
};

beforeEach(() => {
  chamadas.length = 0;
  respostas = [];
});

describe('repositório (Supabase)', () => {
  it('importa o relatório numa chamada só à função do banco', async () => {
    respostas = [
      {
        data: {
          id: '004-2026-10',
          vendedor_codigo: '004',
          vendedor_nome: 'RICARDO TAVARES',
          mes: '2026-10',
          data_inicial: '2026-10-01',
          data_final: '2026-10-27',
          parcial: true,
          empresa: '001-X',
          nome_arquivo: 'teste.csv',
          importado_em: '2026-11-09T12:00:00Z',
          qtd_clientes: 1,
          total_vendido: '100.00',
        },
        error: null,
      },
    ];
    const r = await repo.importarRelatorio(lido);
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].rpc).toBe('importar_relatorio');
    expect(chamadas[0].args).toEqual({ dados: { nomeArquivo: 'teste.csv', cabecalho: lido.cabecalho, linhas: lido.linhas } });
    expect(r).toMatchObject({ id: '004-2026-10', vendedorCodigo: '004', parcial: true, totalVendido: 100, qtdClientes: 1 });
  });

  it('busca todas as páginas (o Supabase devolve no máximo 1000 linhas)', async () => {
    const pagina = (de: number, qtd: number) =>
      Array.from({ length: qtd }, (_, i) => ({ codigo: String(de + i), nome: 'C', telefone: null, observacoes: null, status_contato: 'nao_contatado' }));
    respostas = [
      { data: pagina(0, 1000), error: null },
      { data: pagina(1000, 1000), error: null },
      { data: pagina(2000, 5), error: null },
    ];
    const clientes = await repo.listarClientes();
    expect(clientes).toHaveLength(2005);
    expect(chamadas.map((c) => c.metodos.find(([m]) => m === 'range')![1])).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('converte numeric do banco para número e junta o nome do cliente', async () => {
    respostas = [
      {
        data: [
          {
            relatorio_id: '004-2026-10',
            vendedor_codigo: '004',
            mes: '2026-10',
            cliente_codigo: '00004219',
            prazo_medio: '11.06',
            qtd_vendas: '8.00',
            qtde: '19.000',
            valor_total: '1434.40',
            valor_custo: '901.57',
            resultado: '532.83',
            clientes: { nome: 'HELENA' },
          },
        ],
        error: null,
      },
    ];
    const [v] = await repo.listarVendas();
    expect(v).toEqual({
      id: '004-2026-10-00004219',
      relatorioId: '004-2026-10',
      vendedorCodigo: '004',
      mes: '2026-10',
      clienteCodigo: '00004219',
      clienteNome: 'HELENA',
      prazoMedio: 11.06,
      qtdVendas: 8,
      qtde: 19,
      valorTotal: 1434.4,
      valorCusto: 901.57,
      resultado: 532.83,
    });
  });

  it('salvarContato envia só os campos alterados, com os nomes do banco', async () => {
    await repo.salvarContato('00004219', { anotacao: 'ligar sexta', statusContato: 'contatado' });
    expect(chamadas[0].tabela).toBe('clientes');
    expect(chamadas[0].metodos[0]).toEqual(['upsert', [{ codigo: '00004219', observacoes: 'ligar sexta', status_contato: 'contatado' }, { onConflict: 'codigo' }]]);
  });

  it('meta vazia apaga; meta preenchida grava', async () => {
    await repo.salvarMeta('004', '2026-10', null);
    await repo.salvarMeta('004', '2026-11', 50000);
    expect(chamadas[0].metodos[0][0]).toBe('delete');
    expect(chamadas[1].metodos[0]).toEqual(['upsert', [{ vendedor_codigo: '004', mes: '2026-11', valor: 50000 }, { onConflict: 'vendedor_codigo,mes' }]]);
  });

  it('erro de rede vira mensagem em português', async () => {
    respostas = [{ data: null, error: { message: 'TypeError: Failed to fetch', code: '' } }];
    await expect(repo.listarVendedores()).rejects.toThrow('Sem conexão com o banco');
  });

  it('erro de permissão vira mensagem em português', async () => {
    respostas = [{ data: null, error: { message: 'permission denied for table metas', code: '42501' } }];
    await expect(repo.listarMetas()).rejects.toThrow('Sem permissão ou sessão expirada');
  });
});
