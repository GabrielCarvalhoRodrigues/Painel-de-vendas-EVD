import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { mensagemDeErro } from '../dados/erros';
import * as repo from '../dados/repositorio';
import { analisar, type Analise } from '../regras/analise';
import type { Cliente, Meta, Mes, Relatorio, Venda, Vendedor } from '../tipos';

export const TODOS = 'todos';

interface Painel {
  carregando: boolean;
  /** Mensagem quando não foi possível carregar os dados do banco. */
  erro: string;
  /** Busca tudo de novo no banco (não lança erro: preenche `erro`). */
  recarregar: () => Promise<void>;
  relatorios: Relatorio[];
  vendas: Venda[];
  clientes: Map<string, Cliente>;
  salvarCliente: (codigo: string, dados: Partial<Omit<Cliente, 'codigo'>>) => Promise<void>;
  vendedores: Vendedor[];
  renomearVendedor: (codigo: string, nome: string) => Promise<void>;
  metas: Meta[];
  salvarMeta: (vendedorCodigo: string, mes: Mes, valor: number | null) => Promise<void>;

  vendedorSel: string;
  setVendedorSel: (v: string) => void;
  mesSel: Mes | null;
  setMesSel: (m: Mes) => void;

  /** Meses com relatório no filtro de vendedor atual. */
  meses: Mes[];
  parciais: Set<Mes>;
  vendasFiltro: Venda[];
  /** Análise do mês selecionado (null se não houver dados). */
  analise: Analise | null;
  /** Vendedores que têm relatórios, mas não do mês selecionado (só no filtro "Todos"). */
  vendedoresSemMes: Vendedor[];
}

const Ctx = createContext<Painel | null>(null);

function lerPreferencia(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

export function PainelProvider({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [relatorios, setRelatorios] = useState<Relatorio[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [clientesLista, setClientes] = useState<Cliente[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [vendedorSel, setVendedorSelState] = useState(() => lerPreferencia('evaldo.vendedor') ?? TODOS);
  const [mesEscolhido, setMesEscolhido] = useState<Mes | null>(null);

  const [erro, setErro] = useState('');
  const comErro = useRef(false);

  const recarregar = useCallback(async () => {
    // Depois de um erro, mostra "carregando" de novo enquanto tenta.
    if (comErro.current) setCarregando(true);
    try {
      const [r, v, c, vd, m] = await Promise.all([
        repo.listarRelatorios(),
        repo.listarVendas(),
        repo.listarClientes(),
        repo.listarVendedores(),
        repo.listarMetas(),
      ]);
      setRelatorios(r);
      setVendas(v);
      setClientes(c);
      setVendedores(vd.sort((a, b) => a.nome.localeCompare(b.nome)));
      setMetas(m);
      comErro.current = false;
      setErro('');
    } catch (e) {
      comErro.current = true;
      setErro(mensagemDeErro(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const setVendedorSel = useCallback((v: string) => {
    setVendedorSelState(v);
    try {
      localStorage.setItem('evaldo.vendedor', v);
    } catch {
      /* navegador sem localStorage */
    }
  }, []);

  // Se o vendedor salvo não existe mais, volta para "Todos".
  const vendedorValido = vendedorSel === TODOS || vendedores.some((v) => v.codigo === vendedorSel) ? vendedorSel : TODOS;

  const derivado = useMemo(() => {
    const doFiltro = vendedorValido === TODOS ? relatorios : relatorios.filter((r) => r.vendedorCodigo === vendedorValido);
    const meses = [...new Set(doFiltro.map((r) => r.mes))].sort();
    const parciais = new Set(doFiltro.filter((r) => r.parcial).map((r) => r.mes));
    const mesSel = mesEscolhido && meses.includes(mesEscolhido) ? mesEscolhido : (meses.at(-1) ?? null);
    const vendasFiltro = vendedorValido === TODOS ? vendas : vendas.filter((v) => v.vendedorCodigo === vendedorValido);

    let analise: Analise | null = null;
    let vendedoresSemMes: Vendedor[] = [];
    if (mesSel) {
      const dataReferencia = doFiltro
        .filter((r) => r.mes === mesSel)
        .map((r) => r.dataFinal)
        .sort()
        .at(-1);
      analise = analisar(vendasFiltro, meses, parciais, mesSel, dataReferencia);
      if (vendedorValido === TODOS) {
        const comMes = new Set(relatorios.filter((r) => r.mes === mesSel).map((r) => r.vendedorCodigo));
        vendedoresSemMes = vendedores.filter((v) => relatorios.some((r) => r.vendedorCodigo === v.codigo) && !comMes.has(v.codigo));
      }
    }
    return { meses, parciais, mesSel, vendasFiltro, analise, vendedoresSemMes };
  }, [relatorios, vendas, vendedores, vendedorValido, mesEscolhido]);

  const clientes = useMemo(() => new Map(clientesLista.map((c) => [c.codigo, c])), [clientesLista]);

  const salvarCliente = useCallback(async (codigo: string, dados: Partial<Omit<Cliente, 'codigo'>>) => {
    await repo.salvarCliente(codigo, dados);
    setClientes((lista) => {
      const existe = lista.some((c) => c.codigo === codigo);
      return existe ? lista.map((c) => (c.codigo === codigo ? { ...c, ...dados } : c)) : [...lista, { nome: '', ...dados, codigo }];
    });
  }, []);

  const salvarMeta = useCallback(async (vendedorCodigo: string, mes: Mes, valor: number | null) => {
    await repo.salvarMeta(vendedorCodigo, mes, valor);
    setMetas(await repo.listarMetas());
  }, []);

  const renomearVendedor = useCallback(async (codigo: string, nome: string) => {
    await repo.salvarVendedor({ codigo, nome });
    setVendedores((vs) => vs.map((v) => (v.codigo === codigo ? { ...v, nome } : v)));
  }, []);

  const valor: Painel = {
    carregando,
    erro,
    recarregar,
    relatorios,
    vendas,
    clientes,
    salvarCliente,
    vendedores,
    renomearVendedor,
    metas,
    salvarMeta,
    vendedorSel: vendedorValido,
    setVendedorSel,
    setMesSel: setMesEscolhido,
    ...derivado,
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function usePainel(): Painel {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePainel fora do PainelProvider');
  return ctx;
}

/** Nome do vendedor que atendeu o cliente mais recentemente (no filtro atual). */
export function useVendedorDoCliente(): (codigoCliente: string) => string | undefined {
  const { vendasFiltro, vendedores } = usePainel();
  return useMemo(() => {
    const ultimo = new Map<string, { mes: string; vendedor: string }>();
    for (const v of vendasFiltro) {
      const u = ultimo.get(v.clienteCodigo);
      if (v.valorTotal > 0 && (!u || v.mes > u.mes)) ultimo.set(v.clienteCodigo, { mes: v.mes, vendedor: v.vendedorCodigo });
    }
    const nomes = new Map(vendedores.map((v) => [v.codigo, v.nome]));
    return (codigo: string) => {
      const u = ultimo.get(codigo);
      return u ? nomes.get(u.vendedor) : undefined;
    };
  }, [vendasFiltro, vendedores]);
}
