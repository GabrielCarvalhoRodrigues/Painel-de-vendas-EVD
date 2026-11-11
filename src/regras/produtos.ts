/**
 * Análise dos produtos vendidos, no mesmo espírito da análise de clientes:
 * situação no mês, média dos meses fechados, queda/subida forte, quem parou de vender.
 *
 * A "medida" escolhe o que comparar: quantidade (sempre existe) ou valor
 * (só quando o relatório do ERP traz a coluna de valor).
 */
import type { Canal, Mes, VendaProduto } from '../tipos';
import { mediaMensal, situacaoCliente, type Situacao } from './analise';
import { diferencaMeses, mesAnterior } from '../utils/meses';

export type Medida = 'qtde' | 'valor';

export interface ProdutoMes {
  qtde: number;
  qtdeBalcao: number;
  qtdeOficina: number;
  valor: number;
}

export interface ProdutoAnalise {
  codigo: string;
  nome: string;
  porMes: Map<Mes, ProdutoMes>;
  /** Medida (quantidade ou valor) no mês de referência. */
  noMes: number;
  /** Medida no mês anterior (null se o mês anterior não foi importado). */
  anterior: number | null;
  /** Média da medida nos meses fechados antes do mês de referência. */
  mediaAnteriores: number | null;
  situacao: Situacao;
  quedaForte: boolean;
  subiuForte: boolean;
  /** Vendeu no mês anterior e não vendeu no mês de referência. */
  parouNoMes: boolean;
  /** Último mês com venda (até o mês de referência). */
  ultimaVenda: Mes | null;
  mesesSemVender: number | null;
  totalQtde: number;
  totalValor: number;
}

export interface TotaisProdutosMes {
  mes: Mes;
  qtde: number;
  qtdeBalcao: number;
  qtdeOficina: number;
  valor: number;
  /** Quantos produtos diferentes venderam no mês. */
  produtosVendidos: number;
}

export interface AnaliseProdutos {
  meses: Mes[];
  parciais: Set<Mes>;
  mesRef: Mes;
  mesAnt: Mes;
  mesAntImportado: boolean;
  medida: Medida;
  produtos: ProdutoAnalise[];
  totais: Map<Mes, TotaisProdutosMes>;
}

const vazio = (): ProdutoMes => ({ qtde: 0, qtdeBalcao: 0, qtdeOficina: 0, valor: 0 });

export function medidaDe(p: ProdutoMes | undefined, medida: Medida): number {
  if (!p) return 0;
  return medida === 'valor' ? p.valor : p.qtde;
}

/** Vendas já filtradas por vendedor; o canal é filtrado aqui. */
export function analisarProdutos(
  vendas: VendaProduto[],
  meses: Mes[],
  parciais: Set<Mes>,
  mesRef: Mes,
  medida: Medida,
  canal: Canal | '' = '',
): AnaliseProdutos {
  const porProduto = new Map<string, { nome: string; mesNome: Mes; porMes: Map<Mes, ProdutoMes> }>();
  for (const v of vendas) {
    if (canal && v.canal !== canal) continue;
    let p = porProduto.get(v.produtoCodigo);
    if (!p) {
      p = { nome: v.produtoNome, mesNome: v.mes, porMes: new Map() };
      porProduto.set(v.produtoCodigo, p);
    }
    // Nome mais recente vence (o ERP pode ter corrigido a descrição).
    if (v.produtoNome && v.mes >= p.mesNome) {
      p.nome = v.produtoNome;
      p.mesNome = v.mes;
    }
    const m = p.porMes.get(v.mes) ?? vazio();
    m.qtde += v.qtde;
    if (v.canal === 'oficina') m.qtdeOficina += v.qtde;
    else m.qtdeBalcao += v.qtde;
    m.valor += v.valorTotal;
    p.porMes.set(v.mes, m);
  }

  const mesAnt = mesAnterior(mesRef);
  const mesAntImportado = meses.includes(mesAnt);
  const mesesAteRef = meses.filter((m) => m <= mesRef);

  const produtos: ProdutoAnalise[] = [];
  for (const [codigo, p] of porProduto) {
    const valor = (m: Mes) => medidaDe(p.porMes.get(m), medida);
    const noMes = valor(mesRef);
    const anterior = mesAntImportado ? valor(mesAnt) : null;
    const comVenda = mesesAteRef.filter((m) => valor(m) > 0);
    const ultimaVenda = comVenda.at(-1) ?? null;
    const totalQtde = mesesAteRef.reduce((s, m) => s + (p.porMes.get(m)?.qtde ?? 0), 0);
    const totalValor = mesesAteRef.reduce((s, m) => s + (p.porMes.get(m)?.valor ?? 0), 0);
    if (!comVenda.length && Math.abs(totalQtde) < 0.0001) continue;
    produtos.push({
      codigo,
      nome: p.nome || codigo,
      porMes: p.porMes,
      noMes,
      anterior,
      mediaAnteriores: mediaMensal(valor, meses.filter((m) => m < mesRef), parciais),
      situacao: situacaoCliente(valor, meses, mesRef),
      quedaForte: noMes > 0 && anterior != null && anterior > 0 && noMes < anterior * 0.5,
      subiuForte: noMes > 0 && anterior != null && anterior > 0 && noMes > anterior * 1.5,
      parouNoMes: noMes <= 0 && anterior != null && anterior > 0,
      ultimaVenda,
      mesesSemVender: noMes > 0 ? 0 : ultimaVenda ? diferencaMeses(ultimaVenda, mesRef) : null,
      totalQtde,
      totalValor,
    });
  }

  const totais = new Map<Mes, TotaisProdutosMes>();
  for (const mes of meses) {
    const t: TotaisProdutosMes = { mes, qtde: 0, qtdeBalcao: 0, qtdeOficina: 0, valor: 0, produtosVendidos: 0 };
    for (const p of porProduto.values()) {
      const m = p.porMes.get(mes);
      if (!m) continue;
      t.qtde += m.qtde;
      t.qtdeBalcao += m.qtdeBalcao;
      t.qtdeOficina += m.qtdeOficina;
      t.valor += m.valor;
      if (m.qtde > 0) t.produtosVendidos++;
    }
    totais.set(mes, t);
  }

  return { meses, parciais, mesRef, mesAnt, mesAntImportado, medida, produtos, totais };
}
