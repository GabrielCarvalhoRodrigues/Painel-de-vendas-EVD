/**
 * Dados que ficaram no navegador (IndexedDB) da versão sem servidor.
 * Lê o que existe, envia para o Supabase sem duplicar e, só depois, permite limpar.
 */
import type { Cliente, Meta, Relatorio, RelatorioLido, RelatorioProdutos, RelatorioProdutosLido, Venda, VendaProduto, Vendedor } from '../tipos';
import { banco } from './banco';
import { erroBanco } from './erros';
import {
  importarRelatorio,
  importarRelatorioProdutos,
  listarClientes,
  listarMetas,
  listarRelatorios,
  listarRelatoriosProdutos,
  listarVendedores,
  salvarContato,
  salvarMeta,
  salvarVendedor,
} from './repositorio';

export interface DadosLocais {
  relatorios: Relatorio[];
  vendas: Venda[];
  clientes: Cliente[];
  vendedores: Vendedor[];
  metas: Meta[];
  relatoriosProdutos: RelatorioProdutos[];
  vendasProdutos: VendaProduto[];
}

export interface ResumoLocal {
  relatorios: number;
  relatoriosProdutos: number;
  clientes: number;
  /** Clientes com telefone, anotação ou status preenchido. */
  contatos: number;
  metas: number;
  vendedores: number;
}

const temContato = (c: Cliente) => !!(c.telefone || c.anotacao || (c.statusContato && c.statusContato !== 'nao_contatado'));

export async function lerDadosLocais(): Promise<DadosLocais> {
  try {
    const [relatorios, vendas, clientes, vendedores, metas, relatoriosProdutos, vendasProdutos] = await Promise.all([
      banco.relatorios.toArray(),
      banco.vendas.toArray(),
      banco.clientes.toArray(),
      banco.vendedores.toArray(),
      banco.metas.toArray(),
      banco.relatoriosProdutos.toArray(),
      banco.vendasProdutos.toArray(),
    ]);
    return { relatorios, vendas, clientes, vendedores, metas, relatoriosProdutos, vendasProdutos };
  } catch {
    // Navegador sem IndexedDB (ou bloqueado): não há dados locais.
    return { relatorios: [], vendas: [], clientes: [], vendedores: [], metas: [], relatoriosProdutos: [], vendasProdutos: [] };
  }
}

export function resumir(d: DadosLocais): ResumoLocal {
  return {
    relatorios: d.relatorios.length,
    relatoriosProdutos: d.relatoriosProdutos.length,
    clientes: d.clientes.length,
    contatos: d.clientes.filter(temContato).length,
    metas: d.metas.length,
    vendedores: d.vendedores.length,
  };
}

export function temDadosLocais(r: ResumoLocal): boolean {
  return r.relatorios + r.relatoriosProdutos + r.contatos + r.metas > 0;
}

/** Remonta os relatórios lidos a partir do que está salvo no navegador. */
export function relatoriosParaEnviar(d: DadosLocais): RelatorioLido[] {
  return d.relatorios.map((r) => ({
    nomeArquivo: r.nomeArquivo,
    cabecalho: {
      vendedorCodigo: r.vendedorCodigo,
      vendedorNome: r.vendedorNome,
      empresa: r.empresa,
      dataInicial: r.dataInicial,
      dataFinal: r.dataFinal,
      mes: r.mes,
      parcial: r.parcial,
    },
    linhas: d.vendas
      .filter((v) => v.relatorioId === r.id)
      .map((v) => ({
        clienteCodigo: v.clienteCodigo,
        clienteNome: v.clienteNome,
        prazoMedio: v.prazoMedio,
        qtdVendas: v.qtdVendas,
        qtde: v.qtde,
        valorTotal: v.valorTotal,
        valorCusto: v.valorCusto,
        resultado: v.resultado,
      })),
  }));
}

/** Um relatório de produtos por vendedor e mês, como a importação espera. */
export function produtosParaEnviar(d: DadosLocais): RelatorioProdutosLido[] {
  return d.relatoriosProdutos.map((r) => ({
    nomeArquivo: r.nomeArquivo,
    mes: r.mes,
    dataInicial: r.dataInicial,
    dataFinal: r.dataFinal,
    parcial: r.parcial,
    vendedores: [{ codigo: r.vendedorCodigo, nome: r.vendedorNome }],
    linhas: d.vendasProdutos
      .filter((v) => v.relatorioId === r.id)
      .map((v) => ({
        vendedorCodigo: v.vendedorCodigo,
        vendedorNome: r.vendedorNome,
        produtoCodigo: v.produtoCodigo,
        produtoNome: v.produtoNome,
        canal: v.canal,
        qtde: v.qtde,
        valorTotal: v.valorTotal,
      })),
  }));
}

export interface ResultadoEnvio {
  relatoriosEnviados: number;
  relatoriosJaExistiam: number;
  produtosEnviados: number;
  produtosJaExistiam: number;
  contatosEnviados: number;
  metasEnviadas: number;
  vendedoresEnviados: number;
}

/**
 * Envia tudo para o banco sem duplicar:
 * - relatórios (de vendas e de produtos) que já existem no banco são pulados;
 * - vendedores que já existem mantêm o nome do banco;
 * - telefone/anotação/status só preenchem o que está vazio no banco;
 * - metas que já existem no banco não são trocadas.
 */
export async function enviarDadosLocais(d: DadosLocais, progresso: (texto: string) => void = () => {}): Promise<ResultadoEnvio> {
  const res: ResultadoEnvio = {
    relatoriosEnviados: 0,
    relatoriosJaExistiam: 0,
    produtosEnviados: 0,
    produtosJaExistiam: 0,
    contatosEnviados: 0,
    metasEnviadas: 0,
    vendedoresEnviados: 0,
  };
  try {
    progresso('Conferindo o que já está no banco…');
    const [vendRemotos, relRemotos, prodRemotos] = await Promise.all([listarVendedores(), listarRelatorios(), listarRelatoriosProdutos()]);

    // 1. Vendedores novos entram com o nome usado no navegador (pode ter sido editado).
    const codigosRemotos = new Set(vendRemotos.map((v) => v.codigo));
    for (const v of d.vendedores) {
      if (codigosRemotos.has(v.codigo)) continue;
      progresso(`Enviando vendedor ${v.nome}…`);
      await salvarVendedor(v);
      res.vendedoresEnviados++;
    }

    // 2. Relatórios de vendas
    const idsRel = new Set(relRemotos.map((r) => r.id));
    for (const lido of relatoriosParaEnviar(d)) {
      const id = `${lido.cabecalho.vendedorCodigo}-${lido.cabecalho.mes}`;
      if (idsRel.has(id)) {
        res.relatoriosJaExistiam++;
        continue;
      }
      if (!lido.linhas.length) continue;
      progresso(`Enviando relatório ${lido.cabecalho.vendedorNome} ${lido.cabecalho.mes}…`);
      await importarRelatorio(lido);
      res.relatoriosEnviados++;
    }

    // 3. Relatórios de produtos
    const idsProd = new Set(prodRemotos.map((r) => r.id));
    for (const lido of produtosParaEnviar(d)) {
      const id = `${lido.vendedores[0].codigo}-${lido.mes}`;
      if (idsProd.has(id)) {
        res.produtosJaExistiam++;
        continue;
      }
      progresso(`Enviando produtos ${lido.vendedores[0].nome} ${lido.mes}…`);
      await importarRelatorioProdutos(lido);
      res.produtosEnviados++;
    }

    // 4. Telefone, anotação e status: só onde o banco está vazio.
    const clientesRemotos = new Map((await listarClientes()).map((c) => [c.codigo, c]));
    for (const c of d.clientes.filter(temContato)) {
      const r = clientesRemotos.get(c.codigo);
      const dados: Partial<Omit<Cliente, 'codigo'>> = {};
      if (c.telefone && !r?.telefone) dados.telefone = c.telefone;
      if (c.anotacao && !r?.anotacao) dados.anotacao = c.anotacao;
      if (c.statusContato && c.statusContato !== 'nao_contatado' && (!r || r.statusContato === 'nao_contatado')) {
        dados.statusContato = c.statusContato;
      }
      if (!r) dados.nome = c.nome;
      if (!Object.keys(dados).length) continue;
      progresso(`Enviando contato de ${c.nome}…`);
      await salvarContato(c.codigo, dados);
      res.contatosEnviados++;
    }

    // 5. Metas que ainda não existem no banco.
    const metasRemotas = new Set((await listarMetas()).map((m) => m.id));
    const vendedoresAgora = new Set((await listarVendedores()).map((v) => v.codigo));
    for (const m of d.metas) {
      if (metasRemotas.has(`${m.vendedorCodigo}-${m.mes}`) || !vendedoresAgora.has(m.vendedorCodigo)) continue;
      await salvarMeta(m.vendedorCodigo, m.mes, m.valor);
      res.metasEnviadas++;
    }

    progresso('');
    return res;
  } catch (e) {
    progresso('');
    throw erroBanco(e);
  }
}

/** Apaga os dados do navegador. Só chamar depois de enviar com sucesso. */
export async function limparDadosLocais(): Promise<void> {
  await banco.delete();
}
