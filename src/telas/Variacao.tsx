import { useMemo, useState } from 'react';
import { Diferenca, LinkCliente, SeloBalcao, SemDados, Seta, Titulo, Valor } from '../componentes/Comuns';
import { AvisosMes, Filtros } from '../componentes/Filtros';
import { Th, useOrdenacao } from '../componentes/Ordenacao';
import { usePainel } from '../estado/PainelContext';
import type { ClienteAnalise } from '../regras/analise';
import { reais } from '../utils/formato';
import { nomeMes, nomeMesCurto } from '../utils/meses';

interface Linha {
  c: ClienteAnalise;
  valores: number[];
  ultimo: number;
  media: number | null;
  dif: number | null;
  difPct: number | null;
}

const VALORES = {
  nome: (l: Linha) => l.c.nome,
  ultimo: (l: Linha) => l.ultimo,
  media: (l: Linha) => l.media,
  dif: (l: Linha) => l.dif,
  difPct: (l: Linha) => l.difPct,
};

type Direcao = 'todos' | 'caiu' | 'subiu';

export function Variacao() {
  const { analise, carregando } = usePainel();
  const [direcao, setDirecao] = useState<Direcao>('todos');
  const [minPct, setMinPct] = useState('');
  const [busca, setBusca] = useState('');

  const linhas = useMemo<Linha[]>(() => {
    if (!analise) return [];
    return analise.clientes
      .filter((c) => analise.meses.some((m) => c.porMes.has(m)))
      .map((c) => {
        const valores = analise.meses.map((m) => c.porMes.get(m)?.valorTotal ?? 0);
        const ultimo = valores.at(-1) ?? 0;
        const media = c.mediaAnteriores;
        const dif = media != null ? ultimo - media : null;
        const difPct = media != null && media > 0 ? (ultimo - media) / media : null;
        return { c, valores, ultimo, media, dif, difPct };
      });
  }, [analise]);

  const filtradas = useMemo(() => {
    const limite = Number(minPct.replace(',', '.')) / 100;
    const termo = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (direcao === 'caiu' && !(l.dif != null && l.dif < 0)) return false;
      if (direcao === 'subiu' && !(l.dif != null && l.dif > 0)) return false;
      if (limite > 0 && !(l.difPct != null && Math.abs(l.difPct) > limite)) return false;
      if (termo && !l.c.nome.toLowerCase().includes(termo) && !l.c.codigo.includes(termo)) return false;
      return true;
    });
  }, [linhas, direcao, minPct, busca]);

  const { ordenada, ordem, alternar } = useOrdenacao(filtradas, VALORES, { campo: 'ultimo', desc: true });

  if (carregando) return null;
  if (!analise) return <SemDados />;

  const { meses, mesRef } = analise;
  const totais = meses.map((_, i) => filtradas.reduce((s, l) => s + l.valores[i], 0));
  const totalUltimo = totais.at(-1) ?? 0;
  const totalMedia = filtradas.some((l) => l.media != null) ? filtradas.reduce((s, l) => s + (l.media ?? 0), 0) : null;
  const totalDif = totalMedia != null ? totalUltimo - totalMedia : null;
  const props = { ordem, alternar };

  return (
    <div>
      <Titulo titulo="Comprou mais ou menos" subtitulo={`Valor de cada cliente mês a mês, até ${nomeMes(mesRef)}. Embaixo de cada valor, a diferença para o mês anterior.`}>
        <Filtros />
      </Titulo>
      <AvisosMes />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="w-full sm:w-64">
          <span className="rotulo">Buscar cliente</span>
          <input className="campo w-full" placeholder="Nome ou código" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <div>
          <span className="rotulo">Mostrar</span>
          <div className="flex overflow-hidden rounded-lg border border-gray-300 bg-white text-sm">
            {(
              [
                ['todos', 'Todos'],
                ['caiu', '▼ Só quem caiu'],
                ['subiu', '▲ Só quem subiu'],
              ] as [Direcao, string][]
            ).map(([id, nome]) => (
              <button
                key={id}
                onClick={() => setDirecao(id)}
                className={`px-3 py-2 font-semibold ${direcao === id ? 'bg-evaldo-azul text-white' : 'text-gray-600 hover:bg-evaldo-azul-claro'}`}
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
        <p className="w-full text-xs text-gray-500 lg:ml-auto lg:w-auto">
          Os filtros comparam {nomeMesCurto(mesRef)} com a média dos meses fechados anteriores.
        </p>
      </div>

      {meses.length < 2 && (
        <p className="mb-4 rounded-lg bg-evaldo-azul-claro px-4 py-3 text-sm text-evaldo-azul-escuro">
          ℹ Importe pelo menos dois meses para comparar a evolução dos clientes.
        </p>
      )}

      {ordenada.length === 0 ? (
        <p className="card px-4 py-8 text-center text-sm text-gray-500">Nenhum cliente com esse filtro.</p>
      ) : (
        <div className="card overflow-x-auto p-2">
          <table className="tabela">
            <thead>
              <tr>
                <Th campo="nome" {...props}>Cliente</Th>
                {meses.map((m) => (
                  <th key={m} className="text-right">
                    {nomeMesCurto(m)}
                    {analise.parciais.has(m) ? '*' : ''}
                  </th>
                ))}
                <Th campo="media" num {...props}>Média anteriores</Th>
                <Th campo="dif" num {...props}>Último x média</Th>
                <Th campo="difPct" num {...props}>%</Th>
              </tr>
            </thead>
            <tbody>
              {ordenada.map((l) => (
                <tr key={l.c.codigo}>
                  <td>
                    <span className="inline-flex items-center gap-2">
                      <LinkCliente codigo={l.c.codigo} nome={l.c.nome} />
                      {l.c.balcao && <SeloBalcao />}
                    </span>
                    <div className="text-xs text-gray-500">{l.c.codigo}</div>
                  </td>
                  {l.valores.map((v, i) => (
                    <td key={meses[i]} className="num align-top">
                      <div className={i === meses.length - 1 ? 'font-bold' : ''}>{v === 0 && !l.c.porMes.has(meses[i]) ? <span className="text-gray-400">—</span> : <Valor valor={v} />}</div>
                      {i > 0 && (l.c.porMes.has(meses[i]) || l.c.porMes.has(meses[i - 1])) && (
                        <div className="text-xs">
                          <Diferenca valor={v - l.valores[i - 1]} />
                        </div>
                      )}
                    </td>
                  ))}
                  <td className="num">{l.media != null ? reais(l.media) : '—'}</td>
                  <td className="num font-semibold">
                    <Diferenca valor={l.dif} />
                  </td>
                  <td className="num">
                    <Seta variacao={l.difPct} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total da carteira ({filtradas.length})</td>
                {totais.map((t, i) => (
                  <td key={meses[i]} className="num align-top">
                    <div>{reais(t)}</div>
                    {i > 0 && (
                      <div className="text-xs">
                        <Diferenca valor={t - totais[i - 1]} />
                      </div>
                    )}
                  </td>
                ))}
                <td className="num">{totalMedia != null ? reais(totalMedia) : '—'}</td>
                <td className="num">
                  <Diferenca valor={totalDif} />
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
