import type { Canal, LinhaProduto, RelatorioProdutosLido, Vendedor } from '../tipos';
import { mesDeData, ultimoDiaDoMes } from '../utils/meses';
import { decodificar, dividirLinha, ErroImportacao, normalizar } from './lerCsv';
import { numeroBR } from './numeros';

/**
 * Leitor do relatório de produtos vendidos (um item por linha, com a placa do pedido).
 * As colunas são achadas pelo nome do título, em qualquer ordem. Para aceitar outro
 * nome de coluna do ERP, basta acrescentá-lo na lista abaixo (sem acento e sem espaço).
 */
const NOMES_COLUNA = {
  produtoCodigo: ['CODIGO', 'CODPRODUTO', 'COD.PRODUTO', 'CODIGOPRODUTO', 'CODIGODOPRODUTO', 'COD.PROD', 'CODPROD', 'COD.PROD.', 'REFERENCIA', 'COD.', 'COD'],
  produtoNome: ['DESCRICAO', 'DESCRICAODOPRODUTO', 'DESCRICAOPRODUTO', 'NOMEPRODUTO', 'NOMEDOPRODUTO', 'PRODUTO', 'NOME'],
  qtde: ['QTDE', 'QTDE.', 'QUANTIDADE', 'QTD', 'QTD.', 'QUANT.', 'QUANT'],
  placa: ['PLACA', 'PLACAVEICULO', 'PLACADOVEICULO', 'VEICULO'],
  vendedor: ['VENDEDOR', 'VEN', 'VEN.', 'COD.VENDEDOR', 'CODVENDEDOR', 'CODIGOVENDEDOR', 'VEND.', 'VEND'],
  valorTotal: ['VR.TOTAL', 'VLR.TOTAL', 'VALORTOTAL', 'TOTAL', 'VALOR'],
  data: ['DATA', 'EMISSAO', 'DATAEMISSAO', 'DT.EMISSAO', 'DATADAVENDA', 'DATAVENDA'],
} as const;

type Coluna = keyof typeof NOMES_COLUNA;
type Indices = Partial<Record<Coluna, number>>;

/** Acha a coluna de cada campo na linha de títulos (cada coluna só serve a um campo). */
function acharColunas(titulos: string[]): Indices {
  const indices: Indices = {};
  const usadas = new Set<number>();
  for (const campo of Object.keys(NOMES_COLUNA) as Coluna[]) {
    for (const nome of NOMES_COLUNA[campo]) {
      const i = titulos.findIndex((t, n) => t === nome && !usadas.has(n));
      if (i >= 0) {
        indices[campo] = i;
        usadas.add(i);
        break;
      }
    }
  }
  return indices;
}

function dataIso(dataBr: string): string {
  const [d, m, a] = dataBr.split('/');
  return `${a}-${m}-${d}`;
}

/** "004-RICARDO TAVARES", "004 - RICARDO" ou "004" → { codigo, nome }. */
function lerVendedor(texto: string): Vendedor | null {
  const m = texto.replace(/"/g, '').trim().match(/^(\d+)\s*(?:-\s*(.*))?$/);
  if (!m) return null;
  return { codigo: m[1], nome: (m[2] ?? '').trim() };
}

/** Placa antiga (ABC-1234) ou Mercosul (ABC1D23), solta ou dentro de um texto. */
const PLACA = /(?:^|[^A-Z0-9])[A-Z]{3}-?\d[A-Z0-9]\d{2}(?![A-Z0-9])/;

/**
 * Pedido com placa é venda de oficina. Aceita a placa sozinha ("ABC-1D23") ou o texto
 * do ERP ("VEÍCULO: FORD KA 1.0 2020 BRANCO - ABC-1D23 - KM: 0000000001").
 */
export function canalDaPlaca(texto: string | undefined): Canal {
  return PLACA.test((texto ?? '').toUpperCase()) ? 'oficina' : 'balcao';
}

/** Coluna sem título onde o ERP põe "VEÍCULO: ..." (procura nas primeiras linhas de dados). */
function acharColunaVeiculo(linhas: string[], inicio: number): number | undefined {
  for (let n = inicio + 1; n < Math.min(linhas.length, inicio + 3000); n++) {
    const i = dividirLinha(linhas[n]).findIndex((c) => /^VE[IÍ]CULO\s*:/i.test(c));
    if (i >= 0) return i;
  }
  return undefined;
}

export function lerTextoProdutos(texto: string, nomeArquivo = ''): RelatorioProdutosLido {
  const linhas = texto.split(/\r?\n/);

  // Linha de títulos: a primeira que tem quantidade e código ou descrição do produto.
  let inicio = -1;
  let col: Indices = {};
  for (let n = 0; n < linhas.length; n++) {
    const c = acharColunas(dividirLinha(linhas[n]).map(normalizar));
    if (c.qtde !== undefined && (c.produtoCodigo !== undefined || c.produtoNome !== undefined)) {
      inicio = n;
      col = c;
      break;
    }
  }
  if (inicio < 0) {
    throw new ErroImportacao('Não encontrei a tabela de produtos (linha de títulos com CÓDIGO/DESCRIÇÃO e QTDE).');
  }
  if (col.placa === undefined) col.placa = acharColunaVeiculo(linhas, inicio);
  if (col.placa === undefined) {
    throw new ErroImportacao('Não encontrei a coluna PLACA (nem "VEÍCULO:"). Ela é necessária para separar Vendas Balcão e Vendas oficina.');
  }

  const textoCabecalho = linhas
    .slice(0, inicio)
    .map((l) => l.replace(/"/g, ''))
    .join('\n');
  const inicial = textoCabecalho.match(/Data\s+Inicial\s*:\s*(\d{2}\/\d{2}\/\d{4})/i);
  const final = textoCabecalho.match(/Data\s+Final\s*:\s*(\d{2}\/\d{2}\/\d{4})/i);

  const titulos = dividirLinha(linhas[inicio]).map(normalizar).join(';');
  const nomesVendedor = new Map<string, string>();
  // "as": o valor muda dentro de lerGrupoVendedor, e o TypeScript não enxerga isso.
  let vendedorAtual = null as Vendedor | null;
  const datas: string[] = [];
  const soma = new Map<string, LinhaProduto>();

  const lerGrupoVendedor = (linha: string) => {
    const m = linha.replace(/"/g, '').match(/Vendedor\s*:\s*(\d+)\s*-\s*([^;\n]+)/i);
    if (m) vendedorAtual = { codigo: m[1].trim(), nome: m[2].trim() };
  };
  // Vendedor no cabeçalho, para relatórios de um vendedor só.
  linhas.slice(0, inicio).forEach(lerGrupoVendedor);

  for (let n = inicio + 1; n < linhas.length; n++) {
    const bruta = linhas[n];
    if (!bruta.replace(/[;"\s]/g, '')) continue;
    const campos = dividirLinha(bruta);
    if (campos.map(normalizar).join(';') === titulos) continue; // título repetido (quebra de página)
    let codigo = col.produtoCodigo !== undefined ? (campos[col.produtoCodigo] ?? '').trim() : '';
    let nome = col.produtoNome !== undefined ? (campos[col.produtoNome] ?? '').trim() : '';
    const qtdeTexto = (campos[col.qtde!] ?? '').trim();

    // Linhas de total: sem código de produto, ou com "TOTAL" no lugar do código/descrição.
    if (/^TOTAL/.test(normalizar(codigo)) || (!codigo && /^TOTAL/.test(normalizar(nome)))) continue;

    // Com coluna de código, linha sem código não é produto (grupo, subtotal ou texto).
    if ((col.produtoCodigo !== undefined && !codigo) || (!codigo && !nome)) {
      // Linha de grupo (ex.: "Vendedor : 004-RICARDO TAVARES") ou de texto.
      lerGrupoVendedor(bruta);
      continue;
    }
    if (!qtdeTexto) {
      lerGrupoVendedor(bruta);
      continue;
    }
    // Sem coluna de código: tenta "12345 - FILTRO DE ÓLEO".
    if (!codigo) {
      const m = nome.match(/^(\S+)\s+-\s+(.+)$/);
      if (m) [, codigo, nome] = m;
      else codigo = nome;
    }

    const qtde = numeroBR(qtdeTexto);
    if (Number.isNaN(qtde)) throw new ErroImportacao(`Linha ${n + 1}: quantidade inválida ("${qtdeTexto}").`);
    let valorTotal = 0;
    if (col.valorTotal !== undefined && campos[col.valorTotal]?.trim()) {
      valorTotal = numeroBR(campos[col.valorTotal]);
      if (Number.isNaN(valorTotal)) throw new ErroImportacao(`Linha ${n + 1}: valor inválido ("${campos[col.valorTotal]}").`);
    }

    let vendedor: Vendedor | null = vendedorAtual;
    if (col.vendedor !== undefined) {
      const v = lerVendedor(campos[col.vendedor] ?? '');
      if (v) vendedor = { codigo: v.codigo, nome: v.nome || nomesVendedor.get(v.codigo) || (vendedorAtual?.codigo === v.codigo ? vendedorAtual.nome : '') };
    }
    if (!vendedor) {
      throw new ErroImportacao(`Linha ${n + 1}: não achei o vendedor (nem coluna VENDEDOR, nem "Vendedor :" no relatório).`);
    }
    if (vendedor.nome) nomesVendedor.set(vendedor.codigo, vendedor.nome);

    if (col.data !== undefined) {
      const d = (campos[col.data] ?? '').match(/(\d{2}\/\d{2}\/\d{4})/);
      if (d) datas.push(dataIso(d[1]));
    }

    const canal = canalDaPlaca(campos[col.placa]);
    const chave = `${vendedor.codigo}|${canal}|${codigo}`;
    const existente = soma.get(chave);
    if (existente) {
      existente.qtde += qtde;
      existente.valorTotal += valorTotal;
    } else {
      soma.set(chave, {
        vendedorCodigo: vendedor.codigo,
        vendedorNome: vendedor.nome,
        produtoCodigo: codigo,
        produtoNome: nome || codigo,
        canal,
        qtde,
        valorTotal,
      });
    }
  }

  if (soma.size === 0) throw new ErroImportacao('O relatório não tem nenhuma linha de produto.');

  // Período: pelo cabeçalho; se não houver, pelas datas das vendas (do dia 1 até a última venda).
  let dataInicial: string;
  let dataFinal: string;
  if (inicial && final) {
    dataInicial = dataIso(inicial[1]);
    dataFinal = dataIso(final[1]);
  } else if (datas.length) {
    datas.sort();
    dataFinal = datas.at(-1)!;
    dataInicial = `${mesDeData(datas[0])}-01`;
  } else {
    throw new ErroImportacao('Não encontrei o período: nem "Data Inicial"/"Data Final" no cabeçalho, nem coluna DATA.');
  }
  const mes = mesDeData(dataInicial);
  if (mesDeData(dataFinal) !== mes) {
    throw new ErroImportacao('O relatório tem vendas de mais de um mês. Exporte um relatório por mês.');
  }
  const parcial = Number(dataInicial.slice(8, 10)) !== 1 || Number(dataFinal.slice(8, 10)) !== ultimoDiaDoMes(mes);

  const linhasProduto = [...soma.values()];
  for (const l of linhasProduto) if (!l.vendedorNome) l.vendedorNome = nomesVendedor.get(l.vendedorCodigo) ?? `Vendedor ${l.vendedorCodigo}`;
  const vendedores = [...new Map(linhasProduto.map((l) => [l.vendedorCodigo, { codigo: l.vendedorCodigo, nome: l.vendedorNome }])).values()];

  return { dataInicial, dataFinal, mes, parcial, vendedores, linhas: linhasProduto, nomeArquivo };
}

export function lerRelatorioProdutos(bytes: ArrayBuffer | Uint8Array, nomeArquivo = ''): RelatorioProdutosLido {
  return lerTextoProdutos(decodificar(bytes), nomeArquivo);
}
