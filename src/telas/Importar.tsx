import { useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { Titulo } from '../componentes/Comuns';
import { ErroBanco, mensagemDeErro } from '../dados/erros';
import { buscarRelatorio, excluirRelatorio, importarRelatorio } from '../dados/repositorio';
import { usePainel } from '../estado/PainelContext';
import { ErroImportacao, lerRelatorio } from '../importacao/lerCsv';
import { lerRelatorioProdutos } from '../importacao/lerProdutos';
import type { Relatorio, RelatorioLido } from '../tipos';
import { dataBR, dataHoraBR, int, reais } from '../utils/formato';
import { nomeMes } from '../utils/meses';

interface Previa {
  chave: string;
  lido: RelatorioLido;
  existente?: Relatorio;
  /** Para relatórios que já existem: true = substituir, false = pular, undefined = ainda não respondeu. */
  substituir?: boolean;
}

async function ehRelatorioProdutos(arq: File): Promise<boolean> {
  try {
    lerRelatorioProdutos(await arq.arrayBuffer());
    return true;
  } catch {
    return false;
  }
}

interface Falha {
  arquivo: string;
  erro: string;
}

function Periodo({ r }: { r: { dataInicial: string; dataFinal: string; parcial: boolean } }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {dataBR(r.dataInicial)} a {dataBR(r.dataFinal)}
      {r.parcial ? (
        <span className="rounded-full bg-evaldo-amarelo px-2 py-0.5 text-xs font-bold text-evaldo-azul-escuro">Parcial</span>
      ) : (
        <span className="rounded-full bg-evaldo-azul-claro px-2 py-0.5 text-xs font-semibold text-evaldo-azul">Completo</span>
      )}
    </span>
  );
}

export function Importar() {
  const { relatorios, recarregar } = usePainel();
  const [arrastando, setArrastando] = useState(false);
  const [previas, setPrevias] = useState<Previa[]>([]);
  const [falhas, setFalhas] = useState<Falha[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const input = useRef<HTMLInputElement>(null);

  async function lerArquivos(arquivos: FileList | File[]) {
    setMensagem('');
    const novas: Previa[] = [];
    const erros: Falha[] = [];
    for (const arq of Array.from(arquivos)) {
      try {
        const lido = lerRelatorio(await arq.arrayBuffer(), arq.name);
        const c = lido.cabecalho;
        const chave = `${c.vendedorCodigo}-${c.mes}`;
        if (novas.some((p) => p.chave === chave)) {
          erros.push({ arquivo: arq.name, erro: `Mais de um arquivo de ${c.vendedorNome} em ${nomeMes(c.mes)}; usei só o primeiro.` });
          continue;
        }
        novas.push({ chave, lido, existente: await buscarRelatorio(c.vendedorCodigo, c.mes) });
      } catch (e) {
        if (e instanceof ErroBanco) {
          erros.push({ arquivo: arq.name, erro: e.message });
          continue;
        }
        if (await ehRelatorioProdutos(arq)) {
          erros.push({ arquivo: arq.name, erro: 'Este é o relatório de produtos vendidos. Envie pela aba "Importar produtos" no menu.' });
          continue;
        }
        erros.push({ arquivo: arq.name, erro: e instanceof ErroImportacao ? e.message : `Não consegui ler o arquivo (${String(e)}).` });
      }
    }
    setPrevias(novas.sort((a, b) => a.chave.localeCompare(b.chave)));
    setFalhas(erros);
  }

  function soltar(e: DragEvent) {
    e.preventDefault();
    setArrastando(false);
    if (e.dataTransfer.files.length) lerArquivos(e.dataTransfer.files);
  }

  const pendentes = previas.filter((p) => p.existente && p.substituir === undefined).length;
  const aImportar = previas.filter((p) => !p.existente || p.substituir);

  async function confirmar() {
    setSalvando(true);
    setMensagem('');
    const feitos: string[] = [];
    const erros: Falha[] = [];
    try {
      for (const p of aImportar) {
        try {
          await importarRelatorio(p.lido);
          feitos.push(p.chave);
        } catch (e) {
          // Cada relatório é gravado por inteiro ou não é gravado (nada fica pela metade).
          erros.push({ arquivo: p.lido.nomeArquivo, erro: mensagemDeErro(e) });
        }
      }
      if (feitos.length) await recarregar();
      if (feitos.length) setMensagem(`${feitos.length} relatório(s) importado(s) com sucesso.`);
      // Ficam na tela só os que falharam, para tentar de novo.
      setPrevias((ps) => ps.filter((p) => !feitos.includes(p.chave)));
      setFalhas(erros);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(r: Relatorio) {
    if (!confirm(`Excluir o relatório de ${r.vendedorNome} de ${nomeMes(r.mes)}? As vendas desse mês saem do painel.`)) return;
    await excluirRelatorio(r.id);
    await recarregar();
  }

  const lista = [...relatorios].sort((a, b) => b.mes.localeCompare(a.mes) || a.vendedorNome.localeCompare(b.vendedorNome));

  return (
    <div>
      <Titulo titulo="Importar clientes" subtitulo='Relatório de vendas por cliente: "VENDAS POR MARK-UP", tipo SINTÉTICO por CLIENTE, exportado do ERP em CSV. Os produtos vão na aba "Importar produtos".' />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={soltar}
        onClick={() => input.current?.click()}
        className={`card flex cursor-pointer flex-col items-center justify-center border-2 border-dashed px-6 py-10 text-center transition-colors ${
          arrastando ? 'border-evaldo-azul bg-evaldo-azul-claro' : 'border-evaldo-azul/30 hover:border-evaldo-azul'
        }`}
      >
        <div className="text-4xl text-evaldo-azul">⇪</div>
        <p className="mt-3 font-bold text-evaldo-azul-escuro">Arraste os arquivos CSV aqui</p>
        <p className="mt-1 text-sm text-gray-500">ou clique para escolher. Pode mandar vários de uma vez (um por vendedor e por mês).</p>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) lerArquivos(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {mensagem && (
        <div className="mt-4 rounded-lg border-l-4 border-positivo bg-green-50 px-4 py-3 text-sm font-semibold text-positivo">
          ✓ {mensagem}{' '}
          <Link to="/clientes" className="underline">
            Ver visão geral
          </Link>
        </div>
      )}

      {falhas.length > 0 && (
        <div className="mt-4 space-y-2">
          {falhas.map((f) => (
            <div key={f.arquivo + f.erro} className="rounded-lg border-l-4 border-evaldo-vermelho bg-evaldo-vermelho-claro px-4 py-3 text-sm">
              <strong className="text-evaldo-vermelho">{f.arquivo}:</strong> {f.erro}
            </div>
          ))}
        </div>
      )}

      {previas.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-lg">Confira antes de importar</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {previas.map((p) => {
              const c = p.lido.cabecalho;
              const total = p.lido.linhas.reduce((s, l) => s + l.valorTotal, 0);
              return (
                <div key={p.chave} className="card-indicador p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold uppercase text-gray-500">Vendedor {c.vendedorCodigo}</div>
                      <div className="text-lg font-extrabold italic text-evaldo-azul-escuro">{c.vendedorNome}</div>
                    </div>
                    <div className="text-right text-xs capitalize text-gray-500">{nomeMes(c.mes)}</div>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="col-span-2">
                      <dt className="text-xs text-gray-500">Período</dt>
                      <dd>
                        <Periodo r={c} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Clientes</dt>
                      <dd className="font-bold">{int(p.lido.linhas.length)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Total vendido</dt>
                      <dd className="font-bold">{reais(total)}</dd>
                    </div>
                  </dl>
                  {c.parcial && (
                    <p className="mt-3 rounded bg-evaldo-amarelo-claro px-3 py-2 text-xs text-evaldo-azul-escuro">
                      ⚠ O período não cobre o mês inteiro. O mês ficará marcado como <strong>parcial</strong>.
                    </p>
                  )}
                  {p.existente && (
                    <div className="mt-3 rounded border border-evaldo-vermelho/30 bg-evaldo-vermelho-claro px-3 py-2 text-xs">
                      <p>
                        Já existe um relatório de <strong>{c.vendedorNome}</strong> em {nomeMes(c.mes)} ({dataBR(p.existente.dataInicial)} a{' '}
                        {dataBR(p.existente.dataFinal)}, {reais(p.existente.totalVendido)}). Substituir?
                      </p>
                      <div className="mt-2 flex gap-2">
                        {[true, false].map((op) => (
                          <button
                            key={String(op)}
                            className={`btn px-3 py-1 text-xs ${
                              p.substituir === op ? 'bg-evaldo-azul text-white' : 'border border-evaldo-azul bg-white text-evaldo-azul'
                            }`}
                            onClick={() => setPrevias((ps) => ps.map((x) => (x.chave === p.chave ? { ...x, substituir: op } : x)))}
                          >
                            {op ? 'Substituir' : 'Manter o atual'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className="btn-primario" disabled={salvando || pendentes > 0 || aImportar.length === 0} onClick={confirmar}>
              {salvando ? 'Importando…' : `Confirmar importação (${aImportar.length})`}
            </button>
            <button className="btn-secundario" onClick={() => setPrevias([])}>
              Cancelar
            </button>
            {pendentes > 0 && <span className="text-sm text-evaldo-vermelho">Responda se deve substituir os relatórios que já existem.</span>}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-lg">Relatórios importados</h2>
        {lista.length === 0 ? (
          <p className="card px-4 py-6 text-center text-sm text-gray-500">
            Nenhum relatório importado ainda. Para testar, use os arquivos da pasta <code>exemplos/</code> do projeto.
          </p>
        ) : (
          <div className="card overflow-x-auto p-2">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Vendedor</th>
                  <th>Período</th>
                  <th className="text-right">Clientes</th>
                  <th className="text-right">Total</th>
                  <th>Importado em</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((r) => (
                  <tr key={r.id}>
                    <td className="capitalize">{nomeMes(r.mes)}</td>
                    <td>
                      {r.vendedorCodigo} - {r.vendedorNome}
                    </td>
                    <td>
                      <Periodo r={r} />
                    </td>
                    <td className="num">{int(r.qtdClientes)}</td>
                    <td className="num">{reais(r.totalVendido)}</td>
                    <td>{dataHoraBR(r.importadoEm)}</td>
                    <td>
                      <button className="btn-perigo px-3 py-1 text-xs" onClick={() => excluir(r)}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
