import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SemDados, Seta, Titulo } from '../componentes/Comuns';
import { AvisosMes, Filtros } from '../componentes/Filtros';
import { usePainel } from '../estado/PainelContext';
import { variacao, type TotaisMes } from '../regras/analise';
import { int, porcento, reais, reaisCurto } from '../utils/formato';
import { nomeMes, nomeMesCurto } from '../utils/meses';

const AZUL = '#1A1AB8';
const AZUL_ESCURO = '#10107A';
const AMARELO = '#E1D800';

function CardIndicador({
  titulo,
  valor,
  comparacao,
  detalhe,
}: {
  titulo: string;
  valor: string;
  comparacao: ReactNode;
  detalhe?: string;
}) {
  return (
    <div className="card-indicador p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{titulo}</div>
      <div className="mt-1 whitespace-nowrap text-2xl font-extrabold text-evaldo-azul-escuro 2xl:text-[1.7rem]">{valor}</div>
      <div className="mt-1 text-sm">
        {comparacao} <span className="text-xs text-gray-400">vs. mês anterior</span>
      </div>
      {detalhe && <div className="mt-1 text-xs text-gray-500">{detalhe}</div>}
    </div>
  );
}

/** Diferença de markup em pontos percentuais. */
function SetaPontos({ atual, anterior }: { atual: number | null; anterior: number | null }) {
  if (atual == null || anterior == null) return <span className="text-gray-400">—</span>;
  const dif = (atual - anterior) * 100;
  if (Math.abs(dif) < 0.05) return <span className="text-gray-500">= 0,0 p.p.</span>;
  return (
    <span className={`font-semibold ${dif > 0 ? 'text-positivo' : 'text-evaldo-vermelho'}`}>
      {dif > 0 ? '▲' : '▼'} {Math.abs(dif).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.
    </span>
  );
}

function Contador({ para, numero, titulo, texto, cor }: { para: string; numero: number; titulo: string; texto: string; cor: string }) {
  return (
    <Link to={para} className={`group flex items-center gap-4 rounded-card border-l-4 bg-white p-4 shadow-card transition hover:-translate-y-0.5 ${cor}`}>
      <div className="text-4xl font-extrabold tabular-nums">{numero}</div>
      <div>
        <div className="font-bold text-evaldo-azul-escuro group-hover:underline">{titulo}</div>
        <div className="text-xs text-gray-500">{texto}</div>
      </div>
    </Link>
  );
}

export function VisaoGeral() {
  const { analise, carregando } = usePainel();

  if (carregando) return null;
  if (!analise) return <SemDados />;

  const { mesRef, mesAnt, totais, clientes, parciais } = analise;
  const atual = totais.get(mesRef)!;
  const anterior: TotaisMes | undefined = totais.get(mesAnt);

  const deixaram = clientes.filter((c) => c.situacao === 'deixou' && !c.balcao);
  const pararamNoMes = deixaram.filter((c) => c.parouNoMes).length;
  const quedas = clientes.filter((c) => c.quedaForte).length;
  const novos = clientes.filter((c) => c.situacao === 'novo').length;

  const grafico = [...totais.values()].map((t) => ({
    mes: nomeMesCurto(t.mes) + (parciais.has(t.mes) ? '*' : ''),
    chave: t.mes,
    faturamento: Math.round(t.faturamento * 100) / 100,
    clientes: t.clientesCompraram,
  }));

  return (
    <div>
      <Titulo titulo="Visão geral" subtitulo={<span className="capitalize">{nomeMes(mesRef)}</span>}>
        <Filtros />
      </Titulo>
      <AvisosMes />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <CardIndicador
          titulo="Faturamento"
          valor={reais(atual.faturamento)}
          comparacao={<Seta variacao={anterior ? variacao(atual.faturamento, anterior.faturamento) : null} />}
          detalhe={atual.devolucao > 0 ? `Já descontados ${reais(atual.devolucao)} de devolução` : undefined}
        />
        <CardIndicador
          titulo="Resultado (lucro bruto)"
          valor={reais(atual.resultado)}
          comparacao={<Seta variacao={anterior ? variacao(atual.resultado, anterior.resultado) : null} />}
        />
        <CardIndicador
          titulo="Markup médio"
          valor={porcento(atual.markup)}
          comparacao={<SetaPontos atual={atual.markup} anterior={anterior?.markup ?? null} />}
          detalhe="Resultado ÷ custo"
        />
        <CardIndicador
          titulo="Clientes que compraram"
          valor={int(atual.clientesCompraram)}
          comparacao={<Seta variacao={anterior ? variacao(atual.clientesCompraram, anterior.clientesCompraram) : null} />}
        />
        <CardIndicador
          titulo="Ticket médio por cliente"
          valor={atual.ticketMedio != null ? reais(atual.ticketMedio) : '—'}
          comparacao={<Seta variacao={anterior?.ticketMedio != null && atual.ticketMedio != null ? variacao(atual.ticketMedio, anterior.ticketMedio) : null} />}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="card p-4 xl:col-span-2">
          <h2 className="mb-1 text-lg">Faturamento por mês</h2>
          <p className="mb-3 text-xs text-gray-500">Colunas: faturamento · Linha: clientes que compraram{parciais.size ? ' · * mês parcial' : ''}</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={grafico} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#1B1D2A' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="r" tickFormatter={(v) => reaisCurto(v)} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={90} />
                <YAxis yAxisId="c" orientation="right" allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip
                  formatter={(v, nome) => (nome === 'Faturamento' ? reais(Number(v)) : int(Number(v)))}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontFamily: 'Montserrat' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span className="text-texto">{v}</span>} />
                <Bar yAxisId="r" dataKey="faturamento" name="Faturamento" fill={AZUL} radius={[6, 6, 0, 0]} maxBarSize={56} animationDuration={600}>
                  {grafico.map((g) => (
                    <Cell key={g.chave} fill={AZUL} fillOpacity={g.chave === mesRef ? 1 : 0.55} />
                  ))}
                </Bar>
                <Line
                  yAxisId="c"
                  dataKey="clientes"
                  name="Clientes"
                  stroke={AMARELO}
                  strokeWidth={3}
                  animationDuration={600}
                  dot={{ r: 5, fill: AMARELO, stroke: AZUL_ESCURO, strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg">Atenção</h2>
          <div className="space-y-3">
            <Contador
              para="/deixaram"
              numero={deixaram.length}
              titulo="Deixaram de comprar"
              texto={`Compravam e não compraram em ${nomeMesCurto(mesRef)}${pararamNoMes ? ` · ${pararamNoMes} pararam este mês` : ''}`}
              cor="border-evaldo-vermelho text-evaldo-vermelho"
            />
            <Contador
              para="/ranking?filtro=queda"
              numero={quedas}
              titulo="Queda forte"
              texto="Compraram mais de 50% abaixo do mês anterior"
              cor="border-evaldo-vermelho text-evaldo-vermelho"
            />
            <Contador
              para="/ranking?filtro=novo"
              numero={novos}
              titulo="Novos clientes"
              texto="Primeira compra foi neste mês"
              cor="border-evaldo-amarelo text-evaldo-azul-escuro"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
