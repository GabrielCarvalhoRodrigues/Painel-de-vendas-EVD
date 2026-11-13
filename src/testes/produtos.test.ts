import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ErroImportacao } from '../importacao/lerCsv';
import { canalDaPlaca, lerRelatorioProdutos, lerTextoProdutos } from '../importacao/lerProdutos';

const RELATORIO = [
  'PRODUTOS VENDIDOS;;;;;;;',
  'Empresa : 001-EVALDO AUTO PECAS LTDA;;;;;;;',
  'Data Inicial : 01/10/2026;Data Final : 27/10/2026;;;;;;',
  '',
  'PEDIDO;VENDEDOR;PLACA;CÓDIGO;DESCRIÇÃO;QTDE;VR. TOTAL',
  '1001;004-RICARDO TAVARES;ABC1D23;"0101";"FILTRO DE ÓLEO";2,00;80,00',
  '1001;004-RICARDO TAVARES;ABC1D23;"0202";"PASTILHA DE FREIO";1,00;150,00',
  '1002;004-RICARDO TAVARES;;"0101";"FILTRO DE ÓLEO";3,00;120,00',
  '1003;007-BRUNO LACERDA; - ;"0101";"FILTRO DE ÓLEO";1,00;40,00',
  '1004;007-BRUNO LACERDA;XYZ9876;"0101";"FILTRO DE ÓLEO";4,00;160,00',
  ';;;;TOTAL GERAL;11,00;550,00',
].join('\r\n');

describe('relatório de produtos', () => {
  it('separa por vendedor e por canal (placa = oficina)', () => {
    const r = lerTextoProdutos(RELATORIO, 'p.csv');
    expect(r.mes).toBe('2026-10');
    expect(r.parcial).toBe(true);
    expect(r.vendedores.map((v) => v.codigo).sort()).toEqual(['004', '007']);

    const achar = (v: string, canal: string, cod: string) =>
      r.linhas.find((l) => l.vendedorCodigo === v && l.canal === canal && l.produtoCodigo === cod);
    expect(achar('004', 'oficina', '0101')?.qtde).toBe(2);
    expect(achar('004', 'balcao', '0101')?.qtde).toBe(3);
    expect(achar('004', 'oficina', '0202')?.valorTotal).toBe(150);
    expect(achar('007', 'balcao', '0101')?.qtde).toBe(1);
    expect(achar('007', 'oficina', '0101')?.qtde).toBe(4);
    expect(r.linhas).toHaveLength(5);
  });

  it('lê o relatório MOVIMENTO DE CLIENTES do ERP (placa dentro de "VEÍCULO:")', () => {
    const texto = [
      'EVALDO AUTO PECAS LTDA',
      'MOVIMENTO DE CLIENTES - EVALDO AUTO PEÇAS 07/11/2026 10:57',
      'Vendedor : TODOS',
      'Data Final : 31/10/2026',
      'Data Inicial : 01/10/2026',
      'Placa do Veículo : TODOS',
      '',
      'CLIENTE;TELEFONE;Nº DOC;DATA;;EMP;VEN;CIDADE;CPF/CNPJ;;CÓD;DESCRIÇÃO;;UN;CFOP;QTD;UNIT;VR.TOTAL;CUSTO;%MAR',
      '"A S AUTO LOCADORA LTDA ME";"";"000000147878-NF-1";30/10/2026;"DOC. ORI. 000001040369-PD";"001";"004";"01341 - FORTALEZA-CE";"06.941.212/0001-50";"";"0239024";"FILTRO CABINE ACP303";"";"UN";"5405";1,00;15,20;15,20;9,39;38,22',
      '"ABEL ALVES";"";"000000038290-IF-1";09/10/2026;"DOC. ORI. 000001036335-PD";"001";"009";"01272 - CASCAVEL-CE";"039.725.303-66";"VEÍCULO: RENAULT RE-KWID 1.0 2020 BRANCO - QWS-2F81 - KM: 0000000001";"0287906";"OLEO MOTOR 5W40 1 LITRO";"";"LT";"5405";3,00;84,50;253,50;130,50;48,52',
      '"TOTAL TRANSPORTES";"";"000000038291-IF-1";10/10/2026;"DOC. ORI. 000001036336-PD";"001";"009";"01272 - CASCAVEL-CE";"039.725.303-66";"VEÍCULO: VW GOL 1.0 2015 PRATA - ABC-1234 - KM: 0000000001";"0287906";"OLEO MOTOR 5W40 1 LITRO";"";"LT";"5405";1,00;84,50;84,50;43,50;48,52',
    ].join('\r\n');
    const r = lerTextoProdutos(texto);
    expect(r.mes).toBe('2026-10');
    expect(r.parcial).toBe(false);
    expect(r.linhas).toHaveLength(2);
    expect(r.linhas.find((l) => l.vendedorCodigo === '004')).toMatchObject({ canal: 'balcao', produtoCodigo: '0239024', qtde: 1 });
    expect(r.linhas.find((l) => l.vendedorCodigo === '009')).toMatchObject({ canal: 'oficina', produtoCodigo: '0287906', qtde: 4, valorTotal: 338 });
  });

  it('extrai os veículos com placa do relatório do ERP', () => {
    const texto = [
      'MOVIMENTO DE CLIENTES',
      'Data Final : 31/10/2026',
      'Data Inicial : 01/10/2026',
      'CLIENTE;TELEFONE;Nº DOC;DATA;;EMP;VEN;CIDADE;CPF/CNPJ;;CÓD;DESCRIÇÃO;;UN;CFOP;QTD;UNIT;VR.TOTAL;CUSTO;%MAR',
      '"BALCAO";"";"D-1";05/10/2026;"";"001";"004";"";"";"";"0239024";"FILTRO CABINE";"";"UN";"5405";1,00;15,20;15,20;9,39;38,22',
      '"ABEL ALVES";"85 99999-0000";"D-2";09/10/2026;"";"001";"009";"";"";"VEÍCULO: RENAULT RE-KWID 1.0 2020 BRANCO - QWS-2F81 - KM: 0000000001";"0287906";"OLEO 5W40";"";"LT";"5405";3,00;84,50;253,50;0;0',
      '"ABEL ALVES";"85 99999-0000";"D-2";09/10/2026;"";"001";"009";"";"";"VEÍCULO: RENAULT RE-KWID 1.0 2020 BRANCO - QWS-2F81 - KM: 0000000001";"0101";"FILTRO OLEO";"";"UN";"5405";1,00;30,00;30,00;0;0',
      '"ABEL ALVES";"85 99999-0000";"D-3";20/10/2026;"";"001";"004";"";"";"VEÍCULO: RENAULT RE-KWID 1.0 2020 BRANCO - QWS-2F81 - KM: 0000045210";"0287906";"OLEO 5W40";"";"LT";"5405";1,00;84,50;84,50;0;0',
      '"TOTAL TRANSPORTES";"";"D-4";10/10/2026;"";"001";"009";"";"";"VEÍCULO: VW GOL 1.0 2015 PRATA - ABC-1234 - KM: 0000000001";"0287906";"OLEO 5W40";"";"LT";"5405";1,00;84,50;84,50;0;0',
    ].join('\r\n');
    const r = lerTextoProdutos(texto);
    expect(r.veiculos).toHaveLength(2);
    const [gol, kwid] = r.veiculos!;
    expect(gol).toMatchObject({ placa: 'ABC1234', placaTexto: 'ABC-1234', descricao: 'VW GOL 1.0 2015 PRATA', ano: 2015, km: null, pedidos: 1 });
    expect(kwid).toMatchObject({
      placa: 'QWS2F81',
      descricao: 'RENAULT RE-KWID 1.0 2020 BRANCO',
      ano: 2020,
      km: 45210,
      clienteNome: 'ABEL ALVES',
      clienteTelefone: '85 99999-0000',
      vendedores: ['009', '004'],
      primeiraData: '2026-10-09',
      ultimaData: '2026-10-20',
      pedidos: 2,
      itens: 5,
      valorTotal: 368,
    });
    expect(kwid.produtos.find((p) => p.codigo === '0287906')?.qtde).toBe(4);
  });

  it('lê a placa solta como veículo', () => {
    const r = lerTextoProdutos(RELATORIO);
    expect(r.veiculos!.map((v) => v.placa)).toEqual(['ABC1D23', 'XYZ9876']);
    expect(r.veiculos![0]).toMatchObject({ descricao: '', pedidos: 1, itens: 3, valorTotal: 230 });
  });

  it('classifica a placa', () => {
    expect(canalDaPlaca('VEÍCULO: FORD FO-KA 1.0 2020 BRANCO - ABC-1D23 - KM: 0000000001')).toBe('oficina');
    expect(canalDaPlaca('VEÍCULO: FORD FO-KA 1.0 2020 BRANCO')).toBe('balcao');
    expect(canalDaPlaca('ABC-1234')).toBe('oficina');
    expect(canalDaPlaca('ABC1D23')).toBe('oficina');
    expect(canalDaPlaca('')).toBe('balcao');
    expect(canalDaPlaca(' - ')).toBe('balcao');
    expect(canalDaPlaca('0000000')).toBe('balcao');
  });

  it('usa o vendedor do cabeçalho quando não há coluna VENDEDOR', () => {
    const texto = ['Vendedor : 004-RICARDO TAVARES', 'Data Inicial : 01/09/2026;Data Final : 30/09/2026', 'CODIGO;DESCRICAO;QTDE;PLACA', '10;CORREIA;2,00;'].join('\n');
    const r = lerTextoProdutos(texto);
    expect(r.parcial).toBe(false);
    expect(r.linhas[0]).toMatchObject({ vendedorCodigo: '004', vendedorNome: 'RICARDO TAVARES', canal: 'balcao', qtde: 2 });
  });

  it('exige a coluna PLACA', () => {
    const texto = ['Vendedor : 004-RICARDO', 'Data Inicial : 01/09/2026;Data Final : 30/09/2026', 'CODIGO;DESCRICAO;QTDE', '10;CORREIA;2,00'].join('\n');
    expect(() => lerTextoProdutos(texto)).toThrow(ErroImportacao);
  });

  it('lê o arquivo de exemplo em Windows-1252', () => {
    const r = lerRelatorioProdutos(readFileSync(join(process.cwd(), 'exemplos', 'produtos-2026-10-parcial.csv')));
    expect(r.linhas.length).toBeGreaterThan(0);
    expect(r.linhas.some((l) => l.produtoNome.includes('ÓLEO'))).toBe(true);
    expect(new Set(r.linhas.map((l) => l.canal))).toEqual(new Set(['balcao', 'oficina']));
  });
});

// A gravação (um relatório por vendedor, reenvio substitui) é testada em banco.test.ts.
