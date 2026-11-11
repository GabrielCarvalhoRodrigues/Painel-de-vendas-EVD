import { useEffect, useMemo, useState } from 'react';
import { ModalCardWhatsApp, type DadosCard } from '../componentes/CardWhatsApp';
import { SemDados, Titulo } from '../componentes/Comuns';
import { usePainel } from '../estado/PainelContext';
import { numeroBR } from '../importacao/numeros';
import { analisar, comprou } from '../regras/analise';
import { metaDoMes } from '../regras/metas';
import type { Mes } from '../tipos';
import { int, num, porcento, reais } from '../utils/formato';
import { nomeMes } from '../utils/meses';

function Progresso({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-xs text-gray-400">sem meta</span>;
  const bateu = pct >= 1;
  return (
    <div className="min-w-[140px]">
      <div className="flex justify-between text-xs font-bold">
        <span className={bateu ? 'text-evaldo-azul' : 'text-evaldo-azul-escuro'}>{porcento(pct)}</span>
        {bateu && <span className="text-evaldo-azul">★ Meta batida</span>}
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-evaldo-azul-claro">
        <div className={`h-full rounded-full ${bateu ? 'bg-evaldo-azul' : 'bg-evaldo-amarelo'}`} style={{ width: `${Math.min(100, pct * 100)}%` }} />
      </div>
    </div>
  );
}

function CampoMeta({ valor, herdada, salvar }: { valor: number | null; herdada: boolean; salvar: (v: number | null) => void }) {
  const [texto, setTexto] = useState(valor != null ? num(valor) : '');
  useEffect(() => setTexto(valor != null ? num(valor) : ''), [valor]);
  return (
    <div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500">R$</span>
        <input
          className={`campo w-32 text-right ${herdada ? 'text-gray-500' : 'font-semibold'}`}
          inputMode="decimal"
          placeholder="0,00"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => {
            const n = texto.trim() === '' ? null : numeroBR(texto);
            if (n != null && (Number.isNaN(n) || n < 0)) {
              setTexto(valor != null ? num(valor) : '');
              return;
            }
            if (n !== valor) salvar(n);
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </div>
      {herdada && <div className="mt-0.5 text-[11px] text-gray-400">mesma do mês anterior</div>}
    </div>
  );
}

function CampoNome({ nome, salvar }: { nome: string; salvar: (n: string) => void }) {
  const [texto, setTexto] = useState(nome);
  useEffect(() => setTexto(nome), [nome]);
  return (
    <input
      className="w-full min-w-[200px] rounded border border-transparent bg-transparent px-1 py-0.5 font-bold text-evaldo-azul-escuro hover:border-gray-300 focus:border-evaldo-azul focus:bg-white focus:outline-none"
      value={texto}
      title="Clique para editar o nome"
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => {
        const t = texto.trim().toUpperCase();
        if (t && t !== nome) salvar(t);
        else setTexto(nome);
      }}
    />
  );
}

export function Vendedores() {
  const { relatorios, vendas, vendedores, metas, salvarMeta, renomearVendedor, carregando } = usePainel();
  const mesesTodos = useMemo(() => [...new Set(relatorios.map((r) => r.mes))].sort(), [relatorios]);
  const [mesEscolhido, setMes] = useState<Mes | null>(null);
  const mes = mesEscolhido && mesesTodos.includes(mesEscolhido) ? mesEscolhido : (mesesTodos.at(-1) ?? null);
  const [card, setCard] = useState<DadosCard | null>(null);

  const linhas = useMemo(() => {
    if (!mes) return [];
    return vendedores.map((v) => {
      const rels = relatorios.filter((r) => r.vendedorCodigo === v.codigo);
      const relMes = rels.find((r) => r.mes === mes);
      const meta = metaDoMes(metas, v.codigo, mes);
      if (!relMes) return { v, relMes, meta, analise: null };
      const meses = rels.map((r) => r.mes);
      const parciais = new Set(rels.filter((r) => r.parcial).map((r) => r.mes));
      const analise = analisar(
        vendas.filter((x) => x.vendedorCodigo === v.codigo),
        meses,
        parciais,
        mes,
        relMes.dataFinal,
      );
      return { v, relMes, meta, analise };
    });
  }, [mes, vendedores, relatorios, vendas, metas]);

  if (carregando) return null;
  if (!mes) return <SemDados />;

  const parcial = relatorios.some((r) => r.mes === mes && r.parcial);

  return (
    <div>
      <Titulo titulo="Vendedores e metas" subtitulo="Os vendedores entram automaticamente pelos relatórios importados. Clique no nome para editar.">
        <label className="min-w-[180px]">
          <span className="rotulo">Mês</span>
          <select className="campo w-full capitalize" value={mes} onChange={(e) => setMes(e.target.value)}>
            {[...mesesTodos].reverse().map((m) => (
              <option key={m} value={m}>
                {nomeMes(m)}
                {relatorios.some((r) => r.mes === m && r.parcial) ? ' (parcial)' : ''}
              </option>
            ))}
          </select>
        </label>
      </Titulo>

      {parcial && (
        <div className="mb-5 rounded-lg border-l-4 border-evaldo-amarelo bg-evaldo-amarelo-claro px-4 py-3 text-sm text-evaldo-azul-escuro">
          ⚠ Mês parcial: os resultados de {nomeMes(mes)} ainda não estão fechados.
        </div>
      )}

      <div className="card overflow-x-auto p-2">
        <table className="tabela">
          <thead>
            <tr>
              <th>Vendedor</th>
              <th>Meta do mês</th>
              <th className="text-right">Faturamento</th>
              <th>% da meta</th>
              <th className="text-right">Markup</th>
              <th className="text-right">Cli. ativos</th>
              <th className="text-right">Cli. perdidos</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {linhas
              .slice()
              .sort((a, b) => (b.analise?.totais.get(mes)?.faturamento ?? -Infinity) - (a.analise?.totais.get(mes)?.faturamento ?? -Infinity))
              .map(({ v, relMes, meta, analise }) => {
                const t = analise?.totais.get(mes);
                const pct = t && meta?.valor ? t.faturamento / meta.valor : null;
                const ativos = analise?.clientes.filter((c) => comprou(c.valorAtual)).length ?? 0;
                const perdidos = analise?.clientes.filter((c) => c.situacao === 'deixou' && !c.balcao).length ?? 0;
                return (
                  <tr key={v.codigo}>
                    <td>
                      <div className="text-xs text-gray-500">{v.codigo}</div>
                      <CampoNome nome={v.nome} salvar={(n) => renomearVendedor(v.codigo, n)} />
                    </td>
                    <td>
                      <CampoMeta valor={meta?.valor ?? null} herdada={meta?.herdada ?? false} salvar={(n) => salvarMeta(v.codigo, mes, n)} />
                    </td>
                    {!t ? (
                      <td colSpan={5} className="text-sm text-gray-400">
                        Sem relatório de {nomeMes(mes)}
                      </td>
                    ) : (
                      <>
                        <td className="num font-bold">{reais(t.faturamento)}</td>
                        <td>
                          <Progresso pct={pct} />
                        </td>
                        <td className="num">{porcento(t.markup)}</td>
                        <td className="num">{int(ativos)}</td>
                        <td className={`num font-semibold ${perdidos ? 'text-evaldo-vermelho' : ''}`}>{int(perdidos)}</td>
                      </>
                    )}
                    <td>
                      <button
                        className="btn-whatsapp whitespace-nowrap px-3 py-1.5 text-xs"
                        disabled={!t}
                        onClick={() =>
                          t &&
                          analise &&
                          setCard({
                            vendedor: v.nome,
                            mes,
                            parcial: !!relMes?.parcial,
                            ate: relMes?.dataFinal,
                            meta: meta?.valor ?? null,
                            vendido: t.faturamento,
                            markup: t.markup,
                            devolucao: t.devolucao,
                            clientes: t.clientesCompraram,
                            top3: analise.clientes
                              .filter((c) => !c.balcao && comprou(c.valorAtual))
                              .sort((a, b) => b.valorAtual - a.valorAtual)
                              .slice(0, 3)
                              .map((c) => ({ nome: c.nome, valor: c.valorAtual })),
                          })
                        }
                      >
                        Card WhatsApp
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-gray-500">
        A meta vale para o mês escolhido e segue valendo nos meses seguintes até ser alterada. Clientes ativos: compraram no mês. Clientes perdidos: situação
        "Deixou de comprar".
      </p>

      {card && <ModalCardWhatsApp dados={card} fechar={() => setCard(null)} />}
    </div>
  );
}
