import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Medalha, TelaVazia, Titulo } from '../componentes/Comuns';
import { LinkProduto } from '../componentes/ProdutosComuns';
import { TODOS, usePainel } from '../estado/PainelContext';
import { useProdutos } from '../estado/ProdutosContext';
import { modelosAtendidos, nomeModelo, produtosMaisAplicados, resumoPorVeiculo } from '../regras/veiculos';
import { exportarExcel } from '../utils/exportar';
import { dataBR, int, num, porcento, reais } from '../utils/formato';
import { nomeMes } from '../utils/meses';

const TODOS_MESES = '';
const QTD_TOP = 30;

/** Veículos atendidos (pedidos com placa): top de produtos aplicados, filtrado por marca e modelo. */
export function Veiculos() {
  const { vendedores, vendedorSel, setVendedorSel, carregando: carregandoPainel } = usePainel();
  const { carregando, erro, erroVeiculos, recarregar, veiculos, relatorios } = useProdutos();
  const [mes, setMes] = useState(TODOS_MESES);
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [busca, setBusca] = useState('');
  const [verTodos, setVerTodos] = useState(false);

  const doVendedor = useMemo(
    () => (vendedorSel === TODOS ? veiculos : veiculos.filter((v) => v.vendedorCodigo === vendedorSel)),
    [veiculos, vendedorSel],
  );
  const meses = useMemo(() => [...new Set(doVendedor.map((v) => v.mes))].sort().reverse(), [doVendedor]);
  const doMes = useMemo(() => (mes ? doVendedor.filter((v) => v.mes === mes) : doVendedor), [doVendedor, mes]);
  const marcas = useMemo(() => [...new Set(doMes.map((v) => v.marca))].sort(), [doMes]);
  const daMarca = useMemo(() => (marca ? doMes.filter((v) => v.marca === marca) : doMes), [doMes, marca]);
  const modelos = useMemo(() => modelosAtendidos(daMarca), [daMarca]);
  const doModelo = useMemo(() => (modelo ? daMarca.filter((v) => v.modelo === modelo) : daMarca), [daMarca, modelo]);
  const filtrados = useMemo(() => {
    const t = busca.trim().toUpperCase().replace(/-/g, '');
    if (!t) return doModelo;
    return doModelo.filter((v) => v.placa.includes(t) || v.clienteNome.toUpperCase().includes(busca.trim().toUpperCase()));
  }, [doModelo, busca]);

  const top = useMemo(() => produtosMaisAplicados(filtrados), [filtrados]);
  const lista = useMemo(() => resumoPorVeiculo(filtrados), [filtrados]);
  const totalVeiculos = lista.length;
  const temValor = filtrados.some((v) => v.valorTotal !== 0);

  if (erro) {
    return (
      <TelaVazia
        titulo="Não foi possível carregar os veículos"
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
        Carregando veículos…
      </div>
    );
  }
  if (erroVeiculos) {
    return (
      <TelaVazia
        titulo="A aba Veículos ainda não está ativa no banco"
        texto={`Aplique a migration 20261113000005_veiculos.sql no Supabase (SQL Editor) e importe de novo o relatório de produtos. Detalhe: ${erroVeiculos}`}
        acao={
          <button className="btn-primario" onClick={recarregar}>
            Tentar novamente
          </button>
        }
      />
    );
  }
  if (!veiculos.length) {
    return (
      <TelaVazia
        titulo="Nenhum veículo com placa ainda"
        texto={
          relatorios.length
            ? 'Os relatórios de produtos importados antes desta aba não têm os veículos. Importe de novo o relatório de produtos do mês (o mesmo CSV) para preencher.'
            : 'Importe o relatório de produtos vendidos: os pedidos com placa aparecem aqui.'
        }
        acao={
          <Link to="/importar-produtos" className="btn-primario">
            Importar produtos
          </Link>
        }
      />
    );
  }

  const filtroTexto = [marca && !modelo ? marca : '', modelo ? nomeModelo(modelo) : '', mes ? nomeMes(mes) : 'todos os meses'].filter(Boolean).join(' · ');

  function exportarTop() {
    exportarExcel(
      `produtos-veiculos-${(modelo || marca || 'todos').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${mes || 'todos'}.xlsx`,
      'Produtos por veículo',
      top.map((p, i) => ({
        Posição: i + 1,
        Código: p.codigo,
        Produto: p.nome,
        Veículos: p.veiculos,
        '% dos veículos': totalVeiculos ? Math.round((p.veiculos / totalVeiculos) * 1000) / 10 : null,
        Quantidade: Math.round(p.qtde * 1000) / 1000,
        ...(temValor ? { 'Valor total': Math.round(p.valor * 100) / 100 } : {}),
      })),
    );
  }

  function exportarVeiculos() {
    exportarExcel(
      `veiculos-${(modelo || marca || 'todos').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${mes || 'todos'}.xlsx`,
      'Veículos',
      lista.map((v) => ({
        Placa: v.placaTexto,
        Veículo: v.veiculo,
        Modelo: v.modelo,
        Ano: v.ano,
        KM: v.km,
        Cliente: v.clienteNome,
        Telefone: v.clienteTelefone,
        'Última venda': v.ultimaData ? dataBR(v.ultimaData) : null,
        Pedidos: v.pedidos,
        Itens: Math.round(v.qtde * 1000) / 1000,
        ...(temValor ? { 'Valor total': Math.round(v.valor * 100) / 100 } : {}),
        Produtos: v.produtos.map((p) => `${num(p.qtde)}x ${p.nome}`).join('; '),
      })),
    );
  }

  const topVisivel = verTodos ? top : top.slice(0, QTD_TOP);

  return (
    <div>
      <Titulo titulo="Veículos" subtitulo={`Produtos mais aplicados nos carros (pedidos com placa) · ${filtroTexto}`}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[160px] flex-1 sm:flex-none">
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
          <label className="min-w-[150px] flex-1 sm:flex-none">
            <span className="rotulo">Mês</span>
            <select className="campo w-full capitalize" value={mes} onChange={(e) => setMes(e.target.value)}>
              <option value={TODOS_MESES}>Todos os meses</option>
              {meses.map((m) => (
                <option key={m} value={m}>
                  {nomeMes(m)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Titulo>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="min-w-[160px] flex-1 sm:flex-none">
          <span className="rotulo">Marca</span>
          <select
            className="campo w-full"
            value={marca}
            onChange={(e) => {
              setMarca(e.target.value);
              setModelo('');
            }}
          >
            <option value="">Todas</option>
            {marcas.map((m) => (
              <option key={m} value={m}>
                {m || '(sem descrição)'}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[220px] flex-1 sm:flex-none">
          <span className="rotulo">Carro (modelo)</span>
          <select className="campo w-full" value={modelo} onChange={(e) => setModelo(e.target.value)}>
            <option value="">Todos</option>
            {modelos.map((m) => (
              <option key={`${m.marca}|${m.modelo}`} value={m.modelo}>
                {nomeModelo(m.modelo)} ({int(m.veiculos)})
              </option>
            ))}
          </select>
        </label>
        <label className="w-full sm:w-60">
          <span className="rotulo">Placa ou cliente</span>
          <input className="campo w-full" placeholder="Ex.: QWS2F81" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        {(marca || modelo || busca) && (
          <button
            className="btn-secundario"
            onClick={() => {
              setMarca('');
              setModelo('');
              setBusca('');
            }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Indicador nome="Veículos" valor={int(totalVeiculos)} />
        <Indicador nome="Modelos" valor={int(new Set(filtrados.map((v) => `${v.marca}|${v.modelo}`)).size)} />
        <Indicador nome="Itens aplicados" valor={num(filtrados.reduce((s, v) => s + v.qtde, 0))} />
        {temValor ? (
          <Indicador nome="Valor" valor={reais(filtrados.reduce((s, v) => s + v.valorTotal, 0))} />
        ) : (
          <Indicador nome="Produtos diferentes" valor={int(top.length)} />
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="card p-2">
          <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-2 pt-1">
            <h2 className="text-lg">Top produtos aplicados {modelo ? `no ${nomeModelo(modelo)}` : marca ? `em ${marca}` : ''}</h2>
            <button className="btn-secundario px-3 py-1 text-xs" onClick={exportarTop} disabled={!top.length}>
              ⤓ Exportar Excel
            </button>
          </div>
          {top.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-500">Nenhum produto com esse filtro.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Pos.</th>
                    <th>Produto</th>
                    <th className="text-right" title="Em quantos veículos diferentes o produto foi aplicado">
                      Veículos
                    </th>
                    <th className="text-right">% dos veículos</th>
                    <th className="text-right">Qtde</th>
                    {temValor && <th className="text-right">Valor</th>}
                  </tr>
                </thead>
                <tbody>
                  {topVisivel.map((p, i) => (
                    <tr key={p.codigo}>
                      <td>
                        <Medalha posicao={i + 1} />
                      </td>
                      <td>
                        <LinkProduto codigo={p.codigo} nome={p.nome} />
                        <span className="block text-xs text-gray-500">{p.codigo}</span>
                      </td>
                      <td className="num font-bold">{int(p.veiculos)}</td>
                      <td className="num">
                        <Barra fracao={totalVeiculos ? p.veiculos / totalVeiculos : 0} />
                      </td>
                      <td className="num">{num(p.qtde)}</td>
                      {temValor && <td className="num">{reais(p.valor)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
              {top.length > QTD_TOP && (
                <div className="px-2 py-2 text-center">
                  <button className="text-sm font-semibold text-evaldo-azul underline" onClick={() => setVerTodos((v) => !v)}>
                    {verTodos ? `Mostrar só os ${QTD_TOP} primeiros` : `Ver todos os ${int(top.length)} produtos`}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="card p-2">
          <h2 className="px-2 pb-2 pt-1 text-lg">Carros mais atendidos</h2>
          <div className="max-h-[560px] overflow-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Modelo</th>
                  <th className="text-right">Veículos</th>
                  <th className="text-right">Itens</th>
                </tr>
              </thead>
              <tbody>
                {modelos.map((m) => (
                  <tr key={`${m.marca}|${m.modelo}`} className={modelo === m.modelo ? 'bg-evaldo-amarelo-claro' : ''}>
                    <td>
                      <button
                        className="text-left font-semibold text-evaldo-azul-escuro hover:text-evaldo-azul hover:underline"
                        onClick={() => setModelo(modelo === m.modelo ? '' : m.modelo)}
                        title="Filtrar o top de produtos por este carro"
                      >
                        {nomeModelo(m.modelo)}
                      </button>
                    </td>
                    <td className="num">{int(m.veiculos)}</td>
                    <td className="num">{num(m.qtde)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="card mt-5 p-2">
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-2 pt-1">
          <h2 className="text-lg">Veículos ({int(lista.length)})</h2>
          <button className="btn-secundario px-3 py-1 text-xs" onClick={exportarVeiculos} disabled={!lista.length}>
            ⤓ Exportar Excel
          </button>
        </div>
        <div className="max-h-[600px] overflow-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Placa</th>
                <th>Veículo</th>
                <th className="text-right">KM</th>
                <th>Cliente</th>
                <th>Última venda</th>
                <th>Produtos</th>
                <th className="text-right">Itens</th>
                {temValor && <th className="text-right">Valor</th>}
              </tr>
            </thead>
            <tbody>
              {lista.map((v) => (
                <tr key={v.placa}>
                  <td className="whitespace-nowrap font-bold">{v.placaTexto}</td>
                  <td>{v.veiculo || '—'}</td>
                  <td className="num">{v.km != null ? int(v.km) : '—'}</td>
                  <td>
                    {v.clienteNome || '—'}
                    {v.clienteTelefone && <span className="block text-xs text-gray-500">{v.clienteTelefone}</span>}
                  </td>
                  <td className="whitespace-nowrap">{v.ultimaData ? dataBR(v.ultimaData) : '—'}</td>
                  <td className="min-w-[220px] text-xs text-gray-600">
                    {v.produtos.slice(0, 4).map((p) => `${num(p.qtde)}x ${p.nome}`).join(' · ')}
                    {v.produtos.length > 4 && <span title={v.produtos.map((p) => `${num(p.qtde)}x ${p.nome}`).join('\n')}> · +{v.produtos.length - 4}</span>}
                  </td>
                  <td className="num">{num(v.qtde)}</td>
                  {temValor && <td className="num">{reais(v.valor)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Indicador({ nome, valor }: { nome: string; valor: string }) {
  return (
    <div className="card-indicador p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{nome}</div>
      <div className="mt-1 text-xl font-extrabold text-evaldo-azul-escuro">{valor}</div>
    </div>
  );
}

function Barra({ fracao }: { fracao: number }) {
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="hidden h-2 w-16 overflow-hidden rounded-full bg-gray-100 sm:inline-block">
        <span className="block h-full rounded-full bg-evaldo-azul" style={{ width: `${Math.min(100, fracao * 100)}%` }} />
      </span>
      {porcento(fracao)}
    </span>
  );
}
