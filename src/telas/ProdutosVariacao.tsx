import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Seta, Titulo } from '../componentes/Comuns';
import { Th, useOrdenacao } from '../componentes/Ordenacao';
import { AvisosProdutos, ComProdutos, DiferencaMedida, FiltrosProdutos, formatarMedida, LinkProduto } from '../componentes/ProdutosComuns';
import { useProdutos } from '../estado/ProdutosContext';
import { medidaDe, type ProdutoAnalise } from '../regras/produtos';
import { exportarExcel } from '../utils/exportar';
import { nomeMes, nomeMesCurto } from '../utils/meses';

interface Linha {
  p: ProdutoAnalise;
  valores: number[];
  ultimo: number;
  media: number | null;
  dif: number | null;
  difPct: number | null;
}

const VALORES = {
  nome: (l: Linha) => l.p.nome,
  ultimo: (l: Linha) => l.ultimo,
  media: (l: Linha) => l.media,
  dif: (l: Linha) => l.dif,
  difPct: (l: Linha) => l.difPct,
};

type Filtro = 'todos' | 'caiu' | 'subiu' | 'queda' | 'novo';

const FILTROS: [Filtro, string][] = [
  ['todos', 'Todos'],
  ['caiu', '▼ Só os que caíram'],
  ['subiu', '▲ Só os que subiram'],
  ['queda', 'Queda forte'],
  ['novo', 'Novos'],
];

export function ProdutosVariacao() {
  return <ComProdutos>{() => <Conteudo />}</ComProdutos>;
}

function Conteudo() {
  const { analise } = useProdutos();
  const { meses, mesRef, parciais, produtos, medida } = analise!;
  const [params, setParams] = useSearchParams();
  const filtro = (FILTROS.some(([id]) => id === params.get('filtro')) ? params.get('filtro') : 'todos') as Filtro;
  const [minPct, setMinPct] = useState('');
  const [busca, setBusca] = useState('');
  const mesesAte = useMemo(() => meses.filter((m) => m <= mesRef), [meses, mesRef]);

  const linhas = useMemo<Linha[]>(
    () =>
      produtos
        .filter((p) => mesesAte.some((m) => p.porMes.has(m)))
        .map((p) => {
          const valores = mesesAte.map((m) => medidaDe(p.porMes.get(m), medida));
          const ultimo = valores.at(-1) ?? 0;
          const media = p.mediaAnteriores;
          const dif = media != null ? ultimo - media : null;
          const difPct = media != null && media > 0 ? (ultimo - media) / media : null;
          return { p, valores, ultimo, media, dif, difPct };
        }),
    [produtos, mesesAte, medida],
  );

  const filtradas = useMemo(() => {
    const limite = Number(minPct.replace(',', '.')) / 100;
    const termo = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (filtro === 'caiu' && !(l.dif != null && l.dif < 0)) return false;
      if (filtro === 'subiu' && !(l.dif != null && l.dif > 0)) return false;
      if (filtro === 'queda' && !l.p.quedaForte) return false;
      if (filtro === 'novo' && l.p.situacao !== 'novo') return false;
      if (limite > 0 && !(l.difPct != null && Math.abs(l.difPct) > limite)) return false;
      if (termo && !l.p.nome.toLowerCase().includes(termo) && !l.p.codigo.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [linhas, filtro, minPct, busca]);

  const { ordenada, ordem, alternar } = useOrdenacao(filtradas, VALORES, { campo: 'ultimo', desc: true });

  const totais = mesesAte.map((_, i) => filtradas.reduce((s, l) => s + l.valores[i], 0));
  const totalUltimo = totais.at(-1) ?? 0;
  const totalMedia = filtradas.some((l) => l.media != null) ? filtradas.reduce((s, l) => s + (l.media ?? 0), 0) : null;
  const totalDif = totalMedia != null ? totalUltimo - totalMedia : null;
  const props = { ordem, alternar };
  const fmt = (v: number) => formatarMedida(v, medida);

  function exportar() {
    exportarExcel(
      `produtos-variacao-${mesRef}.xlsx`,
      `Variação ${nomeMesCurto(mesRef)}`,
      ordenada.map((l) => ({
        Código: l.p.codigo,
        Produto: l.p.nome,
        ...Object.fromEntries(mesesAte.map((m, i) => [nomeMesCurto(m), Math.round(l.valores[i] * 100) / 100])),
        'Média anteriores': l.media != null ? Math.round(l.media * 100) / 100 : null,
        'Último x média': l.dif != null ? Math.round(l.dif * 100) / 100 : null,
        '%': l.difPct != null ? Math.round(l.difPct * 1000) / 10 : null,
      })),
    );
  }

  return (
    <div>
      <Titulo
        titulo="Vendeu mais ou menos"
        subtitulo={`${medida === 'valor' ? 'Valor' : 'Quantidade'} de cada produto mês a mês, até ${nomeMes(mesRef)}. Embaixo de cada número, a diferença para o mês anterior.`}
      >
        <FiltrosProdutos />
      </Titulo>
      <AvisosProdutos />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="w-full sm:w-64">
          <span className="rotulo">Buscar produto</span>
          <input className="campo w-full" placeholder="Descrição ou código" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <div>
          <span className="rotulo">Mostrar</span>
          <div className="flex flex-wrap overflow-hidden rounded-lg border border-gray-300 bg-white text-sm">
            {FILTROS.map(([id, nome]) => (
              <button
                key={id}
                onClick={() => setParams(id === 'todos' ? {} : { filtro: id })}
                className={`px-3 py-2 font-semibold ${filtro === id ? 'bg-evaldo-azul text-white' : 'text-gray-600 hover:bg-evaldo-azul-claro'}`}
              >
                {nome}
              </button>
            ))}
          </div>
        </div>
        <label>
          <span className="rotulo">Variação maior que</span>
          <div className="flex items-center gap-1">
            <input className="campo w-20 text-right" inputMode="decimal" placeholder="0" value={minPct} onChange={(e) => setMinPct(e.target.value)} />
            <span className="text-sm font-semibold">%</span>
          </div>
        </label>
        <button className="btn-secundario ml-auto" onClick={exportar} disabled={!ordenada.length}>
          ⤓ Exportar Excel
        </button>
        <p className="w-full text-xs text-gray-500">
          "Caíram/subiram" e o filtro de % comparam {nomeMesCurto(mesRef)} com a média dos meses fechados anteriores. "Queda forte" compara com o mês anterior.
        </p>
      </div>

      {mesesAte.length < 2 && (
        <p className="mb-4 rounded-lg bg-evaldo-azul-claro px-4 py-3 text-sm text-evaldo-azul-escuro">ℹ Importe pelo menos dois meses de produtos para comparar a evolução.</p>
      )}

      {ordenada.length === 0 ? (
        <p className="card px-4 py-8 text-center text-sm text-gray-500">Nenhum produto com esse filtro.</p>
      ) : (
        <div className="card overflow-x-auto p-2">
          <table className="tabela">
            <thead>
              <tr>
                <Th campo="nome" {...props}>Produto</Th>
                {mesesAte.map((m) => (
                  <th key={m} className="text-right">
                    {nomeMesCurto(m)}
                    {parciais.has(m) ? '*' : ''}
                  </th>
                ))}
                <Th campo="media" num {...props}>Média anteriores</Th>
                <Th campo="dif" num {...props}>Último x média</Th>
                <Th campo="difPct" num {...props}>%</Th>
              </tr>
            </thead>
            <tbody>
              {ordenada.map((l) => (
                <tr key={l.p.codigo}>
                  <td>
                    <LinkProduto codigo={l.p.codigo} nome={l.p.nome} />
                    <div className="text-xs text-gray-500">{l.p.codigo}</div>
                  </td>
                  {l.valores.map((v, i) => (
                    <td key={mesesAte[i]} className="num align-top">
                      <div className={i === mesesAte.length - 1 ? 'font-bold' : ''}>
                        {v === 0 && !l.p.porMes.has(mesesAte[i]) ? <span className="text-gray-400">—</span> : fmt(v)}
                      </div>
                      {i > 0 && (l.p.porMes.has(mesesAte[i]) || l.p.porMes.has(mesesAte[i - 1])) && (
                        <div className="text-xs">
                          <DiferencaMedida valor={v - l.valores[i - 1]} medida={medida} />
                        </div>
                      )}
                    </td>
                  ))}
                  <td className="num">{l.media != null ? fmt(l.media) : '—'}</td>
                  <td className="num font-semibold">
                    <DiferencaMedida valor={l.dif} medida={medida} />
                  </td>
                  <td className="num">
                    <Seta variacao={l.difPct} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total ({filtradas.length} produtos)</td>
                {totais.map((t, i) => (
                  <td key={mesesAte[i]} className="num align-top">
                    <div>{fmt(t)}</div>
                    {i > 0 && (
                      <div className="text-xs">
                        <DiferencaMedida valor={t - totais[i - 1]} medida={medida} />
                      </div>
                    )}
                  </td>
                ))}
                <td className="num">{totalMedia != null ? fmt(totalMedia) : '—'}</td>
                <td className="num">
                  <DiferencaMedida valor={totalDif} medida={medida} />
                </td>
                <td className="num">
                  <Seta variacao={totalMedia ? (totalUltimo - totalMedia) / totalMedia : null} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
