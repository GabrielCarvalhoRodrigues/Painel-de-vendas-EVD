/** Mês no formato AAAA-MM (ex.: 2026-10). */
export type Mes = string;

/** Uma linha da tabela do relatório "VENDAS POR MARK-UP" (sintético por cliente). */
export interface LinhaRelatorio {
  clienteCodigo: string;
  clienteNome: string;
  prazoMedio: number;
  qtdVendas: number;
  qtde: number;
  valorTotal: number;
  valorCusto: number;
  resultado: number;
}

export interface CabecalhoRelatorio {
  vendedorCodigo: string;
  vendedorNome: string;
  empresa: string;
  /** AAAA-MM-DD */
  dataInicial: string;
  /** AAAA-MM-DD */
  dataFinal: string;
  mes: Mes;
  parcial: boolean;
}

export interface RelatorioLido {
  cabecalho: CabecalhoRelatorio;
  linhas: LinhaRelatorio[];
  nomeArquivo: string;
}

/** Relatório já salvo (sem as linhas). */
export interface Relatorio extends CabecalhoRelatorio {
  /** vendedorCodigo-mes: só existe um relatório por vendedor e mês. */
  id: string;
  nomeArquivo: string;
  importadoEm: string;
  qtdClientes: number;
  totalVendido: number;
}

export interface Venda extends LinhaRelatorio {
  /** relatorioId-clienteCodigo */
  id: string;
  relatorioId: string;
  vendedorCodigo: string;
  mes: Mes;
}

export type StatusContato = 'nao_contatado' | 'contatado' | 'recuperado';

export interface Cliente {
  codigo: string;
  nome: string;
  telefone?: string;
  anotacao?: string;
  statusContato?: StatusContato;
}

export interface Vendedor {
  codigo: string;
  nome: string;
}

/* ---------- Relatório de produtos vendidos ---------- */

/** Canal da venda: pedido com placa = oficina; sem placa = balcão. */
export type Canal = 'balcao' | 'oficina';

/** Produto vendido por um vendedor no mês, somado por canal. */
export interface LinhaProduto {
  vendedorCodigo: string;
  vendedorNome: string;
  produtoCodigo: string;
  produtoNome: string;
  canal: Canal;
  qtde: number;
  /** 0 quando o relatório não tem coluna de valor. */
  valorTotal: number;
}

export interface RelatorioProdutosLido {
  /** AAAA-MM-DD */
  dataInicial: string;
  /** AAAA-MM-DD */
  dataFinal: string;
  mes: Mes;
  parcial: boolean;
  /** Vendedores presentes no arquivo. */
  vendedores: Vendedor[];
  linhas: LinhaProduto[];
  nomeArquivo: string;
}

/** Relatório de produtos salvo: um por vendedor e mês. */
export interface RelatorioProdutos {
  /** vendedorCodigo-mes */
  id: string;
  vendedorCodigo: string;
  vendedorNome: string;
  mes: Mes;
  dataInicial: string;
  dataFinal: string;
  parcial: boolean;
  nomeArquivo: string;
  importadoEm: string;
  qtdProdutos: number;
}

export interface VendaProduto extends Omit<LinhaProduto, 'vendedorNome'> {
  /** relatorioId-canal-produtoCodigo */
  id: string;
  relatorioId: string;
  mes: Mes;
}

export interface Meta {
  /** vendedorCodigo-mes */
  id: string;
  vendedorCodigo: string;
  mes: Mes;
  valor: number;
}
