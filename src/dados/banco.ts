import Dexie, { type Table } from 'dexie';
import type { Cliente, Meta, Relatorio, RelatorioProdutos, Venda, VendaProduto, Vendedor } from '../tipos';

/**
 * Banco local da VERSÃO ANTIGA do painel (IndexedDB no navegador).
 * Hoje os dados ficam no Supabase; este arquivo só é usado por dadosLocais.ts
 * para enviar ao banco o que ficou guardado no navegador.
 */
class BancoEvaldo extends Dexie {
  relatorios!: Table<Relatorio, string>;
  vendas!: Table<Venda, string>;
  clientes!: Table<Cliente, string>;
  vendedores!: Table<Vendedor, string>;
  metas!: Table<Meta, string>;
  relatoriosProdutos!: Table<RelatorioProdutos, string>;
  vendasProdutos!: Table<VendaProduto, string>;

  constructor() {
    super('painel-vendas-evaldo');
    this.version(1).stores({
      relatorios: 'id, vendedorCodigo, mes',
      vendas: 'id, relatorioId, vendedorCodigo, mes, clienteCodigo',
      clientes: 'codigo',
      vendedores: 'codigo',
      metas: 'id, vendedorCodigo, mes',
    });
    // v2: relatório de produtos vendidos (as tabelas antigas continuam iguais).
    this.version(2).stores({
      relatoriosProdutos: 'id, vendedorCodigo, mes',
      vendasProdutos: 'id, relatorioId, vendedorCodigo, mes, produtoCodigo',
    });
  }
}

export const banco = new BancoEvaldo();
