/**
 * Dados e filtros das telas de produtos (visão geral, pararam de vender,
 * vendeu mais ou menos, produtos do mês e ficha do produto).
 *
 * Os dados só são buscados quando alguém abre uma tela de produtos, e são
 * buscados de novo depois de importar ou excluir um relatório de produtos.
 * O filtro de vendedor é o mesmo das telas de clientes (usePainel).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { mensagemDeErro } from '../dados/erros';
import * as repo from '../dados/repositorio';
import { analisarProdutos, type AnaliseProdutos, type Medida } from '../regras/produtos';
import type { Canal, Mes, RelatorioProdutos, VeiculoProduto, VendaProduto } from '../tipos';
import { TODOS, usePainel } from './PainelContext';

interface Produtos {
  carregando: boolean;
  erro: string;
  recarregar: () => void;
  /** Marca os dados como desatualizados (busca de novo na próxima tela de produtos). */
  invalidar: () => void;
  /** Pede os dados (as telas chamam via useProdutos). */
  pedir: () => void;

  relatorios: RelatorioProdutos[];
  /** Vendas no filtro de vendedor (todos os canais). */
  vendasFiltro: VendaProduto[];
  /** Meses com relatório de produtos no filtro de vendedor. */
  meses: Mes[];
  parciais: Set<Mes>;
  mesSel: Mes | null;
  setMesSel: (m: Mes) => void;
  canal: Canal | '';
  setCanal: (c: Canal | '') => void;
  /** O relatório traz valor em R$? (senão só dá para comparar quantidade) */
  temValor: boolean;
  medida: Medida;
  setMedida: (m: Medida) => void;
  /** Data final mais antiga entre os relatórios parciais do mês (para o aviso). */
  parcialAte: string | null;
  analise: AnaliseProdutos | null;
  /** Produtos aplicados nos veículos (todos os vendedores e meses). */
  veiculos: VeiculoProduto[];
  /** Erro ao ler os veículos (ex.: migration de veículos ainda não aplicada). */
  erroVeiculos: string;
}

const Ctx = createContext<Produtos | null>(null);

export function ProdutosProvider({ children }: { children: ReactNode }) {
  const { vendedorSel } = usePainel();
  const [pedido, setPedido] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [relatorios, setRelatorios] = useState<RelatorioProdutos[]>([]);
  const [vendas, setVendas] = useState<VendaProduto[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoProduto[]>([]);
  const [erroVeiculos, setErroVeiculos] = useState('');
  const [mesEscolhido, setMesSel] = useState<Mes | null>(null);
  const [canal, setCanal] = useState<Canal | ''>('');
  const [medidaEscolhida, setMedida] = useState<Medida>('qtde');
  const emAndamento = useRef(false);

  const carregar = useCallback(async () => {
    if (emAndamento.current) return;
    emAndamento.current = true;
    setCarregando(true);
    setErro('');
    try {
      // Veículos à parte: se falharem, as outras telas de produtos continuam funcionando.
      const [r, v, vei] = await Promise.all([
        repo.listarRelatoriosProdutos(),
        repo.listarTodasVendasProdutos(),
        repo.listarVeiculosProdutos().then(
          (x) => ({ ok: true as const, x }),
          (e) => ({ ok: false as const, e }),
        ),
      ]);
      setRelatorios(r);
      setVendas(v);
      setVeiculos(vei.ok ? vei.x : []);
      setErroVeiculos(vei.ok ? '' : mensagemDeErro(vei.e));
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setCarregado(true);
      setCarregando(false);
      emAndamento.current = false;
    }
  }, []);

  useEffect(() => {
    if (pedido && !carregado) carregar();
  }, [pedido, carregado, carregar]);

  const derivado = useMemo(() => {
    const doFiltro = vendedorSel === TODOS ? relatorios : relatorios.filter((r) => r.vendedorCodigo === vendedorSel);
    const meses = [...new Set(doFiltro.map((r) => r.mes))].sort();
    const parciais = new Set(doFiltro.filter((r) => r.parcial).map((r) => r.mes));
    const mesSel = mesEscolhido && meses.includes(mesEscolhido) ? mesEscolhido : (meses.at(-1) ?? null);
    const vendasFiltro = vendedorSel === TODOS ? vendas : vendas.filter((v) => v.vendedorCodigo === vendedorSel);
    const temValor = vendasFiltro.some((v) => v.valorTotal !== 0);
    const medida: Medida = temValor ? medidaEscolhida : 'qtde';
    const parcialAte = mesSel ? (doFiltro.filter((r) => r.mes === mesSel && r.parcial).map((r) => r.dataFinal).sort()[0] ?? null) : null;
    const analise = mesSel ? analisarProdutos(vendasFiltro, meses, parciais, mesSel, medida, canal) : null;
    return { meses, parciais, mesSel, vendasFiltro, temValor, medida, parcialAte, analise };
  }, [relatorios, vendas, vendedorSel, mesEscolhido, medidaEscolhida, canal]);

  const invalidar = useCallback(() => setCarregado(false), []);
  const pedir = useCallback(() => setPedido(true), []);

  const valor: Produtos = {
    carregando: !carregado || carregando,
    erro,
    recarregar: carregar,
    invalidar,
    pedir,
    relatorios,
    veiculos,
    erroVeiculos,
    setMesSel,
    canal,
    setCanal,
    setMedida,
    ...derivado,
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

/** Usado pelas telas de produtos: busca os dados na primeira vez. */
export function useProdutos(): Produtos {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProdutos fora do ProdutosProvider');
  const { pedir } = ctx;
  useEffect(() => pedir(), [pedir]);
  return ctx;
}

/** Para a tela de importação: avisa que os dados mudaram (sem buscar agora). */
export function useInvalidarProdutos(): () => void {
  const ctx = useContext(Ctx);
  return ctx?.invalidar ?? (() => {});
}
