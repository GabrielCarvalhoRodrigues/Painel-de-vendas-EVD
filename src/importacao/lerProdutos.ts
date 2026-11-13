import type { Canal, ItemVeiculo, LinhaProduto, RelatorioProdutosLido, Veiculo, Vendedor } from '../tipos';
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
  // Usadas só na lista de veículos (opcionais).
  cliente: ['CLIENTE', 'NOMECLIENTE', 'NOMEDOCLIENTE', 'RAZAOSOCIAL'],
  telefone: ['TELEFONE', 'FONE', 'TEL', 'TEL.', 'CELULAR'],
  pedido: ['PEDIDO', 'NºDOC', 'N°DOC', 'NODOC', 'N.DOC', 'NUMDOC', 'DOCUMENTO', 'DOC', 'NUMPEDIDO', 'NOTA'],
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

const PLACA_PARTES = /(?:^|[^A-Z0-9])([A-Z]{3})-?(\d[A-Z0-9]\d{2})(?![A-Z0-9])/;

export type VeiculoLido = Pick<Veiculo, 'placa' | 'placaTexto' | 'descricao' | 'marca' | 'modelo' | 'ano' | 'km'>;

/**
 * Marca e modelo a partir da descrição do ERP:
 * "RENAULT RE-KWID 1.0 2020 BRANCO" → marca RENAULT, modelo "RENAULT RE-KWID 1.0" (tudo antes do ano).
 * Sem ano, o modelo é a descrição inteira.
 */
export function marcaModelo(descricao: string): { marca: string; modelo: string } {
  const d = descricao.replace(/\s+/g, ' ').trim().toUpperCase();
  if (!d) return { marca: '', modelo: '' };
  const anos = [...d.matchAll(/\b(?:19[5-9]\d|20\d{2})\b/g)];
  const ano = anos.at(-1);
  const modelo = (ano && ano.index! > 0 ? d.slice(0, ano.index) : d).trim();
  return { marca: d.split(' ')[0], modelo };
}

/**
 * Lê o veículo de "VEÍCULO: RENAULT RE-KWID 1.0 2020 BRANCO - QWS-2F81 - KM: 0000000001"
 * ou de uma placa solta ("ABC1D23"). Sem placa, devolve null.
 */
export function lerVeiculo(texto: string | undefined): VeiculoLido | null {
  const t = (texto ?? '').replace(/"/g, '').trim().toUpperCase();
  const m = t.match(PLACA_PARTES);
  if (!m) return null;
  const inicioPlaca = m.index! + m[0].indexOf(m[1]);
  const descricao = t
    .slice(0, inicioPlaca)
    .replace(/^VE[IÍ]CULO\s*:\s*/, '')
    .replace(/[\s-]+$/, '')
    .trim();
  const anos = descricao.match(/\b(?:19[5-9]\d|20\d{2})\b/g);
  const km = t.slice(inicioPlaca).match(/KM\s*:?\s*(\d+)/);
  const kmNum = km ? Number(km[1]) : NaN;
  return {
    placa: m[1] + m[2],
    placaTexto: `${m[1]}-${m[2]}`,
    descricao,
    ...marcaModelo(descricao),
    ano: anos ? Number(anos.at(-1)) : null,
    // O ERP grava 0000000001 quando o KM não foi informado.
    km: kmNum > 1 ? kmNum : null,
  };
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
  const veiculos = new Map<string, Veiculo & { docs: Set<string> }>();
  /** Por vendedor|placa: pedidos e dados do veículo; por vendedor|placa|produto: quantidades. */
  const docsVendedorPlaca = new Map<string, Set<string>>();
  const itensVeiculo = new Map<string, ItemVeiculo>();
  const campo = (campos: string[], i: number | undefined) => (i !== undefined ? (campos[i] ?? '').replace(/"/g, '').trim() : '');

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

    let dataLinha: string | null = null;
    if (col.data !== undefined) {
      const d = (campos[col.data] ?? '').match(/(\d{2}\/\d{2}\/\d{4})/);
      if (d) {
        dataLinha = dataIso(d[1]);
        datas.push(dataLinha);
      }
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

    // Veículo com placa: junta tudo o que foi vendido para ele no período.
    const lido = canal === 'oficina' ? lerVeiculo(campos[col.placa]) : null;
    if (lido) {
      let v = veiculos.get(lido.placa);
      if (!v) {
        v = {
          ...lido,
          clienteNome: '',
          clienteTelefone: '',
          vendedores: [],
          primeiraData: null,
          ultimaData: null,
          pedidos: 0,
          itens: 0,
          valorTotal: 0,
          produtos: [],
          docs: new Set(),
        };
        veiculos.set(lido.placa, v);
      }
      if (lido.descricao.length > v.descricao.length) Object.assign(v, { descricao: lido.descricao, marca: lido.marca, modelo: lido.modelo });
      if (lido.ano && !v.ano) v.ano = lido.ano;
      if (lido.km && (!v.km || lido.km > v.km)) v.km = lido.km;
      const cliente = campo(campos, col.cliente);
      const fone = campo(campos, col.telefone);
      if (cliente) v.clienteNome = cliente;
      if (fone) v.clienteTelefone = fone;
      if (!v.vendedores.includes(vendedor.codigo)) v.vendedores.push(vendedor.codigo);
      if (dataLinha) {
        if (!v.primeiraData || dataLinha < v.primeiraData) v.primeiraData = dataLinha;
        if (!v.ultimaData || dataLinha > v.ultimaData) v.ultimaData = dataLinha;
      }
      const doc = campo(campos, col.pedido) || `linha-${n}`;
      v.docs.add(doc);

      const chaveVP = `${vendedor.codigo}|${lido.placa}`;
      const docs = docsVendedorPlaca.get(chaveVP) ?? new Set<string>();
      docs.add(doc);
      docsVendedorPlaca.set(chaveVP, docs);
      const chaveItem = `${chaveVP}|${codigo}`;
      const item = itensVeiculo.get(chaveItem);
      if (item) {
        item.qtde += qtde;
        item.valorTotal += valorTotal;
        if (dataLinha && (!item.ultimaData || dataLinha > item.ultimaData)) item.ultimaData = dataLinha;
      } else {
        itensVeiculo.set(chaveItem, {
          vendedorCodigo: vendedor.codigo,
          placa: lido.placa,
          placaTexto: lido.placaTexto,
          veiculo: '',
          marca: '',
          modelo: '',
          ano: null,
          km: null,
          clienteNome: '',
          clienteTelefone: '',
          ultimaData: dataLinha,
          pedidos: 0,
          produtoCodigo: codigo,
          produtoNome: nome || codigo,
          qtde,
          valorTotal,
        });
      }
      v.itens += qtde;
      v.valorTotal += valorTotal;
      const p = v.produtos.find((x) => x.codigo === codigo);
      if (p) {
        p.qtde += qtde;
        p.valorTotal += valorTotal;
      } else {
        v.produtos.push({ codigo, nome: nome || codigo, qtde, valorTotal });
      }
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

  const listaVeiculos: Veiculo[] = [...veiculos.values()]
    .map(({ docs, ...v }) => ({ ...v, pedidos: docs.size }))
    .sort((a, b) => a.placa.localeCompare(b.placa));

  // Os dados do veículo (descrição, KM, cliente) vêm do resumo por placa.
  const listaItens: ItemVeiculo[] = [...itensVeiculo.values()].map((i) => {
    const v = veiculos.get(i.placa)!;
    return {
      ...i,
      placaTexto: v.placaTexto,
      veiculo: v.descricao,
      marca: v.marca,
      modelo: v.modelo,
      ano: v.ano,
      km: v.km,
      clienteNome: v.clienteNome,
      clienteTelefone: v.clienteTelefone,
      pedidos: docsVendedorPlaca.get(`${i.vendedorCodigo}|${i.placa}`)?.size ?? 0,
    };
  });

  return { dataInicial, dataFinal, mes, parcial, vendedores, linhas: linhasProduto, veiculos: listaVeiculos, itensVeiculo: listaItens, nomeArquivo };
}

export function lerRelatorioProdutos(bytes: ArrayBuffer | Uint8Array, nomeArquivo = ''): RelatorioProdutosLido {
  return lerTextoProdutos(decodificar(bytes), nomeArquivo);
}
