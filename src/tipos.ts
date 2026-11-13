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

/** Veículo (com placa) atendido no período, extraído do relatório de produtos. */
export interface Veiculo {
  /** Placa sem traço, em maiúsculas (ex.: QWS2F81). */
  placa: string;
  /** Placa como veio no relatório (ex.: QWS-2F81). */
  placaTexto: string;
  /** Marca/modelo/ano/cor como o ERP escreve (vazio quando o relatório só traz a placa). */
  descricao: string;
  ano: number | null;
  /** Maior KM informado (null quando não informado). */
  km: number | null;
  clienteNome: string;
  clienteTelefone: string;
  /** Códigos dos vendedores que atenderam o veículo. */
  vendedores: string[];
  /** AAAA-MM-DD da primeira e da última venda (null sem coluna de data). */
  primeiraData: string | null;
  ultimaData: string | null;
  /** Pedidos/documentos diferentes (ou linhas, quando não há coluna de pedido). */
  pedidos: number;
  itens: number;
  valorTotal: number;
  /** Produtos do veículo, somados por código. */
  produtos: { codigo: string; nome: string; qtde: number; valorTotal: number }[];
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
  /** Veículos com placa encontrados no arquivo (só na leitura; não vai para o banco). */
  veiculos?: Veiculo[];
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
