import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { Titulo } from '../componentes/Comuns';
import { ErroBanco, mensagemDeErro } from '../dados/erros';
import {
  buscarRelatoriosProdutos,
  excluirRelatorioProdutos,
  importarRelatorioProdutos,
  listarRelatoriosProdutos,
} from '../dados/repositorio';
import { usePainel } from '../estado/PainelContext';
import { useInvalidarProdutos } from '../estado/ProdutosContext';
import { ErroImportacao } from '../importacao/lerCsv';
import { lerRelatorioProdutos } from '../importacao/lerProdutos';
import type { RelatorioProdutos, RelatorioProdutosLido } from '../tipos';
import { dataBR, dataHoraBR, int, num } from '../utils/formato';
import { nomeMes } from '../utils/meses';

interface Previa {
  lido: RelatorioProdutosLido;
  existentes: RelatorioProdutos[];
}

/** Importação do relatório de produtos vendidos (separado do relatório por cliente). */
export function ImportarProdutos() {
  const { recarregar, vendedores } = usePainel();
  const invalidarProdutos = useInvalidarProdutos();
  const nomes = new Map(vendedores.map((v) => [v.codigo, v.nome]));
  const [arrastando, setArrastando] = useState(false);
  const [previas, setPrevias] = useState<Previa[]>([]);
  const [falhas, setFalhas] = useState<{ arquivo: string; erro: string }[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [importados, setImportados] = useState<RelatorioProdutos[]>([]);
  const input = useRef<HTMLInputElement>(null);

  const atualizarLista = () => listarRelatoriosProdutos().then(setImportados);
  useEffect(() => {
    atualizarLista();
  }, []);

  async function lerArquivos(arquivos: FileList | File[]) {
    setMensagem('');
    const novas: Previa[] = [];
    const erros: { arquivo: string; erro: string }[] = [];
    for (const arq of Array.from(arquivos)) {
      try {
        const lido = lerRelatorioProdutos(await arq.arrayBuffer(), arq.name);
        novas.push({ lido, existentes: await buscarRelatoriosProdutos(lido) });
      } catch (e) {
        erros.push({
          arquivo: arq.name,
          erro: e instanceof ErroImportacao ? e.message : e instanceof ErroBanco ? e.message : `Não consegui ler o arquivo (${String(e)}).`,
        });
      }
    }
    setPrevias(novas);
    setFalhas(erros);
  }

  function soltar(e: DragEvent) {
    e.preventDefault();
    setArrastando(false);
    if (e.dataTransfer.files.length) lerArquivos(e.dataTransfer.files);
  }

  async function confirmar() {
    setSalvando(true);
    setMensagem('');
    const feitos: string[] = [];
    const erros: { arquivo: string; erro: string }[] = [];
    try {
      for (const p of previas) {
        try {
          await importarRelatorioProdutos(p.lido);
          feitos.push(p.lido.nomeArquivo);
        } catch (e) {
          erros.push({ arquivo: p.lido.nomeArquivo, erro: mensagemDeErro(e) });
        }
      }
      if (feitos.length) {
        invalidarProdutos();
        await Promise.all([recarregar(), atualizarLista()]);
        setMensagem(`${feitos.length} relatório(s) de produtos importado(s).`);
      }
      setPrevias((ps) => ps.filter((p) => !feitos.includes(p.lido.nomeArquivo)));
      setFalhas(erros);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(r: RelatorioProdutos) {
    if (!confirm(`Excluir os produtos de ${r.vendedorNome} de ${nomeMes(r.mes)}?`)) return;
    await excluirRelatorioProdutos(r.id);
    invalidarProdutos();
    await atualizarLista();
  }

  const lista = [...importados].sort((a, b) => b.mes.localeCompare(a.mes) || a.vendedorNome.localeCompare(b.vendedorNome));

  return (
    <div>
      <Titulo
        titulo="Importar produtos"
        subtitulo='Relatório "MOVIMENTO DE CLIENTES", tipo ANALÍTICO, exportado do ERP em CSV. Usado na aba Produtos do mês.'
      />
      <p className="mb-4 text-sm text-gray-600">
        Pedido com <strong>placa</strong> (coluna "VEÍCULO: … - ABC-1D23 - KM") conta como <strong>Vendas oficina</strong>; sem placa, como{' '}
        <strong>Vendas Balcão</strong>. Pode ser do mês até o momento: o mês fica marcado como parcial. Um arquivo com todos os vendedores é
        separado pelo código do vendedor (coluna VEN).
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={soltar}
        onClick={() => input.current?.click()}
        className={`card flex cursor-pointer flex-col items-center justify-center border-2 border-dashed px-6 py-8 text-center transition-colors ${
          arrastando ? 'border-evaldo-azul bg-evaldo-azul-claro' : 'border-evaldo-azul/30 hover:border-evaldo-azul'
        }`}
      >
        <div className="text-3xl text-evaldo-azul">▤</div>
        <p className="mt-2 font-bold text-evaldo-azul-escuro">Arraste aqui o CSV de produtos vendidos</p>
        <p className="mt-1 text-sm text-gray-500">ou clique para escolher.</p>
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
          <Link to="/produtos" className="underline">
            Ver produtos do mês
          </Link>
        </div>
      )}

      {falhas.map((f) => (
        <div key={f.arquivo + f.erro} className="mt-4 rounded-lg border-l-4 border-evaldo-vermelho bg-evaldo-vermelho-claro px-4 py-3 text-sm">
          <strong className="text-evaldo-vermelho">{f.arquivo}:</strong> {f.erro}
        </div>
      ))}

      {previas.length > 0 && (
        <div className="mt-4 space-y-3">
          {previas.map((p) => {
            const balcao = p.lido.linhas.filter((l) => l.canal === 'balcao').reduce((s, l) => s + l.qtde, 0);
            const oficina = p.lido.linhas.filter((l) => l.canal === 'oficina').reduce((s, l) => s + l.qtde, 0);
            return (
              <div key={p.lido.nomeArquivo} className="card-indicador p-4 text-sm">
                <div className="font-bold text-evaldo-azul-escuro">
                  {p.lido.nomeArquivo} · <span className="capitalize">{nomeMes(p.lido.mes)}</span> ({dataBR(p.lido.dataInicial)} a{' '}
                  {dataBR(p.lido.dataFinal)}){p.lido.parcial ? ' · parcial' : ''}
                </div>
                <div className="mt-1 text-gray-600">
                  Vendedores: {p.lido.vendedores.map((v) => `${v.codigo} - ${nomes.get(v.codigo) ?? v.nome}`).join(', ')}
                </div>
                <div className="mt-1 text-gray-600">
                  {int(new Set(p.lido.linhas.map((l) => l.produtoCodigo)).size)} produtos · Vendas Balcão: {num(balcao)} itens · Vendas oficina:{' '}
                  {num(oficina)} itens
                </div>
                {p.existentes.length > 0 && (
                  <p className="mt-2 rounded bg-evaldo-amarelo-claro px-3 py-2 text-xs text-evaldo-azul-escuro">
                    ⚠ Vai substituir os produtos já importados de {p.existentes.map((r) => r.vendedorNome).join(', ')} nesse mês.
                  </p>
                )}
              </div>
            );
          })}
          <div className="flex flex-wrap gap-3">
            <button className="btn-primario" disabled={salvando} onClick={confirmar}>
              {salvando ? 'Importando…' : `Confirmar importação (${previas.length})`}
            </button>
            <button className="btn-secundario" onClick={() => setPrevias([])}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {lista.length > 0 && (
        <div className="card mt-4 overflow-x-auto p-2">
          <table className="tabela">
            <thead>
              <tr>
                <th>Mês</th>
                <th>Vendedor</th>
                <th>Período</th>
                <th className="text-right">Produtos</th>
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
                    {dataBR(r.dataInicial)} a {dataBR(r.dataFinal)}
                    {r.parcial ? ' (parcial)' : ''}
                  </td>
                  <td className="num">{int(r.qtdProdutos)}</td>
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
    </div>
  );
}
