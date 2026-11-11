import type { Mes, Venda } from '../tipos';
import { diferencaMeses, mesAnterior, ultimoDiaDoMes } from '../utils/meses';

/** Código do cadastro genérico de balcão. */
export const CODIGO_BALCAO = '00000011';

export function ehBalcao(codigo: string, nome = ''): boolean {
  return codigo === CODIGO_BALCAO || /^CLIENTE CONSUMIDOR$/i.test(nome.trim());
}

export type Situacao = 'ativo' | 'novo' | 'voltou' | 'deixou' | 'nao_voltou' | 'sem_compra';

export const NOME_SITUACAO: Record<Situacao, string> = {
  ativo: 'Ativo',
  novo: 'Novo',
  voltou: 'Voltou a comprar',
  deixou: 'Deixou de comprar',
  nao_voltou: 'Não voltou (1 compra)',
  sem_compra: 'Sem compra',
};

/** Markup = resultado ÷ custo (recalculado, não usa a coluna do arquivo). */
export function markup(resultado: number, custo: number): number | null {
  return custo > 0 ? resultado / custo : null;
}

/** Comprou no mês = valor total maior que zero. Zero ou negativo (só devolução) não conta. */
export function comprou(valor: number | undefined): boolean {
  return (valor ?? 0) > 0;
}

/**
 * Situação do cliente no mês de referência.
 * @param valorNoMes valor total do cliente em cada mês (0 se não houver)
 * @param mesesImportados meses que têm relatório importado
 */
export function situacaoCliente(valorNoMes: (mes: Mes) => number, mesesImportados: Mes[], mesRef: Mes): Situacao {
  const mesesComCompraAntes = mesesImportados.filter((m) => m < mesRef && comprou(valorNoMes(m))).length;
  if (comprou(valorNoMes(mesRef))) {
    if (comprou(valorNoMes(mesAnterior(mesRef)))) return 'ativo';
    if (mesesComCompraAntes === 0) return 'novo';
    return 'voltou';
  }
  if (mesesComCompraAntes >= 2) return 'deixou';
  if (mesesComCompraAntes === 1) return 'nao_voltou';
  return 'sem_compra';
}

/** Queda forte: comprou no mês, mas mais de 50% abaixo do mês anterior. */
export function ehQuedaForte(valorMes: number, valorAnterior: number | null): boolean {
  return comprou(valorMes) && valorAnterior != null && comprou(valorAnterior) && valorMes < valorAnterior * 0.5;
}

/** Subiu forte: mais de 50% acima do mês anterior. */
export function ehSubidaForte(valorMes: number, valorAnterior: number | null): boolean {
  return comprou(valorMes) && valorAnterior != null && comprou(valorAnterior) && valorMes > valorAnterior * 1.5;
}

/** Média mensal: média dos meses fechados (o mês parcial fica de fora). */
export function mediaMensal(valorNoMes: (mes: Mes) => number, meses: Mes[], parciais: Set<Mes>): number | null {
  const fechados = meses.filter((m) => !parciais.has(m));
  if (!fechados.length) return null;
  return fechados.reduce((s, m) => s + valorNoMes(m), 0) / fechados.length;
}

export function variacao(atual: number, anterior: number | null): number | null {
  if (anterior == null || anterior <= 0) return null;
  return (atual - anterior) / anterior;
}

// ---------------------------------------------------------------------------

export interface Agregado {
  valorTotal: number;
  valorCusto: number;
  resultado: number;
  qtdVendas: number;
  qtde: number;
  prazoMedio: number;
}

function agregadoVazio(): Agregado {
  return { valorTotal: 0, valorCusto: 0, resultado: 0, qtdVendas: 0, qtde: 0, prazoMedio: 0 };
}

function somar(a: Agregado, v: Agregado) {
  const vendas = a.qtdVendas + v.qtdVendas;
  a.prazoMedio = vendas ? (a.prazoMedio * a.qtdVendas + v.prazoMedio * v.qtdVendas) / vendas : a.prazoMedio;
  a.qtdVendas = vendas;
  a.qtde += v.qtde;
  a.valorTotal += v.valorTotal;
  a.valorCusto += v.valorCusto;
  a.resultado += v.resultado;
}

export interface ClienteAnalise {
  codigo: string;
  nome: string;
  balcao: boolean;
  porMes: Map<Mes, Agregado>;
  /** Dados do mês de referência (null se o cliente não aparece no relatório do mês). */
  atual: Agregado | null;
  valorAtual: number;
  /** null quando o mês anterior não foi importado. */
  valorAnterior: number | null;
  variacao: number | null;
  markup: number | null;
  situacao: Situacao;
  quedaForte: boolean;
  subiuForte: boolean;
  /** Comprou no mês anterior e não comprou no mês de referência. */
  parouNoMes: boolean;
  totalPeriodo: number;
  /** Média dos meses fechados até o mês de referência. */
  mediaMensal: number | null;
  /** Média dos meses fechados anteriores ao mês de referência. */
  mediaAnteriores: number | null;
  primeiraCompra: Mes | null;
  ultimaCompra: Mes | null;
  mesesSemComprar: number | null;
  diasSemComprar: number | null;
}

export interface TotaisMes {
  mes: Mes;
  faturamento: number;
  custo: number;
  resultado: number;
  markup: number | null;
  clientesCompraram: number;
  ticketMedio: number | null;
  /** Soma dos valores negativos (clientes cujo líquido do mês foi devolução). */
  devolucao: number;
}

export interface Analise {
  mesRef: Mes;
  mesAnt: Mes;
  mesAntImportado: boolean;
  /** Meses importados até o mês de referência. */
  meses: Mes[];
  parciais: Set<Mes>;
  clientes: ClienteAnalise[];
  totais: Map<Mes, TotaisMes>;
}

export function totaisDoMes(mes: Mes, vendas: Venda[]): TotaisMes {
  const doMes = vendas.filter((v) => v.mes === mes);
  const porCliente = new Map<string, number>();
  let faturamento = 0;
  let custo = 0;
  let resultado = 0;
  for (const v of doMes) {
    faturamento += v.valorTotal;
    custo += v.valorCusto;
    resultado += v.resultado;
    porCliente.set(v.clienteCodigo, (porCliente.get(v.clienteCodigo) ?? 0) + v.valorTotal);
  }
  const valores = [...porCliente.values()];
  const clientesCompraram = valores.filter(comprou).length;
  return {
    mes,
    faturamento,
    custo,
    resultado,
    markup: markup(resultado, custo),
    clientesCompraram,
    ticketMedio: clientesCompraram ? faturamento / clientesCompraram : null,
    devolucao: valores.filter((v) => v < 0).reduce((s, v) => s + -v, 0),
  };
}

/**
 * Monta a análise de todos os clientes no mês de referência.
 * @param vendas vendas já filtradas pelo vendedor escolhido (ou todas)
 * @param mesesImportados meses com relatório no filtro atual
 * @param dataReferencia data final do relatório do mês de referência (AAAA-MM-DD), para contar dias
 */
export function analisar(
  vendas: Venda[],
  mesesImportados: Mes[],
  parciais: Set<Mes>,
  mesRef: Mes,
  dataReferencia?: string,
): Analise {
  const meses = [...new Set(mesesImportados)].filter((m) => m <= mesRef).sort();
  const mesAnt = mesAnterior(mesRef);
  const mesAntImportado = meses.includes(mesAnt);
  const vendasAte = vendas.filter((v) => v.mes <= mesRef);

  const mapa = new Map<string, { nome: string; porMes: Map<Mes, Agregado> }>();
  for (const v of vendasAte) {
    let c = mapa.get(v.clienteCodigo);
    if (!c) {
      c = { nome: v.clienteNome, porMes: new Map() };
      mapa.set(v.clienteCodigo, c);
    }
    if (v.mes === mesRef || !c.nome) c.nome = v.clienteNome || c.nome;
    let ag = c.porMes.get(v.mes);
    if (!ag) {
      ag = agregadoVazio();
      c.porMes.set(v.mes, ag);
    }
    somar(ag, v);
  }

  const fimRef = dataReferencia ? new Date(`${dataReferencia}T12:00:00`) : null;
  const clientes: ClienteAnalise[] = [];
  for (const [codigo, c] of mapa) {
    const valor = (m: Mes) => c.porMes.get(m)?.valorTotal ?? 0;
    const atual = c.porMes.get(mesRef) ?? null;
    const valorAtual = atual?.valorTotal ?? 0;
    const valorAnterior = mesAntImportado ? valor(mesAnt) : null;
    const mesesCompra = meses.filter((m) => comprou(valor(m)));
    const ultimaCompra = mesesCompra.at(-1) ?? null;

    let diasSemComprar: number | null = null;
    if (ultimaCompra && ultimaCompra !== mesRef && fimRef) {
      const fimUltima = new Date(`${ultimaCompra}-${String(ultimoDiaDoMes(ultimaCompra)).padStart(2, '0')}T12:00:00`);
      diasSemComprar = Math.max(0, Math.round((fimRef.getTime() - fimUltima.getTime()) / 86_400_000));
    }

    clientes.push({
      codigo,
      nome: c.nome,
      balcao: ehBalcao(codigo, c.nome),
      porMes: c.porMes,
      atual,
      valorAtual,
      valorAnterior,
      variacao: variacao(valorAtual, valorAnterior),
      markup: atual ? markup(atual.resultado, atual.valorCusto) : null,
      situacao: situacaoCliente(valor, meses, mesRef),
      quedaForte: ehQuedaForte(valorAtual, valorAnterior),
      subiuForte: ehSubidaForte(valorAtual, valorAnterior),
      parouNoMes: mesAntImportado && comprou(valor(mesAnt)) && !comprou(valorAtual),
      totalPeriodo: meses.reduce((s, m) => s + valor(m), 0),
      mediaMensal: mediaMensal(valor, meses, parciais),
      mediaAnteriores: mediaMensal(valor, meses.filter((m) => m < mesRef), parciais),
      primeiraCompra: mesesCompra[0] ?? null,
      ultimaCompra,
      mesesSemComprar: ultimaCompra ? diferencaMeses(ultimaCompra, mesRef) : null,
      diasSemComprar,
    });
  }

  const totais = new Map<Mes, TotaisMes>();
  for (const m of meses) totais.set(m, totaisDoMes(m, vendasAte));

  return { mesRef, mesAnt, mesAntImportado, meses, parciais, clientes, totais };
}
