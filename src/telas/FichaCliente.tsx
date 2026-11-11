import { useNavigate, useParams } from 'react-router-dom';
import { Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Diferenca, SeloBalcao, SemDados, SituacaoRanking, Titulo, Valor } from '../componentes/Comuns';
import { ContatoCliente } from '../componentes/ContatoCliente';
import { AvisosMes, Filtros } from '../componentes/Filtros';
import { TODOS, usePainel, useVendedorDoCliente } from '../estado/PainelContext';
import { markup } from '../regras/analise';
import { int, num, porcento, reais, reaisCurto } from '../utils/formato';
import { nomeMes, nomeMesCurto } from '../utils/meses';

export function FichaCliente() {
  const { codigo = '' } = useParams();
  const navegar = useNavigate();
  const { analise, carregando, clientes, vendedorSel, setVendedorSel, vendasFiltro, vendedores } = usePainel();
  const vendedorDoCliente = useVendedorDoCliente();

  if (carregando) return null;
  if (!analise) return <SemDados />;

  const c = analise.clientes.find((x) => x.codigo === codigo);
  const voltar = (
    <button className="btn-secundario" onClick={() => navegar(-1)}>
      ← Voltar
    </button>
  );

  if (!c) {
    const nome = clientes.get(codigo)?.nome;
    return (
      <div>
        <Titulo titulo={nome ?? `Cliente ${codigo}`}>{voltar}</Titulo>
        <div className="card p-6 text-sm">
          <p>Este cliente não tem vendas no filtro atual.</p>
          {vendedorSel !== TODOS && (
            <button className="btn-primario mt-4" onClick={() => setVendedorSel(TODOS)}>
              Ver com todos os vendedores
            </button>
          )}
        </div>
      </div>
    );
  }

  const { meses, parciais } = analise;
  const linhas = meses.map((m, i) => {
    const a = c.porMes.get(m);
    const anterior = i > 0 ? (c.porMes.get(meses[i - 1])?.valorTotal ?? 0) : null;
    return { mes: m, a, valor: a?.valorTotal ?? 0, anterior };
  });
  const custoTotal = linhas.reduce((s, l) => s + (l.a?.valorCusto ?? 0), 0);
  const resultadoTotal = linhas.reduce((s, l) => s + (l.a?.resultado ?? 0), 0);
  const nomesVendedores = new Map(vendedores.map((v) => [v.codigo, v.nome]));
  const atendidoPor = [...new Set(vendasFiltro.filter((v) => v.clienteCodigo === codigo).map((v) => nomesVendedores.get(v.vendedorCodigo) ?? v.vendedorCodigo))];

  const grafico = linhas.map((l) => ({
    mes: nomeMesCurto(l.mes) + (parciais.has(l.mes) ? '*' : ''),
    chave: l.mes,
    valor: Math.round(l.valor * 100) / 100,
    resultado: Math.round((l.a?.resultado ?? 0) * 100) / 100,
  }));

  return (
    <div>
      <Titulo
        titulo={c.nome}
        subtitulo={
          <span className="inline-flex flex-wrap items-center gap-2">
            Código {c.codigo} · <SituacaoRanking c={c} /> {c.balcao && <SeloBalcao />}
            {atendidoPor.length > 0 && <span>· Atendido por {atendidoPor.join(', ')}</span>}
          </span>
        }
      >
        <div className="flex flex-wrap items-end gap-3">
          <Filtros />
          {voltar}
        </div>
      </Titulo>
      <AvisosMes />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ['Total do período', reais(c.totalPeriodo)],
          ['Média mensal', c.mediaMensal != null ? reais(c.mediaMensal) : '—'],
          ['Última compra', c.ultimaCompra ? nomeMes(c.ultimaCompra) : '—'],
          ['Markup do período', porcento(markup(resultadoTotal, custoTotal))],
        ].map(([t, v]) => (
          <div key={t} className="card-indicador p-4">
            <div className="text-xs font-semibold uppercase text-gray-500">{t}</div>
            <div className="mt-1 text-xl font-extrabold capitalize text-evaldo-azul-escuro">{v}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-3 text-lg">Evolução mensal</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={grafico} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => reaisCurto(v)} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={85} />
                <Tooltip formatter={(v) => reais(Number(v))} contentStyle={{ borderRadius: 8, fontFamily: 'Montserrat' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span className="text-texto">{v}</span>} />
                <Bar dataKey="valor" name="Valor comprado" fill="#1A1AB8" radius={[6, 6, 0, 0]} maxBarSize={56} animationDuration={600}>
                  {grafico.map((g) => (
                    <Cell key={g.chave} fill={g.valor < 0 ? '#CC1439' : '#1A1AB8'} />
                  ))}
                </Bar>
                <Line dataKey="resultado" name="Resultado" stroke="#E1D800" strokeWidth={3} animationDuration={600} dot={{ r: 4, fill: '#E1D800', stroke: '#10107A', strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card p-4">
          <h2 className="mb-3 text-lg">Contato</h2>
          <ContatoCliente codigo={c.codigo} nome={c.nome} vendedor={vendedorDoCliente(c.codigo)} />
        </section>
      </div>

      <section className="card mt-6 overflow-x-auto p-2">
        <table className="tabela">
          <thead>
            <tr>
              <th>Mês</th>
              <th className="text-right">Valor</th>
              <th className="text-right">Dif. mês anterior</th>
              <th className="text-right">Custo</th>
              <th className="text-right">Resultado</th>
              <th className="text-right">Markup</th>
              <th className="text-right">Vendas</th>
              <th className="text-right">Itens</th>
              <th className="text-right">Prazo médio</th>
            </tr>
          </thead>
          <tbody>
            {[...linhas].reverse().map((l) => (
              <tr key={l.mes}>
                <td className="capitalize">
                  {nomeMes(l.mes)}
                  {parciais.has(l.mes) && <span className="ml-2 rounded-full bg-evaldo-amarelo px-2 text-xs font-bold normal-case text-evaldo-azul-escuro">parcial</span>}
                </td>
                <td className="num font-bold">{l.a ? <Valor valor={l.valor} /> : <span className="text-gray-400">sem compra</span>}</td>
                <td className="num">{l.anterior != null ? <Diferenca valor={l.valor - l.anterior} /> : '—'}</td>
                <td className="num">{l.a ? reais(l.a.valorCusto) : '—'}</td>
                <td className="num">{l.a ? <Valor valor={l.a.resultado} /> : '—'}</td>
                <td className="num">{l.a ? porcento(markup(l.a.resultado, l.a.valorCusto)) : '—'}</td>
                <td className="num">{l.a ? int(l.a.qtdVendas) : '—'}</td>
                <td className="num">{l.a ? num(l.a.qtde) : '—'}</td>
                <td className="num">{l.a ? num(l.a.prazoMedio) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
