import { TODOS, usePainel } from '../estado/PainelContext';
import { nomeMes } from '../utils/meses';
import { dataBR } from '../utils/formato';

/** Filtros de vendedor e mês, usados no topo das telas. */
export function Filtros({ semMes = false }: { semMes?: boolean }) {
  const { vendedores, vendedorSel, setVendedorSel, meses, mesSel, setMesSel, parciais } = usePainel();
  return (
    <div className="flex flex-wrap gap-3">
      <label className="min-w-[180px] flex-1 sm:flex-none">
        <span className="rotulo">Vendedor</span>
        <select className="campo w-full" value={vendedorSel} onChange={(e) => setVendedorSel(e.target.value)}>
          <option value={TODOS}>Todos</option>
          {vendedores.map((v) => (
            <option key={v.codigo} value={v.codigo}>
              {v.codigo} - {v.nome}
            </option>
          ))}
        </select>
      </label>
      {!semMes && (
        <label className="min-w-[160px] flex-1 sm:flex-none">
          <span className="rotulo">Mês</span>
          <select className="campo w-full capitalize" value={mesSel ?? ''} onChange={(e) => setMesSel(e.target.value)}>
            {[...meses].reverse().map((m) => (
              <option key={m} value={m}>
                {nomeMes(m)}
                {parciais.has(m) ? ' (parcial)' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

/** Avisos do mês selecionado: parcial, vendedores sem relatório, mês anterior faltando. */
export function AvisosMes() {
  const { analise, relatorios, vendedorSel, vendedoresSemMes } = usePainel();
  if (!analise) return null;
  const { mesRef, mesAnt, mesAntImportado, parciais, meses } = analise;

  const avisos: { tipo: 'parcial' | 'info'; texto: string }[] = [];
  if (parciais.has(mesRef)) {
    const dofiltro = relatorios.filter((r) => r.mes === mesRef && r.parcial && (vendedorSel === TODOS || r.vendedorCodigo === vendedorSel));
    const ate = dofiltro.map((r) => r.dataFinal).sort()[0];
    avisos.push({
      tipo: 'parcial',
      texto: `Mês parcial: ${nomeMes(mesRef)} tem dados só até ${ate ? dataBR(ate) : 'o meio do mês'}. Os números ainda vão mudar, e quem ainda não comprou pode aparecer como "deixou de comprar".`,
    });
  }
  if (vendedoresSemMes.length) {
    avisos.push({
      tipo: 'info',
      texto: `Sem relatório de ${nomeMes(mesRef)} para: ${vendedoresSemMes.map((v) => v.nome).join(', ')}.`,
    });
  }
  if (!mesAntImportado && meses.length > 1) {
    avisos.push({ tipo: 'info', texto: `O mês anterior (${nomeMes(mesAnt)}) não foi importado; as comparações ficam em branco.` });
  }
  if (!avisos.length) return null;

  return (
    <div className="mb-5 space-y-2">
      {avisos.map((a) => (
        <div
          key={a.texto}
          className={`flex gap-2 rounded-lg border-l-4 px-4 py-3 text-sm ${
            a.tipo === 'parcial'
              ? 'border-evaldo-amarelo bg-evaldo-amarelo-claro text-evaldo-azul-escuro'
              : 'border-evaldo-azul bg-evaldo-azul-claro text-evaldo-azul-escuro'
          }`}
        >
          <span className="font-bold">{a.tipo === 'parcial' ? '⚠' : 'ℹ'}</span>
          <span>{a.texto}</span>
        </div>
      ))}
    </div>
  );
}
