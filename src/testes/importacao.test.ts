import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { numeroBR } from '../importacao/numeros';
import { decodificar, dividirLinha, ErroImportacao, extrairCabecalho, lerRelatorio, lerTextoRelatorio } from '../importacao/lerCsv';

/** Codifica texto em Windows-1252 (suficiente para os acentos do português). */
function cp1252(texto: string): Uint8Array {
  const bytes = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    if (c > 255) throw new Error(`caractere fora do cp1252: ${texto[i]}`);
    bytes[i] = c;
  }
  return bytes;
}

const RELATORIO = [
  'VENDAS POR MARK-UP;;;;;;;;',
  'Empresa : 001-EVALDO AUTO PECAS LTDA;;;;;;;;',
  'Tipo : SINTÉTICO;Agrupamento : CLIENTE;;;;;;;',
  'Vendedor : 004-RICARDO TAVARES;;;;;;;;',
  'Data Inicial : 01/06/2026;Data Final : 30/06/2026;;;;;;;',
  '',
  'CÓDIGO;CLIENTE;PRAZO MÉDIO;QTD.VENDAS;QTDE;VR. TOTAL;VR. CUSTO;RESULT.;%MARKUP',
  '"00004219";"HELENA BRAGA FONTES";11,06;11,00;20,00;1.434,40;901,59;532,81;59,10',
  '"00000011";"CLIENTE CONSUMIDOR";0,00;35,00;80,00;4.210,00;2.600,00;1.610,00;61,92',
  '"00005120";"JOSÉ CONCEIÇÃO AUTOPEÇAS";28,00;2,00;-3,00;-250,00;-150,00;-100,00;66,67',
  ';TOTAL GERAL;;48,00;97,00;5.394,40;3.351,59;2.042,81;60,95',
].join('\r\n');

describe('números no formato brasileiro', () => {
  it('converte milhar e decimal', () => {
    expect(numeroBR('1.434,40')).toBe(1434.4);
    expect(numeroBR('1.234.567,89')).toBe(1234567.89);
    expect(numeroBR('11,06')).toBe(11.06);
    expect(numeroBR('0,00')).toBe(0);
    expect(numeroBR('532')).toBe(532);
  });

  it('aceita negativos (devolução)', () => {
    expect(numeroBR('-250,00')).toBe(-250);
    expect(numeroBR('-1.434,40')).toBe(-1434.4);
    expect(numeroBR('250,00-')).toBe(-250);
    expect(numeroBR('(12,50)')).toBe(-12.5);
  });

  it('vazio vira zero e texto vira NaN', () => {
    expect(numeroBR('')).toBe(0);
    expect(numeroBR('  ')).toBe(0);
    expect(numeroBR(undefined)).toBe(0);
    expect(numeroBR('"1.000,00"')).toBe(1000);
    expect(numeroBR('abc')).toBeNaN();
  });
});

describe('leitura em Windows-1252', () => {
  it('decodifica os acentos corretamente', () => {
    expect(decodificar(cp1252('CÓDIGO;JOSÉ CONCEIÇÃO;PRAZO MÉDIO'))).toBe('CÓDIGO;JOSÉ CONCEIÇÃO;PRAZO MÉDIO');
  });

  it('lê UTF-8 quando o arquivo tem BOM', () => {
    const utf8 = new TextEncoder().encode('﻿CÓDIGO');
    expect(decodificar(utf8)).toBe('CÓDIGO');
  });

  it('lê o relatório completo a partir dos bytes', () => {
    const r = lerRelatorio(cp1252(RELATORIO), 'junho.csv');
    expect(r.linhas).toHaveLength(3);
    const jose = r.linhas.find((l) => l.clienteCodigo === '00005120')!;
    expect(jose.clienteNome).toBe('JOSÉ CONCEIÇÃO AUTOPEÇAS');
    expect(jose.valorTotal).toBe(-250);
  });
});

describe('cabeçalho do relatório', () => {
  it('extrai vendedor, empresa e período', () => {
    const c = extrairCabecalho(RELATORIO.split('\r\n').slice(0, 6));
    expect(c).toEqual({
      vendedorCodigo: '004',
      vendedorNome: 'RICARDO TAVARES',
      empresa: '001-EVALDO AUTO PECAS LTDA',
      dataInicial: '2026-06-01',
      dataFinal: '2026-06-30',
      mes: '2026-06',
      parcial: false,
    });
  });

  it('marca o mês como parcial quando não vai até o último dia', () => {
    const c = extrairCabecalho(['Vendedor : 004-RICARDO TAVARES', 'Data Inicial : 01/10/2026', 'Data Final : 27/10/2026']);
    expect(c.parcial).toBe(true);
    expect(c.mes).toBe('2026-10');
  });

  it('aceita o cabeçalho entre aspas e o final de fevereiro', () => {
    const c = extrairCabecalho(['"Vendedor : 012-ANA LÚCIA";', '"Data Inicial : 01/02/2028";"Data Final : 29/02/2028"']);
    expect(c.vendedorCodigo).toBe('012');
    expect(c.vendedorNome).toBe('ANA LÚCIA');
    expect(c.parcial).toBe(false);
  });

  it('recusa relatório que pega mais de um mês', () => {
    expect(() =>
      extrairCabecalho(['Vendedor : 004-RICARDO TAVARES', 'Data Inicial : 01/09/2026', 'Data Final : 31/10/2026']),
    ).toThrow(ErroImportacao);
  });

  it('recusa arquivo sem vendedor', () => {
    expect(() => extrairCabecalho(['Data Inicial : 01/09/2026', 'Data Final : 30/09/2026'])).toThrow(/Vendedor/);
  });
});

describe('tabela do relatório', () => {
  const r = lerTextoRelatorio(RELATORIO);

  it('mantém o código do cliente como texto com zeros', () => {
    expect(r.linhas.map((l) => l.clienteCodigo)).toEqual(['00004219', '00000011', '00005120']);
  });

  it('converte todas as colunas da linha de exemplo', () => {
    expect(r.linhas[0]).toEqual({
      clienteCodigo: '00004219',
      clienteNome: 'HELENA BRAGA FONTES',
      prazoMedio: 11.06,
      qtdVendas: 11,
      qtde: 20,
      valorTotal: 1434.4,
      valorCusto: 901.59,
      resultado: 532.81,
    });
  });

  it('ignora a linha de total', () => {
    expect(r.linhas.some((l) => l.clienteNome.includes('TOTAL'))).toBe(false);
  });

  it('soma cliente repetido', () => {
    const texto = RELATORIO + '\r\n"00004219";"HELENA BRAGA FONTES";11,06;1,00;1,00;100,00;60,00;40,00;66,67';
    const helena = lerTextoRelatorio(texto).linhas.find((l) => l.clienteCodigo === '00004219')!;
    expect(helena.valorTotal).toBeCloseTo(1534.4);
    expect(helena.qtdVendas).toBe(12);
  });

  it('explica quando não acha a tabela', () => {
    expect(() => lerTextoRelatorio('Vendedor : 004-X\nqualquer coisa')).toThrow(/CÓDIGO;CLIENTE/);
  });
});

describe('arquivos de exemplo', () => {
  const pasta = join(process.cwd(), 'exemplos');
  const arquivos = readdirSync(pasta).filter((f) => f.startsWith('vendas-') && f.endsWith('.csv'));

  it.each(arquivos)('%s é lido sem erro', (arquivo) => {
    const r = lerRelatorio(readFileSync(join(pasta, arquivo)), arquivo);
    expect(r.linhas.length).toBeGreaterThan(5);
    expect(r.cabecalho.vendedorNome).not.toMatch(/�/);
    expect(r.linhas.every((l) => !l.clienteNome.includes('�'))).toBe(true);
  });
});

describe('dividirLinha', () => {
  it('respeita ponto e vírgula dentro de aspas', () => {
    expect(dividirLinha('"1";"A; B";3')).toEqual(['1', 'A; B', '3']);
  });
});
