/**
 * Análise dos veículos atendidos (pedidos com placa): produtos mais aplicados,
 * modelos mais atendidos e resumo por placa. Recebe as linhas já filtradas
 * (vendedor, mês, marca, modelo).
 */
import type { VeiculoProduto } from '../tipos';

export interface ProdutoAplicado {
  codigo: string;
  nome: string;
  /** Em quantos veículos (placas) diferentes o produto foi aplicado. */
  veiculos: number;
  qtde: number;
  valor: number;
}

export interface ModeloAtendido {
  marca: string;
  modelo: string;
  veiculos: number;
  qtde: number;
  valor: number;
}

export interface VeiculoResumo {
  placa: string;
  placaTexto: string;
  veiculo: string;
  marca: string;
  modelo: string;
  ano: number | null;
  km: number | null;
  clienteNome: string;
  clienteTelefone: string;
  ultimaData: string | null;
  pedidos: number;
  qtde: number;
  valor: number;
  produtos: { codigo: string; nome: string; qtde: number }[];
}

/** Rótulo do modelo para quando o relatório só trouxe a placa. */
export const SEM_MODELO = '(sem descrição)';

export const nomeModelo = (modelo: string) => modelo || SEM_MODELO;

/** Produtos ordenados pelo número de veículos em que foram aplicados (depois quantidade). */
export function produtosMaisAplicados(itens: VeiculoProduto[]): ProdutoAplicado[] {
  const mapa = new Map<string, ProdutoAplicado & { placas: Set<string>; mesNome: string }>();
  for (const i of itens) {
    let p = mapa.get(i.produtoCodigo);
    if (!p) {
      p = { codigo: i.produtoCodigo, nome: i.produtoNome, veiculos: 0, qtde: 0, valor: 0, placas: new Set(), mesNome: i.mes };
      mapa.set(i.produtoCodigo, p);
    }
    if (i.produtoNome && i.mes >= p.mesNome) {
      p.nome = i.produtoNome;
      p.mesNome = i.mes;
    }
    p.placas.add(i.placa);
    p.qtde += i.qtde;
    p.valor += i.valorTotal;
  }
  return [...mapa.values()]
    .map(({ placas, mesNome: _, ...p }) => ({ ...p, veiculos: placas.size }))
    .sort((a, b) => b.veiculos - a.veiculos || b.qtde - a.qtde || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Modelos ordenados pelo número de veículos atendidos. */
export function modelosAtendidos(itens: VeiculoProduto[]): ModeloAtendido[] {
  const mapa = new Map<string, ModeloAtendido & { placas: Set<string> }>();
  for (const i of itens) {
    const chave = `${i.marca}|${i.modelo}`;
    let m = mapa.get(chave);
    if (!m) {
      m = { marca: i.marca, modelo: i.modelo, veiculos: 0, qtde: 0, valor: 0, placas: new Set() };
      mapa.set(chave, m);
    }
    m.placas.add(i.placa);
    m.qtde += i.qtde;
    m.valor += i.valorTotal;
  }
  return [...mapa.values()]
    .map(({ placas, ...m }) => ({ ...m, veiculos: placas.size }))
    .sort((a, b) => b.veiculos - a.veiculos || b.qtde - a.qtde || a.modelo.localeCompare(b.modelo, 'pt-BR'));
}

/** Um resumo por placa (o mais recente vence para descrição, KM e cliente). */
export function resumoPorVeiculo(itens: VeiculoProduto[]): VeiculoResumo[] {
  const mapa = new Map<string, VeiculoResumo & { pedidosPor: Map<string, number>; mesDados: string }>();
  for (const i of itens) {
    let v = mapa.get(i.placa);
    if (!v) {
      v = {
        placa: i.placa,
        placaTexto: i.placaTexto,
        veiculo: i.veiculo,
        marca: i.marca,
        modelo: i.modelo,
        ano: i.ano,
        km: i.km,
        clienteNome: i.clienteNome,
        clienteTelefone: i.clienteTelefone,
        ultimaData: i.ultimaData,
        pedidos: 0,
        qtde: 0,
        valor: 0,
        produtos: [],
        pedidosPor: new Map(),
        mesDados: i.mes,
      };
      mapa.set(i.placa, v);
    }
    if (i.mes > v.mesDados) {
      v.mesDados = i.mes;
      if (i.veiculo) Object.assign(v, { veiculo: i.veiculo, marca: i.marca, modelo: i.modelo, ano: i.ano ?? v.ano });
      if (i.clienteNome) v.clienteNome = i.clienteNome;
      if (i.clienteTelefone) v.clienteTelefone = i.clienteTelefone;
    }
    if (i.km != null && (v.km == null || i.km > v.km)) v.km = i.km;
    if (i.ultimaData && (!v.ultimaData || i.ultimaData > v.ultimaData)) v.ultimaData = i.ultimaData;
    // Pedidos vêm repetidos em cada produto do mesmo relatório: conta uma vez por relatório.
    v.pedidosPor.set(i.relatorioId, i.pedidos);
    v.qtde += i.qtde;
    v.valor += i.valorTotal;
    const p = v.produtos.find((x) => x.codigo === i.produtoCodigo);
    if (p) p.qtde += i.qtde;
    else v.produtos.push({ codigo: i.produtoCodigo, nome: i.produtoNome, qtde: i.qtde });
  }
  return [...mapa.values()]
    .map(({ pedidosPor, mesDados: _, ...v }) => ({
      ...v,
      pedidos: [...pedidosPor.values()].reduce((s, n) => s + n, 0),
      produtos: v.produtos.sort((a, b) => b.qtde - a.qtde),
    }))
    .sort((a, b) => (b.ultimaData ?? '').localeCompare(a.ultimaData ?? '') || a.placa.localeCompare(b.placa));
}
