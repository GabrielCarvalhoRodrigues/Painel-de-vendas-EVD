import { useMemo, useState } from 'react';
import { Seta, Titulo } from '../componentes/Comuns';
import { Th, useOrdenacao } from '../componentes/Ordenacao';
import { AvisosProdutos, CANAIS, ComProdutos, FiltrosProdutos, LinkProduto } from '../componentes/ProdutosComuns';
import { TODOS, usePainel } from '../estado/PainelContext';
import { useProdutos } from '../estado/ProdutosContext';
import { variacao } from '../regras/analise';
import { medidaDe } from '../regras/produtos';
import { exportarExcel } from '../utils/exportar';
import { int, num, reais } from '../utils/formato';
import { nomeMes, nomeMesCurto } from '../utils/meses';

interface Linha {
  posicao: number;
  codigo: string;
  nome: string;
  qtde: number;
  qtdeBalcao: number;
  qtdeOficina: number;
  valor: number;
  variacao: number | null;
}

const VALORES = {
  posicao: (l: Linha) => l.posicao,
  codigo: (l: Linha) => l.codigo,
  nome: (l: Linha) => l.nome,
  qtde: (l: Linha) => l.qtde,
  qtdeBalcao: (l: Linha) => l.qtdeBalcao,
  qtdeOficina: (l: Linha) => l.qtdeOficina,
  valor: (l: Linha) => l.valor,
  variacao: (l: Linha) => l.variacao,
};

export function Produtos() {
  return <ComProdutos>{() => <Conteudo />}</ComProdutos>;
}

function Conteudo() {
  const { vendedorSel, vendedores } = usePainel();
  const { analise, canal, temValor } = useProdutos();
  const { mesRef, mesAnt, produtos, medida } = analise!;
  const [busca, setBusca] = useState('');

  // Produtos do mês (o filtro de canal já foi aplicado na análise), na ordem da medida escolhida.
  const linhas = useMemo<Linha[]>(
    () =>
      produtos
        .map((p) => ({ p, d: p.porMes.get(mesRef) }))
        .filter(({ d }) => d && (Math.abs(d.qtde) > 0.0001 || Math.abs(d.valor) > 0.005))
        .sort((a, b) => medidaDe(b.d, medida) - medidaDe(a.d, medida) || a.p.nome.localeCompare(b.p.nome, 'pt-BR'))
        .map(({ p, d }, i) => ({
          posicao: i + 1,
          codigo: p.codigo,
          nome: p.nome,
          qtde: d!.qtde,
          qtdeBalcao: d!.qtdeBalcao,
          qtdeOficina: d!.qtdeOficina,
          valor: d!.valor,
          variacao: variacao(p.noMes, p.anterior),
        })),
    [produtos, mesRef, medida],
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return linhas;
    return linhas.filter((p) => p.nome.toLowerCase().includes(termo) || p.codigo.toLowerCase().includes(termo));
  }, [linhas, busca]);

  const { ordenada, ordem, alternar } = useOrdenacao(filtrados, VALORES, { campo: 'posicao', desc: false });

  const mostrarCanais = canal === '';
  const nomeCanal = CANAIS.find((c) => c.id === canal)!.nome;
  const soma = (f: (l: Linha) => number) => filtrados.reduce((s, l) => s + f(l), 0);

  function exportar() {
    const vendedor = vendedorSel === TODOS ? 'todos' : (vendedores.find((v) => v.codigo === vendedorSel)?.nome ?? vendedorSel);
    exportarExcel(
      `produtos-${canal || 'todos'}-${vendedor.toLowerCase().replace(/\s+/g, '-')}-${mesRef}.xlsx`,
      `${nomeCanal} ${nomeMesCurto(mesRef)}`.slice(0, 31),
      ordenada.map((l) => ({
        Posição: l.posicao,
        Código: l.codigo,
        Produto: l.nome,
        Quantidade: Math.round(l.qtde * 1000) / 1000,
        ...(mostrarCanais ? { 'Qtd. balcão': Math.round(l.qtdeBalcao * 1000) / 1000, 'Qtd. oficina': Math.round(l.qtdeOficina * 1000) / 1000 } : {}),
        ...(temValor ? { 'Valor total': Math.round(l.valor * 100) / 100 } : {}),
        [`Variação vs ${nomeMesCurto(mesAnt)} (%)`]: l.variacao != null ? Math.round(l.variacao * 1000) / 10 : null,
      })),
    );
  }

  const props = { ordem, alternar };

  return (
    <div>
      <Titulo titulo="Produtos do mês" subtitulo={<span className="capitalize">{nomeMes(mesRef)}</span>}>
        <FiltrosProdutos />
      </Titulo>
      <AvisosProdutos />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="w-full sm:w-72">
          <span className="rotulo">Buscar produto</span>
          <input className="campo w-full" placeholder="Descrição ou código" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <button className="btn-secundario ml-auto" onClick={exportar} disabled={!ordenada.length}>
          ⤓ Exportar Excel
        </button>
      </div>

      {ordenada.length === 0 ? (
        <p className="card px-4 py-8 text-center text-sm text-gray-500">Nenhum produto encontrado com esse filtro.</p>
      ) : (
        <div className="card overflow-x-auto p-2">
          <table className="tabela">
            <thead>
              <tr>
                <Th campo="posicao" {...props}>Pos.</Th>
                <Th campo="codigo" {...props}>Código</Th>
                <Th campo="nome" {...props}>Produto</Th>
                <Th campo="qtde" num {...props}>Quantidade</Th>
                {mostrarCanais && (
                  <>
                    <Th campo="qtdeBalcao" num {...props}>Balcão</Th>
                    <Th campo="qtdeOficina" num {...props}>Oficina</Th>
                  </>
                )}
                {temValor && (
                  <Th campo="valor" num {...props}>Valor total</Th>
                )}
                <Th campo="variacao" num {...props}>vs {nomeMesCurto(mesAnt)}</Th>
              </tr>
            </thead>
            <tbody>
              {ordenada.map((l) => (
                <tr key={l.codigo}>
                  <td className="text-gray-500">{l.posicao}º</td>
                  <td className="text-gray-500">{l.codigo}</td>
                  <td>
                    <LinkProduto codigo={l.codigo} nome={l.nome} />
                  </td>
                  <td className="num font-bold">{num(l.qtde)}</td>
                  {mostrarCanais && (
                    <>
                      <td className="num">{num(l.qtdeBalcao)}</td>
                      <td className="num">{num(l.qtdeOficina)}</td>
                    </>
                  )}
                  {temValor && <td className="num">{reais(l.valor)}</td>}
                  <td className="num">
                    <Seta variacao={l.variacao} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Total ({int(filtrados.length)} produtos)</td>
                <td className="num">{num(soma((l) => l.qtde))}</td>
                {mostrarCanais && (
                  <>
                    <td className="num">{num(soma((l) => l.qtdeBalcao))}</td>
                    <td className="num">{num(soma((l) => l.qtdeOficina))}</td>
                  </>
                )}
                {temValor && <td className="num">{reais(soma((l) => l.valor))}</td>}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
