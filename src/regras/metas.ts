import type { Meta, Mes } from '../tipos';

/**
 * Meta do vendedor no mês. Se não houver meta cadastrada para o mês,
 * vale a última meta cadastrada antes dele.
 */
export function metaDoMes(metas: Meta[], vendedorCodigo: string, mes: Mes): { valor: number; herdada: boolean } | null {
  const doVendedor = metas
    .filter((m) => m.vendedorCodigo === vendedorCodigo && m.mes <= mes)
    .sort((a, b) => b.mes.localeCompare(a.mes));
  const meta = doVendedor[0];
  return meta ? { valor: meta.valor, herdada: meta.mes !== mes } : null;
}
