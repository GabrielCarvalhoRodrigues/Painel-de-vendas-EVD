import { useState } from 'react';
import { Titulo } from '../componentes/Comuns';
import { AvisosProdutos, ComProdutos, FiltrosProdutos, formatarMedida, LinkProduto, NOME_MEDIDA } from '../componentes/ProdutosComuns';
import { useProdutos } from '../estado/ProdutosContext';
import { medidaDe } from '../regras/produtos';
import { exportarExcel } from '../utils/exportar';
import { num, reais } from '../utils/formato';
import { nomeMes, nomeMesCurto } from '../utils/meses';

function tempoSemVender(meses: number | null): string {
  if (meses == null) return '—';
  return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
}

export function ProdutosPararam() {
  return <ComProdutos>{() => <Conteudo />}</ComProdutos>;
}

function Conteudo() {
  const { analise, temValor } = useProdutos();
  const { mesRef, mesAnt, meses, produtos, medida } = analise!;
  const [soDoMes, setSoDoMes] = useState(false);
  const [busca, setBusca] = useState('');

  const lista = produtos.filter((p) => p.situacao === 'deixou').sort((a, b) => (b.mediaAnteriores ?? 0) - (a.mediaAnteriores ?? 0));
  const termo = busca.trim().toLowerCase();
  const filtrada = lista.filter((p) => (!soDoMes || p.parouNoMes) && (!termo || p.nome.toLowerCase().includes(termo) || p.codigo.toLowerCase().includes(termo)));
  const pararamNoMes = lista.filter((p) => p.parouNoMes).length;
  const emRisco = filtrada.reduce((s, p) => s + (p.mediaAnteriores ?? 0), 0);
  const mesesAte = meses.filter((m) => m <= mesRef);

  function exportar() {
    exportarExcel(
      `produtos-pararam-${mesRef}.xlsx`,
      `Pararam ${nomeMesCurto(mesRef)}`,
      filtrada.map((p) => ({
        Código: p.codigo,
        Produto: p.nome,
        ...Object.fromEntries(mesesAte.map((m) => [nomeMesCurto(m), Math.round(medidaDe(p.porMes.get(m), medida) * 100) / 100])),
        [`Média mensal (${NOME_MEDIDA[medida].toLowerCase()})`]: Math.round((p.mediaAnteriores ?? 0) * 100) / 100,
        'Última venda': p.ultimaVenda ? nomeMes(p.ultimaVenda) : '',
        'Meses sem vender': p.mesesSemVender ?? '',
      })),
    );
  }

  return (
    <div>
      <Titulo titulo="Produtos que pararam de vender" subtitulo={`Venderam em 2 meses ou mais e não venderam em ${nomeMes(mesRef)}. Ordenados pela média mensal.`}>
        <FiltrosProdutos />
      </Titulo>
      <AvisosProdutos />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <div className="card-indicador border-t-evaldo-vermelho p-4">
          <div className="text-xs font-semibold uppercase text-gray-500">Produtos parados</div>
          <div className="text-3xl font-extrabold text-evaldo-vermelho">{lista.length}</div>
        </div>
        <div className="card-indicador p-4">
          <div className="text-xs font-semibold uppercase text-gray-500">Pararam em {nomeMesCurto(mesRef)}</div>
          <div className="text-3xl font-extrabold text-evaldo-azul-escuro">{pararamNoMes}</div>
          <div className="text-xs text-gray-500">
            Venderam em {nomeMesCurto(mesAnt)} e não em {nomeMesCurto(mesRef)}
          </div>
        </div>
        <div className="card-indicador p-4">
          <div className="text-xs font-semibold uppercase text-gray-500">{medida === 'valor' ? 'Venda mensal em risco' : 'Itens por mês em risco'}</div>
          <div className="text-3xl font-extrabold text-evaldo-azul-escuro">{medida === 'valor' ? reais(emRisco) : num(emRisco)}</div>
          <div className="text-xs text-gray-500">Soma da média mensal dos produtos listados</div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="w-full sm:w-72">
          <span className="rotulo">Buscar produto</span>
          <input className="campo w-full" placeholder="Descrição ou código" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm font-semibold text-evaldo-azul-escuro">
          <input type="checkbox" className="h-4 w-4 accent-evaldo-azul" checked={soDoMes} onChange={(e) => setSoDoMes(e.target.checked)} />
          Só os que pararam em {nomeMesCurto(mesRef)}
        </label>
        <button className="btn-secundario ml-auto" onClick={exportar} disabled={!filtrada.length}>
          ⤓ Exportar Excel
        </button>
      </div>

      {lista.length === 0 ? (
        <p className="card px-4 py-8 text-center text-sm text-gray-500">
          🎉 Nenhum produto parou de vender em {nomeMes(mesRef)}. (Para aparecer aqui, o produto precisa ter vendido em pelo menos 2 meses importados.)
        </p>
      ) : filtrada.length === 0 ? (
        <p className="card px-4 py-8 text-center text-sm text-gray-500">Nenhum produto com esse filtro.</p>
      ) : (
        <div className="card overflow-x-auto p-2">
          <table className="tabela">
            <thead>
              <tr>
                <th>Produto</th>
                {mesesAte.map((m) => (
                  <th key={m} className="text-right">
                    {nomeMesCurto(m)}
                  </th>
                ))}
                <th className="text-right">Média mensal</th>
                <th>Última venda</th>
                <th>Sem vender há</th>
                {temValor && medida === 'qtde' && <th className="text-right">Valor no período</th>}
              </tr>
            </thead>
            <tbody>
              {filtrada.map((p) => (
                <tr key={p.codigo} className="!bg-evaldo-vermelho-claro">
                  <td className="border-l-4 border-l-evaldo-vermelho">
                    <LinkProduto codigo={p.codigo} nome={p.nome} />
                    <div className="text-xs text-gray-500">
                      {p.codigo}
                      {p.parouNoMes && <span className="ml-2 font-semibold text-evaldo-vermelho">parou em {nomeMesCurto(mesRef)}</span>}
                    </div>
                  </td>
                  {mesesAte.map((m) => {
                    const v = p.porMes.get(m);
                    return (
                      <td key={m} className="num">
                        {v == null ? <span className="text-gray-400">—</span> : formatarMedida(medidaDe(v, medida), medida)}
                      </td>
                    );
                  })}
                  <td className="num font-semibold">{p.mediaAnteriores != null ? formatarMedida(p.mediaAnteriores, medida) : '—'}</td>
                  <td className="capitalize">{p.ultimaVenda ? nomeMes(p.ultimaVenda) : '—'}</td>
                  <td className="font-semibold text-evaldo-vermelho">{tempoSemVender(p.mesesSemVender)}</td>
                  {temValor && medida === 'qtde' && <td className="num">{reais(p.totalValor)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
