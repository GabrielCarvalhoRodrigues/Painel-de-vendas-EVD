import { Fragment, useMemo, useState } from 'react';
import { LinkCliente, SemDados, Titulo, Valor } from '../componentes/Comuns';
import { ContatoCliente, NOME_STATUS } from '../componentes/ContatoCliente';
import { AvisosMes, Filtros } from '../componentes/Filtros';
import { usePainel, useVendedorDoCliente } from '../estado/PainelContext';
import type { StatusContato } from '../tipos';
import { reais } from '../utils/formato';
import { nomeMes, nomeMesCurto } from '../utils/meses';

function tempoSemComprar(meses: number | null, dias: number | null): string {
  if (meses == null) return '—';
  const m = `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  return dias != null ? `${m} (~${dias} dias)` : m;
}

export function DeixaramDeComprar() {
  const { analise, carregando, clientes } = usePainel();
  const vendedorDoCliente = useVendedorDoCliente();
  const [soDoMes, setSoDoMes] = useState(false);
  const [status, setStatus] = useState<StatusContato | ''>('');
  const [busca, setBusca] = useState('');

  const lista = useMemo(() => {
    if (!analise) return [];
    return analise.clientes
      .filter((c) => c.situacao === 'deixou' && !c.balcao)
      .sort((a, b) => b.totalPeriodo - a.totalPeriodo);
  }, [analise]);

  if (carregando) return null;
  if (!analise) return <SemDados />;

  const { mesRef, mesAnt, meses } = analise;
  const termo = busca.trim().toLowerCase();
  const filtrada = lista.filter(
    (c) =>
      (!soDoMes || c.parouNoMes) &&
      (!status || (clientes.get(c.codigo)?.statusContato ?? 'nao_contatado') === status) &&
      (!termo || c.nome.toLowerCase().includes(termo) || c.codigo.includes(termo)),
  );
  const pararamNoMes = lista.filter((c) => c.parouNoMes).length;
  const potencial = filtrada.reduce((s, c) => s + (c.mediaAnteriores ?? 0), 0);
  const colunas = meses.length + 5;

  return (
    <div>
      <Titulo
        titulo="Deixaram de comprar"
        subtitulo={`Compraram em 2 meses ou mais e não compraram em ${nomeMes(mesRef)}. Ordenados por quanto compravam.`}
      >
        <Filtros />
      </Titulo>
      <AvisosMes />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <div className="card-indicador border-t-evaldo-vermelho p-4">
          <div className="text-xs font-semibold uppercase text-gray-500">Clientes perdidos</div>
          <div className="text-3xl font-extrabold text-evaldo-vermelho">{lista.length}</div>
        </div>
        <div className="card-indicador p-4">
          <div className="text-xs font-semibold uppercase text-gray-500">Pararam em {nomeMesCurto(mesRef)}</div>
          <div className="text-3xl font-extrabold text-evaldo-azul-escuro">{pararamNoMes}</div>
          <div className="text-xs text-gray-500">Compraram em {nomeMesCurto(mesAnt)} e não em {nomeMesCurto(mesRef)}</div>
        </div>
        <div className="card-indicador p-4">
          <div className="text-xs font-semibold uppercase text-gray-500">Venda mensal em risco</div>
          <div className="text-3xl font-extrabold text-evaldo-azul-escuro">{reais(potencial)}</div>
          <div className="text-xs text-gray-500">Soma da média mensal dos clientes listados</div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="w-full sm:w-64">
          <span className="rotulo">Buscar cliente</span>
          <input className="campo w-full" placeholder="Nome ou código" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <label>
          <span className="rotulo">Status do contato</span>
          <select className="campo" value={status} onChange={(e) => setStatus(e.target.value as StatusContato | '')}>
            <option value="">Todos</option>
            {Object.entries(NOME_STATUS).map(([id, n]) => (
              <option key={id} value={id}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm font-semibold text-evaldo-azul-escuro">
          <input type="checkbox" className="h-4 w-4 accent-evaldo-azul" checked={soDoMes} onChange={(e) => setSoDoMes(e.target.checked)} />
          Só quem parou em {nomeMesCurto(mesRef)}
        </label>
      </div>

      {lista.length === 0 ? (
        <p className="card px-4 py-8 text-center text-sm text-gray-500">
          🎉 Nenhum cliente deixou de comprar em {nomeMes(mesRef)}. (Para aparecer aqui, o cliente precisa ter comprado em pelo menos 2 meses importados.)
        </p>
      ) : filtrada.length === 0 ? (
        <p className="card px-4 py-8 text-center text-sm text-gray-500">Nenhum cliente com esse filtro.</p>
      ) : (
        <div className="card overflow-x-auto p-2">
          <table className="tabela">
            <thead>
              <tr>
                <th>Cliente</th>
                {meses.map((m) => (
                  <th key={m} className="text-right">
                    {nomeMesCurto(m)}
                  </th>
                ))}
                <th className="text-right">Média mensal</th>
                <th>Última compra</th>
                <th>Sem comprar há</th>
                <th className="text-right">Total do período</th>
              </tr>
            </thead>
            <tbody>
              {filtrada.map((c) => (
                <Fragment key={c.codigo}>
                  <tr className="!bg-evaldo-vermelho-claro">
                    <td className="border-l-4 border-l-evaldo-vermelho">
                      <LinkCliente codigo={c.codigo} nome={c.nome} />
                      <div className="text-xs text-gray-500">
                        {c.codigo}
                        {c.parouNoMes && <span className="ml-2 font-semibold text-evaldo-vermelho">parou em {nomeMesCurto(mesRef)}</span>}
                      </div>
                    </td>
                    {meses.map((m) => {
                      const v = c.porMes.get(m)?.valorTotal;
                      return (
                        <td key={m} className="num">
                          {v == null ? <span className="text-gray-400">—</span> : <Valor valor={v} />}
                        </td>
                      );
                    })}
                    <td className="num font-semibold">{c.mediaAnteriores != null ? reais(c.mediaAnteriores) : '—'}</td>
                    <td className="capitalize">{c.ultimaCompra ? nomeMes(c.ultimaCompra) : '—'}</td>
                    <td className="font-semibold text-evaldo-vermelho">{tempoSemComprar(c.mesesSemComprar, c.diasSemComprar)}</td>
                    <td className="num font-bold">{reais(c.totalPeriodo)}</td>
                  </tr>
                  <tr className="!bg-white">
                    <td colSpan={colunas} className="!whitespace-normal pb-4">
                      <ContatoCliente codigo={c.codigo} nome={c.nome} vendedor={vendedorDoCliente(c.codigo)} compacto />
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
