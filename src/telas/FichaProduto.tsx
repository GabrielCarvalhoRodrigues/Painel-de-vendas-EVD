import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SeloSituacao, Titulo } from '../componentes/Comuns';
import { AvisosProdutos, ComProdutos, DiferencaMedida, FiltrosProdutos, formatarMedida } from '../componentes/ProdutosComuns';
import { TODOS, usePainel } from '../estado/PainelContext';
import { useProdutos } from '../estado/ProdutosContext';
import { medidaDe } from '../regras/produtos';
import { num, porcento, reais } from '../utils/formato';
import { nomeMes, nomeMesCurto } from '../utils/meses';

const AZUL = '#1A1AB8';
const AMARELO = '#E1D800';

export function FichaProduto() {
  return <ComProdutos>{() => <Conteudo />}</ComProdutos>;
}

function Conteudo() {
  const { codigo: codigoUrl = '' } = useParams();
  const codigo = decodeURIComponent(codigoUrl);
  const navegar = useNavigate();
  const { vendedores, vendedorSel, setVendedorSel } = usePainel();
  const { analise, vendasFiltro, canal, temValor } = useProdutos();
  const { meses, mesRef, parciais, medida } = analise!;
  const p = analise!.produtos.find((x) => x.codigo === codigo);

  // Por vendedor no mês escolhido (respeita o filtro de canal).
  const porVendedor = useMemo(() => {
    const nomes = new Map(vendedores.map((v) => [v.codigo, v.nome]));
    const soma = new Map<string, { codigo: string; nome: string; qtde: number; qtdeBalcao: number; qtdeOficina: number; valor: number }>();
    for (const v of vendasFiltro) {
      if (v.produtoCodigo !== codigo || v.mes !== mesRef || (canal && v.canal !== canal)) continue;
      const s = soma.get(v.vendedorCodigo) ?? { codigo: v.vendedorCodigo, nome: nomes.get(v.vendedorCodigo) ?? v.vendedorCodigo, qtde: 0, qtdeBalcao: 0, qtdeOficina: 0, valor: 0 };
      s.qtde += v.qtde;
      if (v.canal === 'oficina') s.qtdeOficina += v.qtde;
      else s.qtdeBalcao += v.qtde;
      s.valor += v.valorTotal;
      soma.set(v.vendedorCodigo, s);
    }
    return [...soma.values()].sort((a, b) => b.qtde - a.qtde);
  }, [vendasFiltro, vendedores, codigo, mesRef, canal]);

  const voltar = (
    <button className="btn-secundario" onClick={() => navegar(-1)}>
      ← Voltar
    </button>
  );

  if (!p) {
    return (
      <div>
        <Titulo titulo={`Produto ${codigo}`}>{voltar}</Titulo>
        <div className="card p-6 text-sm">
          <p>Este produto não tem vendas até {nomeMes(mesRef)} no filtro atual (vendedor e canal).</p>
          {vendedorSel !== TODOS && (
            <button className="btn-primario mt-4" onClick={() => setVendedorSel(TODOS)}>
              Ver com todos os vendedores
            </button>
          )}
        </div>
      </div>
    );
  }

  const mesesAte = meses.filter((m) => m <= mesRef);
  const linhas = mesesAte.map((m, i) => {
    const d = p.porMes.get(m);
    const anterior = i > 0 ? medidaDe(p.porMes.get(mesesAte[i - 1]), medida) : null;
    return { mes: m, d, valor: medidaDe(d, medida), anterior };
  });
  const totalBalcao = linhas.reduce((s, l) => s + (l.d?.qtdeBalcao ?? 0), 0);
  const totalOficina = linhas.reduce((s, l) => s + (l.d?.qtdeOficina ?? 0), 0);
  const partBalcao = totalBalcao + totalOficina > 0 ? totalBalcao / (totalBalcao + totalOficina) : null;
  const precoMedio = temValor && p.totalQtde > 0 ? p.totalValor / p.totalQtde : null;

  const grafico = linhas.map((l) => ({
    mes: nomeMesCurto(l.mes) + (parciais.has(l.mes) ? '*' : ''),
    balcao: Math.round((l.d?.qtdeBalcao ?? 0) * 100) / 100,
    oficina: Math.round((l.d?.qtdeOficina ?? 0) * 100) / 100,
  }));

  return (
    <div>
      <Titulo
        titulo={p.nome}
        subtitulo={
          <span className="inline-flex flex-wrap items-center gap-2">
            Código {p.codigo} · <SeloSituacao situacao={p.situacao} />
            {p.quedaForte && <span className="rounded-full bg-evaldo-vermelho px-2 py-0.5 text-xs font-semibold text-white">▼ Queda forte</span>}
            {p.subiuForte && <span className="rounded-full bg-positivo px-2 py-0.5 text-xs font-semibold text-white">▲ Subiu +50%</span>}
          </span>
        }
      >
        <div className="flex flex-wrap items-end gap-3">
          <FiltrosProdutos />
          {voltar}
        </div>
      </Titulo>
      <AvisosProdutos />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ['Itens no período', num(p.totalQtde)],
          [temValor ? 'Valor no período' : 'Média mensal', temValor ? reais(p.totalValor) : p.mediaAnteriores != null ? formatarMedida(p.mediaAnteriores, medida) : '—'],
          ['Última venda', p.ultimaVenda ? nomeMes(p.ultimaVenda) : '—'],
          precoMedio != null ? ['Preço médio', reais(precoMedio)] : ['Balcão x oficina', partBalcao == null ? '—' : `${porcento(partBalcao)} · ${porcento(1 - partBalcao)}`],
        ].map(([t, v]) => (
          <div key={t} className="card-indicador p-4">
            <div className="text-xs font-semibold uppercase text-gray-500">{t}</div>
            <div className="mt-1 text-xl font-extrabold capitalize text-evaldo-azul-escuro">{v}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-1 text-lg">Itens vendidos por mês</h2>
          <p className="mb-3 text-xs text-gray-500">
            Balcão x oficina{partBalcao != null ? ` · no período: ${porcento(partBalcao)} balcão, ${porcento(1 - partBalcao)} oficina` : ''}
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grafico} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={50} />
                <Tooltip formatter={(v) => num(Number(v))} contentStyle={{ borderRadius: 8, fontFamily: 'Montserrat' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span className="text-texto">{v}</span>} />
                <Bar dataKey="balcao" name="Balcão" stackId="c" fill={AZUL} maxBarSize={56} animationDuration={600} />
                <Bar dataKey="oficina" name="Oficina" stackId="c" fill={AMARELO} radius={[6, 6, 0, 0]} maxBarSize={56} animationDuration={600} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card overflow-x-auto p-4">
          <h2 className="mb-1 text-lg">Vendedores em {nomeMesCurto(mesRef)}</h2>
          <p className="mb-3 text-xs text-gray-500">Quem vendeu este produto no mês escolhido.</p>
          {porVendedor.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">Nenhuma venda deste produto em {nomeMes(mesRef)}.</p>
          ) : (
            <table className="tabela">
              <thead>
                <tr>
                  <th>Vendedor</th>
                  <th className="text-right">Quantidade</th>
                  <th className="text-right">Balcão</th>
                  <th className="text-right">Oficina</th>
                  {temValor && <th className="text-right">Valor</th>}
                </tr>
              </thead>
              <tbody>
                {porVendedor.map((v) => (
                  <tr key={v.codigo}>
                    <td className="font-semibold text-evaldo-azul-escuro">{v.nome}</td>
                    <td className="num font-bold">{num(v.qtde)}</td>
                    <td className="num">{num(v.qtdeBalcao)}</td>
                    <td className="num">{num(v.qtdeOficina)}</td>
                    {temValor && <td className="num">{reais(v.valor)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="card mt-6 overflow-x-auto p-2">
        <table className="tabela">
          <thead>
            <tr>
              <th>Mês</th>
              <th className="text-right">Quantidade</th>
              <th className="text-right">Balcão</th>
              <th className="text-right">Oficina</th>
              {temValor && <th className="text-right">Valor</th>}
              {temValor && <th className="text-right">Preço médio</th>}
              <th className="text-right">Dif. mês anterior</th>
            </tr>
          </thead>
          <tbody>
            {[...linhas].reverse().map((l) => (
              <tr key={l.mes}>
                <td className="capitalize">
                  {nomeMes(l.mes)}
                  {parciais.has(l.mes) && <span className="ml-2 rounded-full bg-evaldo-amarelo px-2 text-xs font-bold normal-case text-evaldo-azul-escuro">parcial</span>}
                </td>
                <td className="num font-bold">{l.d ? num(l.d.qtde) : <span className="text-gray-400">sem venda</span>}</td>
                <td className="num">{l.d ? num(l.d.qtdeBalcao) : '—'}</td>
                <td className="num">{l.d ? num(l.d.qtdeOficina) : '—'}</td>
                {temValor && <td className="num">{l.d ? reais(l.d.valor) : '—'}</td>}
                {temValor && <td className="num">{l.d && l.d.qtde > 0 ? reais(l.d.valor / l.d.qtde) : '—'}</td>}
                <td className="num">{l.anterior != null ? <DiferencaMedida valor={l.valor - l.anterior} medida={medida} /> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
