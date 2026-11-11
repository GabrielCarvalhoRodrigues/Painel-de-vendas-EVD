/** Peças usadas por todas as telas de produtos. */
import type { ReactElement, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { TODOS, usePainel } from '../estado/PainelContext';
import { useProdutos } from '../estado/ProdutosContext';
import type { Medida } from '../regras/produtos';
import type { Canal } from '../tipos';
import { dataBR, num, reais } from '../utils/formato';
import { nomeMes } from '../utils/meses';
import { TelaVazia } from './Comuns';

export const CANAIS: { id: Canal | ''; nome: string }[] = [
  { id: '', nome: 'Todos os canais' },
  { id: 'balcao', nome: 'Vendas Balcão' },
  { id: 'oficina', nome: 'Vendas oficina' },
];

/** Quantidade ("12,5") ou valor ("R$ 1.234,00"), conforme a medida. */
export function formatarMedida(v: number, medida: Medida): string {
  return medida === 'valor' ? reais(v) : num(v);
}

export const NOME_MEDIDA: Record<Medida, string> = { qtde: 'Quantidade', valor: 'Valor' };

/** Diferença colorida (verde sobe, vermelho cai) na medida escolhida. */
export function DiferencaMedida({ valor, medida }: { valor: number | null; medida: Medida }) {
  if (valor == null) return <span className="text-gray-400">—</span>;
  if (Math.abs(valor) < 0.005) return <span className="text-gray-500">{formatarMedida(0, medida)}</span>;
  return (
    <span className={valor > 0 ? 'text-positivo' : 'text-evaldo-vermelho'}>
      {valor > 0 ? '+' : ''}
      {formatarMedida(valor, medida)}
    </span>
  );
}

/** Vendedor, mês, canal e (se houver valor no relatório) quantidade x valor. */
export function FiltrosProdutos({ semMes = false, semCanal = false }: { semMes?: boolean; semCanal?: boolean }) {
  const { vendedores, vendedorSel, setVendedorSel } = usePainel();
  const { meses, mesSel, setMesSel, parciais, canal, setCanal, temValor, medida, setMedida } = useProdutos();
  return (
    <div className="flex flex-wrap items-end gap-3">
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
      {!semCanal && (
        <label className="min-w-[160px] flex-1 sm:flex-none">
          <span className="rotulo">Canal</span>
          <select className="campo w-full" value={canal} onChange={(e) => setCanal(e.target.value as Canal | '')}>
            {CANAIS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
      )}
      {temValor && (
        <div>
          <span className="rotulo">Comparar por</span>
          <div className="flex overflow-hidden rounded-lg border border-gray-300 bg-white text-sm">
            {(['qtde', 'valor'] as Medida[]).map((m) => (
              <button
                key={m}
                onClick={() => setMedida(m)}
                className={`px-3 py-2 font-semibold ${medida === m ? 'bg-evaldo-azul text-white' : 'text-gray-600 hover:bg-evaldo-azul-claro'}`}
              >
                {NOME_MEDIDA[m]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Avisos do mês: parcial e mês anterior não importado. */
export function AvisosProdutos() {
  const { analise, parcialAte } = useProdutos();
  if (!analise) return null;
  const { mesRef, mesAnt, mesAntImportado, parciais, meses } = analise;
  const avisos: { tipo: 'parcial' | 'info'; texto: string }[] = [];
  if (parciais.has(mesRef)) {
    avisos.push({
      tipo: 'parcial',
      texto: `Mês parcial: ${nomeMes(mesRef)} tem dados só até ${parcialAte ? dataBR(parcialAte) : 'o meio do mês'}. As quantidades ainda vão mudar, e produtos que ainda não venderam podem aparecer como "pararam de vender".`,
    });
  }
  if (!mesAntImportado && meses.length > 1) {
    avisos.push({ tipo: 'info', texto: `O relatório de produtos de ${nomeMes(mesAnt)} não foi importado; as comparações com o mês anterior ficam em branco.` });
  }
  if (!avisos.length) return null;
  return (
    <div className="mb-5 space-y-2">
      {avisos.map((a) => (
        <div
          key={a.texto}
          className={`flex gap-2 rounded-lg border-l-4 px-4 py-3 text-sm ${
            a.tipo === 'parcial' ? 'border-evaldo-amarelo bg-evaldo-amarelo-claro text-evaldo-azul-escuro' : 'border-evaldo-azul bg-evaldo-azul-claro text-evaldo-azul-escuro'
          }`}
        >
          <span className="font-bold">{a.tipo === 'parcial' ? '⚠' : 'ℹ'}</span>
          <span>{a.texto}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Mostra carregando / erro / "importe o relatório" enquanto não há análise;
 * com análise, desenha a tela.
 */
export function ComProdutos({ children }: { children: () => ReactElement }) {
  const { carregando: carregandoPainel } = usePainel();
  const { carregando, erro, recarregar, relatorios, analise } = useProdutos();
  if (erro) {
    return (
      <TelaVazia
        titulo="Não foi possível carregar os produtos"
        texto={erro}
        acao={
          <button className="btn-primario" onClick={recarregar}>
            Tentar novamente
          </button>
        }
      />
    );
  }
  if (carregando || carregandoPainel) {
    return (
      <div className="flex items-center justify-center gap-3 py-20 text-sm text-gray-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-evaldo-azul/20 border-t-evaldo-azul" />
        Carregando produtos…
      </div>
    );
  }
  if (!relatorios.length) {
    return (
      <TelaVazia
        titulo="Importe o relatório de produtos vendidos"
        texto='Exporte do ERP o relatório "MOVIMENTO DE CLIENTES" (analítico) do mês, em CSV, e envie na aba Importar produtos.'
        acao={
          <Link to="/importar-produtos" className="btn-primario">
            Importar produtos
          </Link>
        }
      />
    );
  }
  if (!analise) {
    return (
      <div>
        <div className="mb-5">
          <FiltrosProdutos semMes semCanal />
        </div>
        <p className="card px-4 py-8 text-center text-sm text-gray-500">Nenhum relatório de produtos para esse vendedor. Escolha outro vendedor no filtro.</p>
      </div>
    );
  }
  return children();
}

export function LinkProduto({ codigo, nome }: { codigo: string; nome: ReactNode }) {
  return (
    <Link to={`/produto/${encodeURIComponent(codigo)}`} className="font-semibold text-evaldo-azul-escuro hover:text-evaldo-azul hover:underline">
      {nome}
    </Link>
  );
}
