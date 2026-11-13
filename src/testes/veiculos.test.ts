import { describe, expect, it } from 'vitest';
import { modelosAtendidos, produtosMaisAplicados, resumoPorVeiculo } from '../regras/veiculos';
import type { VeiculoProduto } from '../tipos';

const item = (p: Partial<VeiculoProduto>): VeiculoProduto => ({
  relatorioId: '1-2026-10', mes: '2026-10', vendedorCodigo: '1',
  placa: 'AAA1A11', placaTexto: 'AAA-1A11', veiculo: 'RENAULT RE-KWID 1.0 2020',
  marca: 'RENAULT', modelo: 'RENAULT RE-KWID 1.0', ano: 2020, km: null,
  clienteNome: 'JOAO', clienteTelefone: '', ultimaData: '2026-10-05', pedidos: 1,
  produtoCodigo: 'P1', produtoNome: 'OLEO', qtde: 1, valorTotal: 10, ...p,
});

describe('regras de veículos', () => {
  const itens = [
    item({ placa: 'AAA1A11', produtoCodigo: 'P1', qtde: 4 }),
    item({ placa: 'AAA1A11', produtoCodigo: 'P2', produtoNome: 'FILTRO' }),
    item({ placa: 'BBB2B22', produtoCodigo: 'P1', qtde: 3 }),
    item({ placa: 'CCC3C33', produtoCodigo: 'P2', produtoNome: 'FILTRO', marca: 'FIAT', modelo: 'FIAT UNO' }),
    item({ placa: 'CCC3C33', produtoCodigo: 'P3', produtoNome: 'PASTILHA', qtde: 10 }),
  ];

  it('ordena produtos por veículos em que foram aplicados', () => {
    const top = produtosMaisAplicados(itens);
    expect(top.map((p) => [p.codigo, p.veiculos, p.qtde])).toEqual([
      ['P1', 2, 7],
      ['P2', 2, 2],
      ['P3', 1, 10],
    ]);
  });

  it('conta veículos por modelo', () => {
    const m = modelosAtendidos(itens);
    expect(m[0]).toMatchObject({ modelo: 'RENAULT RE-KWID 1.0', veiculos: 3 });
    expect(m[1]).toMatchObject({ modelo: 'FIAT UNO', veiculos: 1 });
  });

  it('resume por placa sem contar pedidos repetidos do mesmo relatório', () => {
    const r = resumoPorVeiculo(itens).find((v) => v.placa === 'AAA1A11')!;
    expect(r.pedidos).toBe(1);
    expect(r.qtde).toBe(5);
    expect(r.produtos[0]).toMatchObject({ codigo: 'P1', qtde: 4 });
  });
});
