import { describe, expect, it } from 'vitest';
import type { Mes, Venda } from '../tipos';
import {
  analisar,
  comprou,
  ehBalcao,
  ehQuedaForte,
  markup,
  mediaMensal,
  situacaoCliente,
  totaisDoMes,
} from '../regras/analise';

const MESES: Mes[] = ['2026-07', '2026-08', '2026-09', '2026-10'];

/** Cria a função valor-no-mês a partir de [jul, ago, set, out]. */
function serie(valores: number[]) {
  return (m: Mes) => valores[MESES.indexOf(m)] ?? 0;
}

function venda(cliente: string, mes: Mes, valorTotal: number, custo = valorTotal * 0.6): Venda {
  return {
    id: `${mes}-${cliente}`,
    relatorioId: `004-${mes}`,
    vendedorCodigo: '004',
    mes,
    clienteCodigo: cliente,
    clienteNome: `CLIENTE ${cliente}`,
    prazoMedio: 10,
    qtdVendas: 1,
    qtde: 1,
    valorTotal,
    valorCusto: custo,
    resultado: valorTotal - custo,
  };
}

describe('comprou no mês', () => {
  it('só conta valor maior que zero', () => {
    expect(comprou(10)).toBe(true);
    expect(comprou(0)).toBe(false);
    expect(comprou(-50)).toBe(false);
    expect(comprou(undefined)).toBe(false);
  });
});

describe('situação do cliente no último mês', () => {
  const sit = (valores: number[]) => situacaoCliente(serie(valores), MESES, '2026-10');

  it('Ativo: comprou no último mês e no anterior', () => {
    expect(sit([0, 0, 100, 200])).toBe('ativo');
    expect(sit([100, 100, 100, 100])).toBe('ativo');
  });

  it('Novo: primeira compra foi no último mês', () => {
    expect(sit([0, 0, 0, 300])).toBe('novo');
  });

  it('Novo também quando antes só teve devolução', () => {
    expect(sit([0, -50, 0, 300])).toBe('novo');
  });

  it('Voltou a comprar: não comprou no anterior, mas já tinha comprado', () => {
    expect(sit([100, 0, 0, 300])).toBe('voltou');
    expect(sit([0, 100, -20, 300])).toBe('voltou');
  });

  it('Deixou de comprar: 2 meses ou mais com compra e nada no último', () => {
    expect(sit([100, 100, 0, 0])).toBe('deixou');
    expect(sit([100, 0, 100, 0])).toBe('deixou');
  });

  it('só devolução no último mês não conta como compra', () => {
    expect(sit([100, 100, 100, -80])).toBe('deixou');
  });

  it('Não voltou: comprou uma única vez', () => {
    expect(sit([0, 100, 0, 0])).toBe('nao_voltou');
    expect(sit([0, 0, 100, 0])).toBe('nao_voltou');
  });

  it('Sem compra: nunca comprou (só devolução)', () => {
    expect(sit([0, 0, -30, 0])).toBe('sem_compra');
  });

  it('ignora meses depois do mês de referência', () => {
    expect(situacaoCliente(serie([100, 100, 0, 500]), MESES, '2026-09')).toBe('deixou');
  });
});

describe('outros indicadores', () => {
  it('markup = resultado ÷ custo', () => {
    expect(markup(532.81, 901.59)).toBeCloseTo(0.591, 3);
    expect(markup(10, 0)).toBeNull();
  });

  it('queda forte: mais de 50% abaixo do mês anterior', () => {
    expect(ehQuedaForte(400, 1000)).toBe(true);
    expect(ehQuedaForte(500, 1000)).toBe(false);
    expect(ehQuedaForte(0, 1000)).toBe(false); // não comprou: é "deixou", não queda
    expect(ehQuedaForte(100, null)).toBe(false); // mês anterior não importado
  });

  it('média mensal ignora o mês parcial', () => {
    const media = mediaMensal(serie([100, 200, 300, 50]), MESES, new Set(['2026-10']));
    expect(media).toBe(200);
  });

  it('Cliente Consumidor é balcão', () => {
    expect(ehBalcao('00000011')).toBe(true);
    expect(ehBalcao('00099999', 'CLIENTE CONSUMIDOR')).toBe(true);
    expect(ehBalcao('00004219', 'HELENA')).toBe(false);
  });

  it('totais do mês contam clientes que compraram e devolução', () => {
    const t = totaisDoMes('2026-10', [venda('1', '2026-10', 1000), venda('2', '2026-10', -200), venda('3', '2026-10', 500)]);
    expect(t.faturamento).toBe(1300);
    expect(t.clientesCompraram).toBe(2);
    expect(t.ticketMedio).toBe(650);
    expect(t.devolucao).toBe(200);
  });
});

describe('análise completa', () => {
  const vendas = [
    venda('A', '2026-08', 1000), venda('A', '2026-09', 1000), venda('A', '2026-10', 300), // queda forte
    venda('B', '2026-08', 500), venda('B', '2026-09', 700), // deixou
    venda('C', '2026-10', 200), // novo
    venda('D', '2026-08', 100), venda('D', '2026-10', 100), // voltou
  ];
  const a = analisar(vendas, ['2026-08', '2026-09', '2026-10'], new Set(['2026-10']), '2026-10', '2026-10-27');
  const c = (cod: string) => a.clientes.find((x) => x.codigo === cod)!;

  it('classifica cada cliente', () => {
    expect(c('A').situacao).toBe('ativo');
    expect(c('A').quedaForte).toBe(true);
    expect(c('A').variacao).toBeCloseTo(-0.7);
    expect(c('B').situacao).toBe('deixou');
    expect(c('B').parouNoMes).toBe(true);
    expect(c('C').situacao).toBe('novo');
    expect(c('D').situacao).toBe('voltou');
  });

  it('calcula última compra e tempo sem comprar', () => {
    expect(c('B').ultimaCompra).toBe('2026-09');
    expect(c('B').mesesSemComprar).toBe(1);
    expect(c('B').diasSemComprar).toBe(27);
    expect(c('B').mediaMensal).toBe(600); // ago e set (out é parcial)
  });

  it('não compara com mês anterior que não foi importado', () => {
    const b = analisar(vendas, ['2026-08', '2026-10'], new Set(), '2026-10');
    expect(b.mesAntImportado).toBe(false);
    expect(b.clientes.find((x) => x.codigo === 'A')!.valorAnterior).toBeNull();
  });
});
