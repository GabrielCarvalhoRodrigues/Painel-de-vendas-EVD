/**
 * Permissões do painel num lugar só.
 *
 * Hoje só a gestão usa o sistema (e vê tudo). Quando os vendedores tiverem
 * acesso, basta ajustar SO_GESTAO: as telas e itens de menu listados aqui
 * somem para o vendedor. O banco também bloqueia (RLS), isto é só a interface.
 */
import type { Perfil } from './auth';

export type Tela =
  | 'visao-geral'
  | 'ranking'
  | 'deixaram'
  | 'variacao'
  | 'produtos'
  | 'produtos-visao'
  | 'produtos-pararam'
  | 'produtos-variacao'
  | 'produtos-veiculos'
  | 'produto'
  | 'cliente'
  | 'vendedores' // metas de todos e comparativo entre vendedores
  | 'importar'
  | 'importar-produtos'
  | 'dados-locais'
  | 'custo'; // colunas de custo e markup (a decidir para o vendedor)

const SO_GESTAO: Tela[] = ['vendedores', 'importar', 'importar-produtos', 'dados-locais', 'custo'];

/** Mude para true quando liberar o acesso dos vendedores (ver README). */
export const VENDEDOR_LIBERADO: boolean = false;

export function podeEntrar(perfil: Perfil | null): boolean {
  if (!perfil) return false;
  return perfil.papel === 'gestao' || (VENDEDOR_LIBERADO && perfil.papel === 'vendedor' && !!perfil.vendedorCodigo);
}

export function podeVer(tela: Tela, perfil: Perfil | null): boolean {
  if (!podeEntrar(perfil)) return false;
  if (perfil!.papel === 'gestao') return true;
  return !SO_GESTAO.includes(tela);
}
