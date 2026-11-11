import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Seta, Titulo } from '../componentes/Comuns';
import { AvisosProdutos, ComProdutos, FiltrosProdutos, formatarMedida, LinkProduto, NOME_MEDIDA } from '../componentes/ProdutosComuns';
import { useProdutos } from '../estado/ProdutosContext';
import { variacao } from '../regras/analise';
import { medidaDe } from '../regras/produtos';
import { int, num, porcento, reais, reaisCurto } from '../utils/formato';
import { nomeMes, nomeMesCurto } from '../utils/meses';

const AZUL = '#1A1AB8';
const AZUL_ESCURO = '#10107A';
const AMARELO = '#E1D800';

function Card({ titulo, valor, comparacao, detalhe }: { titulo: string; valor: string; comparacao?: ReactNode; detalhe?: string }) {
  return (
    <div className="card-indicador p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{titulo}</div>
      <div className="mt-1 whitespace-nowrap text-2xl font-extrabold text-evaldo-azul-escuro 2xl:text-[1.7rem]">{valor}</div>
      {comparacao !== undefined && (
        <div className="mt-1 text-sm">
          {comparacao} <span className="text-xs text-gray-400">vs. mês anterior</span>
        </div>
      )}
      {detalhe && <div className="mt-1 text-xs text-gray-500">{detalhe}</div>}
    </div>
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

export function ProdutosVisaoGeral() {
  return <ComProdutos>{() => <Conteudo />}</ComProdutos>;
}

function Conteudo() {
  const { analise, temValor } = useProdutos();
  const { mesRef, mesAnt, totais, produtos, parciais, medida } = analise!;
  const atual = totais.get(mesRef)!;
  const anterior = totais.get(mesAnt);
  const comp = (a: number, b: number | undefined) => <Seta variacao={b != null ? variacao(a, b) : null} />;

  const pararam = produtos.filter((p) => p.situacao === 'deixou');
  const pararamNoMes = pararam.filter((p) => p.parouNoMes).length;
  const quedas = produtos.filter((p) => p.quedaForte).length;
  const novos = produtos.filter((p) => p.situacao === 'novo').length;
  const top = produtos
    .filter((p) => p.noMes > 0)
    .sort((a, b) => b.noMes - a.noMes)
    .slice(0, 10);
  const partBalcao = atual.qtde > 0 ? atual.qtdeBalcao / atual.qtde : null;

  const grafico = [...totais.values()].map((t) => ({
    mes: nomeMesCurto(t.mes) + (parciais.has(t.mes) ? '*' : ''),
    chave: t.mes,
    medida: Math.round((medida === 'valor' ? t.valor : t.qtde) * 100) / 100,
    produtos: t.produtosVendidos,
  }));
  const nomeBarra = medida === 'valor' ? 'Valor vendido' : 'Itens vendidos';

  return (
    <div>
      <Titulo titulo="Visão geral de produtos" subtitulo={<span className="capitalize">{nomeMes(mesRef)}</span>}>
        <FiltrosProdutos />
      </Titulo>
      <AvisosProdutos />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card titulo="Itens vendidos" valor={num(atual.qtde)} comparacao={comp(atual.qtde, anterior?.qtde)} />
        {temValor && <Card titulo="Valor vendido" valor={reais(atual.valor)} comparacao={comp(atual.valor, anterior?.valor)} />}
        <Card titulo="Produtos diferentes" valor={int(atual.produtosVendidos)} comparacao={comp(atual.produtosVendidos, anterior?.produtosVendidos)} />
        <Card
          titulo="Balcão x oficina"
          valor={partBalcao == null ? '—' : `${porcento(partBalcao)} · ${porcento(1 - partBalcao)}`}
          detalhe={`Balcão ${num(atual.qtdeBalcao)} itens · Oficina ${num(atual.qtdeOficina)} itens`}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="card p-4 xl:col-span-2">
          <h2 className="mb-1 text-lg">{nomeBarra} por mês</h2>
          <p className="mb-3 text-xs text-gray-500">Colunas: {nomeBarra.toLowerCase()} · Linha: produtos diferentes vendidos{parciais.size ? ' · * mês parcial' : ''}</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={grafico} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#1B1D2A' }} axisLine={false} tickLine={false} />
                <YAxis
                  yAxisId="m"
                  tickFormatter={(v) => (medida === 'valor' ? reaisCurto(v) : int(v))}
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  width={medida === 'valor' ? 90 : 60}
                />
                <YAxis yAxisId="p" orientation="right" allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  formatter={(v, nome) => (nome === nomeBarra ? formatarMedida(Number(v), medida) : int(Number(v)))}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontFamily: 'Montserrat' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span className="text-texto">{v}</span>} />
                <Bar yAxisId="m" dataKey="medida" name={nomeBarra} fill={AZUL} radius={[6, 6, 0, 0]} maxBarSize={56} animationDuration={600}>
                  {grafico.map((g) => (
                    <Cell key={g.chave} fill={AZUL} fillOpacity={g.chave === mesRef ? 1 : 0.55} />
                  ))}
                </Bar>
                <Line
                  yAxisId="p"
                  dataKey="produtos"
                  name="Produtos diferentes"
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
              para="/produtos/pararam"
              numero={pararam.length}
              titulo="Pararam de vender"
              texto={`Vendiam e não venderam em ${nomeMesCurto(mesRef)}${pararamNoMes ? ` · ${pararamNoMes} pararam este mês` : ''}`}
              cor="border-evaldo-vermelho text-evaldo-vermelho"
            />
            <Contador
              para="/produtos/variacao?filtro=queda"
              numero={quedas}
              titulo="Queda forte"
              texto="Venderam mais de 50% abaixo do mês anterior"
              cor="border-evaldo-vermelho text-evaldo-vermelho"
            />
            <Contador
              para="/produtos/variacao?filtro=novo"
              numero={novos}
              titulo="Produtos novos"
              texto="Primeira venda foi neste mês"
              cor="border-evaldo-amarelo text-evaldo-azul-escuro"
            />
          </div>
        </section>
      </div>

      <section className="card mt-6 overflow-x-auto p-2">
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-2">
          <h2 className="text-lg">Top 10 produtos de {nomeMesCurto(mesRef)}</h2>
          <Link to="/produtos" className="text-sm font-semibold text-evaldo-azul hover:underline">
            Ver todos os produtos →
          </Link>
        </div>
        {top.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-500">Nenhum produto vendido neste mês com esse filtro.</p>
        ) : (
          <table className="tabela mt-2">
            <thead>
              <tr>
                <th>Pos.</th>
                <th>Produto</th>
                <th className="text-right">{NOME_MEDIDA[medida]}</th>
                <th className="text-right">Mês anterior</th>
                <th className="text-right">Variação</th>
              </tr>
            </thead>
            <tbody>
              {top.map((p, i) => (
                <tr key={p.codigo}>
                  <td className="text-gray-500">{i + 1}º</td>
                  <td>
                    <LinkProduto codigo={p.codigo} nome={p.nome} />
                    <div className="text-xs text-gray-500">{p.codigo}</div>
                  </td>
                  <td className="num font-bold">{formatarMedida(p.noMes, medida)}</td>
                  <td className="num">{p.anterior != null ? formatarMedida(medidaDe(p.porMes.get(mesAnt), medida), medida) : '—'}</td>
                  <td className="num">
                    <Seta variacao={variacao(p.noMes, p.anterior)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
