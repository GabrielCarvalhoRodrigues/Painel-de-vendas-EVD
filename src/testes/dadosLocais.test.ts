/** Montagem do envio dos dados que ficaram no navegador (versão antiga). */
import { describe, expect, it } from 'vitest';
import { produtosParaEnviar, relatoriosParaEnviar, resumir, temDadosLocais, type DadosLocais } from '../dados/dadosLocais';

const dados: DadosLocais = {
  relatorios: [
    {
      id: '004-2026-10',
      vendedorCodigo: '004',
      vendedorNome: 'RICARDO TAVARES',
      empresa: '001-X',
      dataInicial: '2026-10-01',
      dataFinal: '2026-10-27',
      mes: '2026-10',
      parcial: true,
      nomeArquivo: 'out.csv',
      importadoEm: '2026-10-28T10:00:00Z',
      qtdClientes: 2,
      totalVendido: 150,
    },
  ],
  vendas: [
    { id: '004-2026-10-1', relatorioId: '004-2026-10', vendedorCodigo: '004', mes: '2026-10', clienteCodigo: '1', clienteNome: 'A', prazoMedio: 0, qtdVendas: 1, qtde: 1, valorTotal: 100, valorCusto: 60, resultado: 40 },
    { id: '004-2026-10-2', relatorioId: '004-2026-10', vendedorCodigo: '004', mes: '2026-10', clienteCodigo: '2', clienteNome: 'B', prazoMedio: 0, qtdVendas: 1, qtde: 1, valorTotal: 50, valorCusto: 30, resultado: 20 },
    { id: '007-2026-09-1', relatorioId: '007-2026-09', vendedorCodigo: '007', mes: '2026-09', clienteCodigo: '1', clienteNome: 'A', prazoMedio: 0, qtdVendas: 1, qtde: 1, valorTotal: 9, valorCusto: 5, resultado: 4 },
  ],
  clientes: [
    { codigo: '1', nome: 'A', telefone: '11999990000' },
    { codigo: '2', nome: 'B' },
    { codigo: '3', nome: 'C', statusContato: 'recuperado' },
  ],
  vendedores: [{ codigo: '004', nome: 'Ricardo' }],
  metas: [{ id: '004-2026-10', vendedorCodigo: '004', mes: '2026-10', valor: 50000 }],
  relatoriosProdutos: [
    {
      id: '004-2026-10',
      vendedorCodigo: '004',
      vendedorNome: 'Ricardo',
      mes: '2026-10',
      dataInicial: '2026-10-01',
      dataFinal: '2026-10-27',
      parcial: true,
      nomeArquivo: 'p.csv',
      importadoEm: '2026-10-28T10:00:00Z',
      qtdProdutos: 1,
    },
  ],
  vendasProdutos: [
    { id: '004-2026-10-oficina-0101', relatorioId: '004-2026-10', mes: '2026-10', vendedorCodigo: '004', produtoCodigo: '0101', produtoNome: 'FILTRO', canal: 'oficina', qtde: 2, valorTotal: 80 },
  ],
};

describe('dados locais', () => {
  it('resume o que foi encontrado', () => {
    expect(resumir(dados)).toEqual({ relatorios: 1, relatoriosProdutos: 1, clientes: 3, contatos: 2, metas: 1, vendedores: 1 });
    expect(temDadosLocais(resumir(dados))).toBe(true);
    expect(temDadosLocais(resumir({ ...dados, relatorios: [], relatoriosProdutos: [], clientes: [], metas: [] }))).toBe(false);
  });

  it('remonta cada relatório só com as próprias linhas', () => {
    const [r] = relatoriosParaEnviar(dados);
    expect(r.cabecalho).toMatchObject({ vendedorCodigo: '004', mes: '2026-10', parcial: true });
    expect(r.linhas.map((l) => l.clienteCodigo)).toEqual(['1', '2']);
    expect(r.linhas[0]).not.toHaveProperty('relatorioId');
  });

  it('remonta os produtos por vendedor e mês', () => {
    const [p] = produtosParaEnviar(dados);
    expect(p.vendedores).toEqual([{ codigo: '004', nome: 'Ricardo' }]);
    expect(p.linhas).toHaveLength(1);
    expect(p.linhas[0]).toMatchObject({ vendedorCodigo: '004', canal: 'oficina', qtde: 2 });
  });
});
