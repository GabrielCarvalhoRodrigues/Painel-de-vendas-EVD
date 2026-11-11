import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LinkCliente, Medalha, SeloBalcao, SemDados, Seta, SituacaoRanking, Titulo, Valor } from '../componentes/Comuns';
import { AvisosMes, Filtros } from '../componentes/Filtros';
import { Th, useOrdenacao } from '../componentes/Ordenacao';
import { TODOS, usePainel } from '../estado/PainelContext';
import { NOME_SITUACAO, type ClienteAnalise } from '../regras/analise';
import { exportarExcel } from '../utils/exportar';
import { int, num, porcento, reais } from '../utils/formato';
import { nomeMes, nomeMesCurto } from '../utils/meses';

type Linha = ClienteAnalise & { posicao: number };

const FILTROS = [
  { id: '', nome: 'Todos' },
  { id: 'queda', nome: 'Queda forte' },
  { id: 'subiu', nome: 'Subiu +50%' },
  { id: 'novo', nome: 'Novos' },
  { id: 'voltou', nome: 'Voltaram' },
] as const;

function passaFiltro(c: ClienteAnalise, filtro: string) {
  switch (filtro) {
    case 'queda':
      return c.quedaForte;
    case 'subiu':
      return c.subiuForte;
    case 'novo':
      return c.situacao === 'novo';
    case 'voltou':
      return c.situacao === 'voltou';
    default:
      return true;
  }
}

const VALORES = {
  posicao: (c: Linha) => c.posicao,
  codigo: (c: Linha) => c.codigo,
  nome: (c: Linha) => c.nome,
  qtdVendas: (c: Linha) => c.atual!.qtdVendas,
  qtde: (c: Linha) => c.atual!.qtde,
  valor: (c: Linha) => c.valorAtual,
  custo: (c: Linha) => c.atual!.valorCusto,
  resultado: (c: Linha) => c.atual!.resultado,
  markup: (c: Linha) => c.markup,
  prazo: (c: Linha) => c.atual!.prazoMedio,
  anterior: (c: Linha) => c.valorAnterior,
  variacao: (c: Linha) => c.variacao,
  situacao: (c: Linha) => NOME_SITUACAO[c.situacao],
};

export function Ranking() {
  const { analise, carregando, vendedorSel, vendedores } = usePainel();
  const [params, setParams] = useSearchParams();
  const filtro = params.get('filtro') ?? '';
  const [busca, setBusca] = useState('');

  const ranking = useMemo<Linha[]>(() => {
    if (!analise) return [];
    return analise.clientes
      .filter((c) => c.atual)
      .sort((a, b) => b.valorAtual - a.valorAtual)
      .map((c, i) => ({ ...c, posicao: i + 1 }));
  }, [analise]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return ranking.filter(
      (c) => passaFiltro(c, filtro) && (!termo || c.nome.toLowerCase().includes(termo) || c.codigo.includes(termo.replace(/^0+/, '')) || c.codigo === termo),
    );
  }, [ranking, filtro, busca]);

  const { ordenada, ordem, alternar } = useOrdenacao(filtrados, VALORES, { campo: 'posicao', desc: false });

  if (carregando) return null;
  if (!analise) return <SemDados />;

  const { mesRef, mesAnt } = analise;
  const soma = (f: (c: Linha) => number) => filtrados.reduce((s, c) => s + f(c), 0);
  const totalValor = soma((c) => c.valorAtual);
  const totalCusto = soma((c) => c.atual!.valorCusto);
  const totalResultado = soma((c) => c.atual!.resultado);
  const totalAnterior = soma((c) => c.valorAnterior ?? 0);

  function exportar() {
    const vendedor = vendedorSel === TODOS ? 'todos' : (vendedores.find((v) => v.codigo === vendedorSel)?.nome ?? vendedorSel);
    exportarExcel(
      `ranking-${vendedor.toLowerCase().replace(/\s+/g, '-')}-${mesRef}.xlsx`,
      `Ranking ${nomeMesCurto(mesRef)}`,
      ordenada.map((c) => ({
        Posição: c.posicao,
        Código: c.codigo,
        Cliente: c.nome,
        'Qtd. vendas': c.atual!.qtdVendas,
        Itens: c.atual!.qtde,
        'Valor total': Math.round(c.valorAtual * 100) / 100,
        Custo: Math.round(c.atual!.valorCusto * 100) / 100,
        Resultado: Math.round(c.atual!.resultado * 100) / 100,
        'Markup %': c.markup != null ? Math.round(c.markup * 10000) / 100 : null,
        'Prazo médio': Math.round(c.atual!.prazoMedio * 100) / 100,
        [`Valor ${nomeMesCurto(mesAnt)}`]: c.valorAnterior != null ? Math.round(c.valorAnterior * 100) / 100 : null,
        'Variação %': c.variacao != null ? Math.round(c.variacao * 10000) / 100 : null,
        Situação: c.balcao ? 'Balcão' : [c.quedaForte && 'Queda forte', c.subiuForte && 'Subiu +50%', NOME_SITUACAO[c.situacao]].filter(Boolean).join(' · '),
      })),
    );
  }

  const props = { ordem, alternar };

  return (
    <div>
      <Titulo titulo="Ranking do mês" subtitulo={<span className="capitalize">{nomeMes(mesRef)}</span>}>
        <Filtros />
      </Titulo>
      <AvisosMes />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="w-full sm:w-72">
          <span className="rotulo">Buscar cliente</span>
          <input className="campo w-full" placeholder="Nome ou código" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <div className="flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              onClick={() => setParams(f.id ? { filtro: f.id } : {})}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                filtro === f.id ? 'bg-evaldo-amarelo text-evaldo-azul-escuro' : 'border border-gray-300 bg-white text-gray-600 hover:border-evaldo-azul'
              }`}
            >
              {f.nome}
            </button>
          ))}
        </div>
        <button className="btn-secundario ml-auto" onClick={exportar} disabled={!ordenada.length}>
          ⤓ Exportar Excel
        </button>
      </div>

      {ordenada.length === 0 ? (
        <p className="card px-4 py-8 text-center text-sm text-gray-500">Nenhum cliente encontrado com esse filtro.</p>
      ) : (
        <div className="card overflow-x-auto p-2">
          <table className="tabela">
            <thead>
              <tr>
                <Th campo="posicao" {...props}>Pos.</Th>
                <Th campo="codigo" {...props}>Código</Th>
                <Th campo="nome" {...props}>Cliente</Th>
                <Th campo="qtdVendas" num {...props}>Vendas</Th>
                <Th campo="qtde" num {...props}>Itens</Th>
                <Th campo="valor" num {...props}>Valor total</Th>
                <Th campo="custo" num {...props}>Custo</Th>
                <Th campo="resultado" num {...props}>Resultado</Th>
                <Th campo="markup" num {...props}>Markup</Th>
                <Th campo="prazo" num {...props}>Prazo méd.</Th>
                <Th campo="anterior" num {...props}>{nomeMesCurto(mesAnt)}</Th>
                <Th campo="variacao" num {...props}>Variação</Th>
                <Th campo="situacao" {...props}>Situação</Th>
              </tr>
            </thead>
            <tbody>
              {ordenada.map((c) => {
                const top = c.posicao <= 3;
                return (
                  <tr key={c.codigo} className={top ? '!bg-evaldo-amarelo-claro' : c.quedaForte ? '!bg-evaldo-vermelho-claro/60' : ''}>
                    <td className={top ? 'border-l-4 border-l-evaldo-amarelo' : ''}>
                      <Medalha posicao={c.posicao} />
                    </td>
                    <td className="text-gray-500">{c.codigo}</td>
                    <td>
                      <span className="inline-flex items-center gap-2">
                        <LinkCliente codigo={c.codigo} nome={c.nome} />
                        {c.balcao && <SeloBalcao />}
                      </span>
                    </td>
                    <td className="num">{int(c.atual!.qtdVendas)}</td>
                    <td className="num">{num(c.atual!.qtde)}</td>
                    <td className="num font-bold">
                      <Valor valor={c.valorAtual} />
                    </td>
                    <td className="num">{reais(c.atual!.valorCusto)}</td>
                    <td className="num">
                      <Valor valor={c.atual!.resultado} />
                    </td>
                    <td className="num">{porcento(c.markup)}</td>
                    <td className="num">{num(c.atual!.prazoMedio)}</td>
                    <td className="num text-gray-600">{c.valorAnterior != null ? reais(c.valorAnterior) : '—'}</td>
                    <td className="num">
                      <Seta variacao={c.variacao} />
                    </td>
                    <td>
                      <SituacaoRanking c={c} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Total ({int(filtrados.length)} clientes)</td>
                <td className="num">{int(soma((c) => c.atual!.qtdVendas))}</td>
                <td className="num">{num(soma((c) => c.atual!.qtde))}</td>
                <td className="num">{reais(totalValor)}</td>
                <td className="num">{reais(totalCusto)}</td>
                <td className="num">{reais(totalResultado)}</td>
                <td className="num">{porcento(totalCusto > 0 ? totalResultado / totalCusto : null)}</td>
                <td></td>
                <td className="num">{analise.mesAntImportado ? reais(totalAnterior) : '—'}</td>
                <td className="num">
                  <Seta variacao={analise.mesAntImportado && totalAnterior > 0 ? (totalValor - totalAnterior) / totalAnterior : null} />
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
