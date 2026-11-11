import { describe, expect, it } from 'vitest';
import { analisarProdutos } from '../regras/produtos';
import type { Canal, VendaProduto } from '../tipos';

function venda(mes: string, produto: string, qtde: number, canal: Canal = 'balcao', valor = qtde * 10, vendedor = '004'): VendaProduto {
  return {
    id: `${vendedor}-${mes}-${canal}-${produto}`,
    relatorioId: `${vendedor}-${mes}`,
    mes,
    vendedorCodigo: vendedor,
    produtoCodigo: produto,
    produtoNome: `Produto ${produto}`,
    canal,
    qtde,
    valorTotal: valor,
  };
}

const MESES = ['2026-07', '2026-08', '2026-09', '2026-10'];
const VENDAS: VendaProduto[] = [
  // A: vende todo mês, despenca em outubro (queda forte)
  venda('2026-07', 'A', 10),
  venda('2026-08', 'A', 10),
  venda('2026-09', 'A', 10),
  venda('2026-10', 'A', 4),
  // B: vendia e parou em outubro
  venda('2026-08', 'B', 5),
  venda('2026-09', 'B', 5, 'oficina'),
  // C: primeira venda em outubro
  venda('2026-10', 'C', 2, 'oficina'),
  // D: dobrou
  venda('2026-09', 'D', 3),
  venda('2026-10', 'D', 3),
  venda('2026-10', 'D', 4, 'oficina'),
];

describe('analisarProdutos', () => {
  const a = analisarProdutos(VENDAS, MESES, new Set(), '2026-10', 'qtde');
  const p = (c: string) => a.produtos.find((x) => x.codigo === c)!;

  it('classifica a situação de cada produto', () => {
    expect(p('A').situacao).toBe('ativo');
    expect(p('A').quedaForte).toBe(true);
    expect(p('B').situacao).toBe('deixou');
    expect(p('B').parouNoMes).toBe(true);
    expect(p('B').ultimaVenda).toBe('2026-09');
    expect(p('B').mesesSemVender).toBe(1);
    expect(p('C').situacao).toBe('novo');
    expect(p('D').subiuForte).toBe(true);
  });

  it('calcula a média dos meses anteriores', () => {
    expect(p('A').mediaAnteriores).toBe(10);
    expect(p('B').mediaAnteriores).toBeCloseTo(10 / 3);
  });

  it('soma os totais do mês com balcão e oficina', () => {
    const t = a.totais.get('2026-10')!;
    expect(t.qtde).toBe(13);
    expect(t.qtdeBalcao).toBe(7);
    expect(t.qtdeOficina).toBe(6);
    expect(t.produtosVendidos).toBe(3);
  });

  it('filtra por canal', () => {
    const oficina = analisarProdutos(VENDAS, MESES, new Set(), '2026-10', 'qtde', 'oficina');
    expect(oficina.produtos.map((x) => x.codigo).sort()).toEqual(['B', 'C', 'D']);
    expect(oficina.produtos.find((x) => x.codigo === 'D')!.situacao).toBe('novo');
  });

  it('compara por valor quando pedido', () => {
    const porValor = analisarProdutos(VENDAS, MESES, new Set(), '2026-10', 'valor');
    expect(porValor.produtos.find((x) => x.codigo === 'A')!.noMes).toBe(40);
  });

  it('mês parcial fica fora da média', () => {
    const comParcial = analisarProdutos(VENDAS, MESES, new Set(['2026-09']), '2026-10', 'qtde');
    expect(comParcial.produtos.find((x) => x.codigo === 'A')!.mediaAnteriores).toBe(10);
    expect(comParcial.produtos.find((x) => x.codigo === 'B')!.mediaAnteriores).toBe(2.5);
  });
});
