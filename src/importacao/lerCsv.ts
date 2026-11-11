import type { CabecalhoRelatorio, LinhaRelatorio, RelatorioLido } from '../tipos';
import { mesDeData, ultimoDiaDoMes } from '../utils/meses';
import { numeroBR } from './numeros';

export class ErroImportacao extends Error {}

/**
 * Decodifica os bytes do arquivo. O ERP exporta em Windows-1252; se o arquivo
 * vier com BOM de UTF-8 (por ter sido salvo de novo no Excel, por exemplo), lê como UTF-8.
 */
export function decodificar(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(u8.subarray(3));
  }
  return new TextDecoder('windows-1252').decode(u8);
}

/** Divide uma linha por ';' respeitando campos entre aspas. */
export function dividirLinha(linha: string): string[] {
  const campos: string[] = [];
  let atual = '';
  let entreAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (entreAspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else {
        entreAspas = !entreAspas;
      }
    } else if (c === ';' && !entreAspas) {
      campos.push(atual.trim());
      atual = '';
    } else {
      atual += c;
    }
  }
  campos.push(atual.trim());
  return campos;
}

/** Maiúsculas, sem acentos, sem aspas e sem espaços: "VR. TOTAL" → "VR.TOTAL". */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/["\s]/g, '')
    .toUpperCase();
}

function dataIso(dataBr: string): string {
  const [d, m, a] = dataBr.split('/');
  return `${a}-${m}-${d}`;
}

/** Extrai vendedor, empresa e período das linhas de texto antes da tabela. */
export function extrairCabecalho(linhas: string[]): CabecalhoRelatorio {
  const texto = linhas.map((l) => l.replace(/"/g, '')).join('\n');

  const vendedor = texto.match(/Vendedor\s*:\s*(\d+)\s*-\s*([^;\n]+)/i);
  const inicial = texto.match(/Data\s+Inicial\s*:\s*(\d{2}\/\d{2}\/\d{4})/i);
  const final = texto.match(/Data\s+Final\s*:\s*(\d{2}\/\d{2}\/\d{4})/i);
  const empresa = texto.match(/Empresa\s*:\s*([^;\n]+)/i);

  if (!vendedor) throw new ErroImportacao('Não encontrei a linha "Vendedor :" no cabeçalho do relatório.');
  if (!inicial || !final) throw new ErroImportacao('Não encontrei "Data Inicial" e "Data Final" no cabeçalho do relatório.');

  const dataInicial = dataIso(inicial[1]);
  const dataFinal = dataIso(final[1]);
  const mes = mesDeData(dataInicial);
  if (mesDeData(dataFinal) !== mes) {
    throw new ErroImportacao(
      `O relatório vai de ${inicial[1]} a ${final[1]}. Exporte um relatório por mês (do dia 1 ao último dia).`,
    );
  }
  const diaInicial = Number(dataInicial.slice(8, 10));
  const diaFinal = Number(dataFinal.slice(8, 10));
  const parcial = diaInicial !== 1 || diaFinal !== ultimoDiaDoMes(mes);

  return {
    vendedorCodigo: vendedor[1].trim(),
    vendedorNome: vendedor[2].trim(),
    empresa: empresa ? empresa[1].trim() : '',
    dataInicial,
    dataFinal,
    mes,
    parcial,
  };
}

const COLUNAS: Record<string, keyof LinhaRelatorio> = {
  CODIGO: 'clienteCodigo',
  CLIENTE: 'clienteNome',
  PRAZOMEDIO: 'prazoMedio',
  'QTD.VENDAS': 'qtdVendas',
  QTDE: 'qtde',
  'VR.TOTAL': 'valorTotal',
  'VR.CUSTO': 'valorCusto',
  'RESULT.': 'resultado',
};

/** Lê o texto completo do relatório "VENDAS POR MARK-UP". */
export function lerTextoRelatorio(texto: string, nomeArquivo = ''): RelatorioLido {
  const linhas = texto.split(/\r?\n/);
  const inicioTabela = linhas.findIndex((l) => normalizar(l).startsWith('CODIGO;CLIENTE;'));
  if (inicioTabela < 0) {
    throw new ErroImportacao(
      'Não encontrei a tabela do relatório (linha que começa com "CÓDIGO;CLIENTE;"). Confira se é o relatório VENDAS POR MARK-UP sintético por cliente.',
    );
  }

  const cabecalho = extrairCabecalho(linhas.slice(0, inicioTabela));

  const titulos = dividirLinha(linhas[inicioTabela]).map(normalizar);
  const indice: Partial<Record<keyof LinhaRelatorio, number>> = {};
  titulos.forEach((t, i) => {
    const campo = COLUNAS[t];
    if (campo && indice[campo] === undefined) indice[campo] = i;
  });
  const faltando = Object.entries(COLUNAS)
    .filter(([, campo]) => indice[campo] === undefined)
    .map(([t]) => t);
  if (faltando.length) throw new ErroImportacao(`Colunas não encontradas no relatório: ${faltando.join(', ')}.`);

  // Um mesmo cliente pode aparecer mais de uma vez; somamos.
  const porCliente = new Map<string, LinhaRelatorio>();
  for (let n = inicioTabela + 1; n < linhas.length; n++) {
    const campos = dividirLinha(linhas[n]);
    const codigo = (campos[indice.clienteCodigo!] ?? '').trim();
    // Linhas de total, rodapé ou em branco não têm código numérico.
    if (!/^\d+$/.test(codigo)) continue;

    const valor = (campo: keyof LinhaRelatorio) => {
      const v = numeroBR(campos[indice[campo]!]);
      if (Number.isNaN(v)) {
        throw new ErroImportacao(`Linha ${n + 1}: valor inválido na coluna ${campo} ("${campos[indice[campo]!]}").`);
      }
      return v;
    };

    const linha: LinhaRelatorio = {
      clienteCodigo: codigo,
      clienteNome: (campos[indice.clienteNome!] ?? '').trim(),
      prazoMedio: valor('prazoMedio'),
      qtdVendas: valor('qtdVendas'),
      qtde: valor('qtde'),
      valorTotal: valor('valorTotal'),
      valorCusto: valor('valorCusto'),
      resultado: valor('resultado'),
    };

    const existente = porCliente.get(codigo);
    if (existente) {
      const somaVendas = existente.qtdVendas + linha.qtdVendas;
      existente.prazoMedio = somaVendas
        ? (existente.prazoMedio * existente.qtdVendas + linha.prazoMedio * linha.qtdVendas) / somaVendas
        : existente.prazoMedio;
      existente.qtdVendas = somaVendas;
      existente.qtde += linha.qtde;
      existente.valorTotal += linha.valorTotal;
      existente.valorCusto += linha.valorCusto;
      existente.resultado += linha.resultado;
    } else {
      porCliente.set(codigo, linha);
    }
  }

  if (porCliente.size === 0) throw new ErroImportacao('O relatório não tem nenhuma linha de cliente.');

  return { cabecalho, linhas: [...porCliente.values()], nomeArquivo };
}

/** Lê os bytes de um arquivo CSV exportado do ERP. */
export function lerRelatorio(bytes: ArrayBuffer | Uint8Array, nomeArquivo = ''): RelatorioLido {
  return lerTextoRelatorio(decodificar(bytes), nomeArquivo);
}
