/**
 * Camada de dados do painel (Supabase). As telas só usam estas funções e
 * nunca chamam o Supabase diretamente. Toda falha vira ErroBanco com a
 * mensagem em português.
 */
import type {
  Cliente,
  Meta,
  Mes,
  Relatorio,
  RelatorioLido,
  RelatorioProdutos,
  RelatorioProdutosLido,
  StatusContato,
  Venda,
  VendaProduto,
  Vendedor,
} from '../tipos';
import { erroBanco } from './erros';
import { supabase } from './supabase';

export function idRelatorio(vendedorCodigo: string, mes: Mes): string {
  return `${vendedorCodigo}-${mes}`;
}

/* ---------- Ajudantes ---------- */

/** Tamanho da página: o Supabase devolve no máximo 1000 linhas por consulta. */
export const PAGINA = 1000;

type Resposta<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

/** Busca todas as linhas, de 1000 em 1000. A consulta precisa ter ordem fixa. */
export async function todasAsPaginas<T>(consulta: (de: number, ate: number) => Resposta<T>): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    let resposta;
    try {
      resposta = await consulta(de, de + PAGINA - 1);
    } catch (e) {
      throw erroBanco(e);
    }
    if (resposta.error) throw erroBanco(resposta.error);
    const pagina = resposta.data ?? [];
    linhas.push(...pagina);
    if (pagina.length < PAGINA) return linhas;
  }
}

async function executar<T>(promessa: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  let resposta;
  try {
    resposta = await promessa;
  } catch (e) {
    throw erroBanco(e);
  }
  if (resposta.error) throw erroBanco(resposta.error);
  return resposta.data;
}

const n = (v: unknown): number => (v == null ? 0 : Number(v));

/* ---------- Linhas como vêm do banco ---------- */

interface LinhaRelatorio {
  id: string;
  vendedor_codigo: string;
  vendedor_nome: string;
  mes: string;
  data_inicial: string;
  data_final: string;
  parcial: boolean;
  empresa: string;
  nome_arquivo: string;
  importado_em: string;
  qtd_clientes: number;
  total_vendido: number | string;
}

interface LinhaVenda {
  relatorio_id: string;
  vendedor_codigo: string;
  mes: string;
  cliente_codigo: string;
  prazo_medio: number | string;
  qtd_vendas: number | string;
  qtde: number | string;
  valor_total: number | string;
  valor_custo: number | string;
  resultado: number | string;
  clientes?: { nome: string } | null;
}

interface LinhaCliente {
  codigo: string;
  nome: string;
  telefone: string | null;
  observacoes: string | null;
  status_contato: StatusContato;
}

interface LinhaRelatorioProdutos {
  id: string;
  vendedor_codigo: string;
  vendedor_nome: string;
  mes: string;
  data_inicial: string;
  data_final: string;
  parcial: boolean;
  nome_arquivo: string;
  importado_em: string;
  qtd_produtos: number;
}

interface LinhaVendaProduto {
  relatorio_id: string;
  vendedor_codigo: string;
  mes: string;
  produto_codigo: string;
  produto_nome: string;
  canal: 'balcao' | 'oficina';
  qtde: number | string;
  valor_total: number | string;
}

export function paraRelatorio(r: LinhaRelatorio): Relatorio {
  return {
    id: r.id,
    vendedorCodigo: r.vendedor_codigo,
    vendedorNome: r.vendedor_nome,
    empresa: r.empresa,
    dataInicial: r.data_inicial,
    dataFinal: r.data_final,
    mes: r.mes,
    parcial: r.parcial,
    nomeArquivo: r.nome_arquivo,
    importadoEm: r.importado_em,
    qtdClientes: n(r.qtd_clientes),
    totalVendido: n(r.total_vendido),
  };
}

function paraVenda(v: LinhaVenda): Venda {
  return {
    id: `${v.relatorio_id}-${v.cliente_codigo}`,
    relatorioId: v.relatorio_id,
    vendedorCodigo: v.vendedor_codigo,
    mes: v.mes,
    clienteCodigo: v.cliente_codigo,
    clienteNome: v.clientes?.nome ?? '',
    prazoMedio: n(v.prazo_medio),
    qtdVendas: n(v.qtd_vendas),
    qtde: n(v.qtde),
    valorTotal: n(v.valor_total),
    valorCusto: n(v.valor_custo),
    resultado: n(v.resultado),
  };
}

function paraCliente(c: LinhaCliente): Cliente {
  return {
    codigo: c.codigo,
    nome: c.nome,
    telefone: c.telefone ?? undefined,
    anotacao: c.observacoes ?? undefined,
    statusContato: c.status_contato,
  };
}

function paraRelatorioProdutos(r: LinhaRelatorioProdutos): RelatorioProdutos {
  return {
    id: r.id,
    vendedorCodigo: r.vendedor_codigo,
    vendedorNome: r.vendedor_nome,
    mes: r.mes,
    dataInicial: r.data_inicial,
    dataFinal: r.data_final,
    parcial: r.parcial,
    nomeArquivo: r.nome_arquivo,
    importadoEm: r.importado_em,
    qtdProdutos: n(r.qtd_produtos),
  };
}

function paraVendaProduto(v: LinhaVendaProduto): VendaProduto {
  return {
    id: `${v.relatorio_id}-${v.canal}-${v.produto_codigo}`,
    relatorioId: v.relatorio_id,
    mes: v.mes,
    vendedorCodigo: v.vendedor_codigo,
    produtoCodigo: v.produto_codigo,
    produtoNome: v.produto_nome,
    canal: v.canal,
    qtde: n(v.qtde),
    valorTotal: n(v.valor_total),
  };
}

/* ---------- Relatórios de vendas por cliente ---------- */

/** Relatório já importado do mesmo vendedor e mês, se houver. */
export async function buscarRelatorio(vendedorCodigo: string, mes: Mes): Promise<Relatorio | undefined> {
  const r = await executar(
    supabase.from('relatorios_importados').select('*').eq('id', idRelatorio(vendedorCodigo, mes)).maybeSingle<LinhaRelatorio>(),
  );
  return r ? paraRelatorio(r) : undefined;
}

/** Conteúdo enviado à função importar_relatorio do banco. */
export function dadosImportacao(lido: RelatorioLido) {
  return { nomeArquivo: lido.nomeArquivo, cabecalho: lido.cabecalho, linhas: lido.linhas };
}

/**
 * Importa o relatório. Se já existir do mesmo vendedor e mês, substitui
 * numa operação só. Telefone, anotação e status dos clientes são mantidos.
 */
export async function importarRelatorio(lido: RelatorioLido): Promise<Relatorio> {
  const r = await executar(supabase.rpc('importar_relatorio', { dados: dadosImportacao(lido) }));
  return paraRelatorio(r as LinhaRelatorio);
}

/** Nome antigo de importarRelatorio (usado pelas telas). */
export const salvarRelatorio = importarRelatorio;

export async function listarRelatorios(): Promise<Relatorio[]> {
  const linhas = await todasAsPaginas<LinhaRelatorio>((de, ate) =>
    supabase.from('relatorios_importados').select('*').order('id').range(de, ate),
  );
  return linhas.map(paraRelatorio);
}

export async function excluirRelatorio(id: string): Promise<void> {
  // As vendas do relatório são apagadas junto (on delete cascade).
  await executar(supabase.from('relatorios_importados').delete().eq('id', id));
}

export async function listarVendas(filtro: { vendedorCodigo?: string } = {}): Promise<Venda[]> {
  const linhas = await todasAsPaginas<LinhaVenda>((de, ate) => {
    let q = supabase.from('vendas_cliente_mes').select('*, clientes(nome)');
    if (filtro.vendedorCodigo) q = q.eq('vendedor_codigo', filtro.vendedorCodigo);
    return q.order('relatorio_id').order('cliente_codigo').range(de, ate);
  });
  return linhas.map(paraVenda);
}

/* ---------- Clientes e contatos ---------- */

export async function listarClientes(): Promise<Cliente[]> {
  const linhas = await todasAsPaginas<LinhaCliente>((de, ate) =>
    supabase.from('clientes').select('codigo, nome, telefone, observacoes, status_contato').order('codigo').range(de, ate),
  );
  return linhas.map(paraCliente);
}

/**
 * Atualiza telefone, anotação ou status de contato do cliente.
 * Mudanças de status/anotação entram sozinhas no histórico (contatos_clientes).
 */
export async function salvarContato(codigo: string, dados: Partial<Omit<Cliente, 'codigo'>>): Promise<void> {
  const linha: Record<string, unknown> = { codigo };
  if ('nome' in dados) linha.nome = dados.nome ?? '';
  if ('telefone' in dados) linha.telefone = dados.telefone || null;
  if ('anotacao' in dados) linha.observacoes = dados.anotacao || null;
  if ('statusContato' in dados) linha.status_contato = dados.statusContato ?? 'nao_contatado';
  await executar(supabase.from('clientes').upsert(linha, { onConflict: 'codigo' }));
}

/** Nome antigo de salvarContato (usado pelo painel). */
export const salvarCliente = salvarContato;

export interface RegistroContato {
  id: number;
  data: string;
  status: StatusContato;
  anotacao: string;
  autor: string;
}

/** Histórico de contatos do cliente, do mais recente para o mais antigo. */
export async function listarHistoricoContatos(clienteCodigo: string): Promise<RegistroContato[]> {
  const [contatos, perfis] = await Promise.all([
    executar(
      supabase
        .from('contatos_clientes')
        .select('id, status, anotacao, autor, criado_em')
        .eq('cliente_codigo', clienteCodigo)
        .order('criado_em', { ascending: false })
        .limit(50),
    ),
    executar(supabase.from('perfis').select('id, nome')),
  ]);
  const nomes = new Map((perfis ?? []).map((p) => [p.id as string, p.nome as string]));
  return (contatos ?? []).map((c) => ({
    id: c.id as number,
    data: c.criado_em as string,
    status: c.status as StatusContato,
    anotacao: (c.anotacao as string | null) ?? '',
    autor: (c.autor && nomes.get(c.autor as string)) || '—',
  }));
}

/* ---------- Vendedores e metas ---------- */

export async function listarVendedores(): Promise<Vendedor[]> {
  const linhas = await todasAsPaginas<Vendedor>((de, ate) =>
    supabase.from('vendedores').select('codigo, nome').order('codigo').range(de, ate),
  );
  return linhas.map((v) => ({ codigo: v.codigo, nome: v.nome }));
}

export async function salvarVendedor(vendedor: Vendedor): Promise<void> {
  await executar(supabase.from('vendedores').upsert({ codigo: vendedor.codigo, nome: vendedor.nome }, { onConflict: 'codigo' }));
}

export async function listarMetas(): Promise<Meta[]> {
  const linhas = await todasAsPaginas<{ vendedor_codigo: string; mes: string; valor: number | string }>((de, ate) =>
    supabase.from('metas').select('vendedor_codigo, mes, valor').order('vendedor_codigo').order('mes').range(de, ate),
  );
  return linhas.map((m) => ({
    id: idRelatorio(m.vendedor_codigo, m.mes),
    vendedorCodigo: m.vendedor_codigo,
    mes: m.mes,
    valor: n(m.valor),
  }));
}

/** Grava a meta do vendedor no mês; null apaga a meta. */
export async function salvarMeta(vendedorCodigo: string, mes: Mes, valor: number | null): Promise<void> {
  if (valor == null) {
    await executar(supabase.from('metas').delete().eq('vendedor_codigo', vendedorCodigo).eq('mes', mes));
  } else {
    await executar(
      supabase
        .from('metas')
        .upsert({ vendedor_codigo: vendedorCodigo, mes, valor: Math.round(valor * 100) / 100 }, { onConflict: 'vendedor_codigo,mes' }),
    );
  }
}

/* ---------- Produtos vendidos ---------- */

/** Relatórios de produtos já importados para os vendedores e mês do arquivo. */
export async function buscarRelatoriosProdutos(lido: RelatorioProdutosLido): Promise<RelatorioProdutos[]> {
  const ids = lido.vendedores.map((v) => idRelatorio(v.codigo, lido.mes));
  if (!ids.length) return [];
  const linhas = await executar(supabase.from('relatorios_produtos').select('*').in('id', ids).returns<LinhaRelatorioProdutos[]>());
  return (linhas ?? []).map(paraRelatorioProdutos);
}

/** Conteúdo enviado à função importar_relatorio_produtos do banco. */
export function dadosImportacaoProdutos(lido: RelatorioProdutosLido) {
  return {
    nomeArquivo: lido.nomeArquivo,
    mes: lido.mes,
    dataInicial: lido.dataInicial,
    dataFinal: lido.dataFinal,
    parcial: lido.parcial,
    vendedores: lido.vendedores,
    linhas: lido.linhas.map((l) => ({
      vendedorCodigo: l.vendedorCodigo,
      produtoCodigo: l.produtoCodigo,
      produtoNome: l.produtoNome,
      canal: l.canal,
      qtde: l.qtde,
      valorTotal: l.valorTotal,
    })),
  };
}

/** Importa o relatório de produtos: um registro por vendedor do arquivo, substituindo o do mesmo mês. */
export async function importarRelatorioProdutos(lido: RelatorioProdutosLido): Promise<RelatorioProdutos[]> {
  const linhas = await executar(supabase.rpc('importar_relatorio_produtos', { dados: dadosImportacaoProdutos(lido) }));
  return ((linhas ?? []) as LinhaRelatorioProdutos[]).map(paraRelatorioProdutos);
}

/** Nome antigo de importarRelatorioProdutos (usado pelas telas). */
export const salvarRelatorioProdutos = importarRelatorioProdutos;

export async function listarRelatoriosProdutos(): Promise<RelatorioProdutos[]> {
  const linhas = await todasAsPaginas<LinhaRelatorioProdutos>((de, ate) =>
    supabase.from('relatorios_produtos').select('*').order('id').range(de, ate),
  );
  return linhas.map(paraRelatorioProdutos);
}

export async function excluirRelatorioProdutos(id: string): Promise<void> {
  await executar(supabase.from('relatorios_produtos').delete().eq('id', id));
}

/** Todas as vendas de produtos de todos os meses (para as análises de produtos). */
export async function listarTodasVendasProdutos(): Promise<VendaProduto[]> {
  const linhas = await todasAsPaginas<LinhaVendaProduto>((de, ate) =>
    supabase
      .from('vendas_produto_mes')
      .select('*')
      .order('relatorio_id')
      .order('canal')
      .order('produto_codigo')
      .range(de, ate),
  );
  return linhas.map(paraVendaProduto);
}

export async function listarVendasProdutos(mes: Mes): Promise<VendaProduto[]> {
  const linhas = await todasAsPaginas<LinhaVendaProduto>((de, ate) =>
    supabase
      .from('vendas_produto_mes')
      .select('*')
      .eq('mes', mes)
      .order('relatorio_id')
      .order('canal')
      .order('produto_codigo')
      .range(de, ate),
  );
  return linhas.map(paraVendaProduto);
}
