import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TelaVazia, Titulo } from '../componentes/Comuns';
import {
  enviarDadosLocais,
  lerDadosLocais,
  limparDadosLocais,
  resumir,
  temDadosLocais,
  type DadosLocais as Dados,
  type ResultadoEnvio,
} from '../dados/dadosLocais';
import { mensagemDeErro } from '../dados/erros';
import { usePainel } from '../estado/PainelContext';
import { int } from '../utils/formato';

/** Envia para o Supabase o que ficou salvo neste navegador pela versão antiga do painel. */
export function DadosLocais() {
  const { recarregar } = usePainel();
  const [dados, setDados] = useState<Dados | null>(null);
  const [progresso, setProgresso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoEnvio | null>(null);
  const [erro, setErro] = useState('');
  const [limpo, setLimpo] = useState(false);

  useEffect(() => {
    lerDadosLocais().then(setDados);
  }, []);

  if (!dados) return null;
  const resumo = resumir(dados);

  if (limpo || !temDadosLocais(resumo)) {
    return (
      <TelaVazia
        titulo={limpo ? 'Dados locais apagados' : 'Nada para enviar'}
        texto={
          limpo
            ? 'Este navegador não guarda mais cópia dos dados. Tudo está no banco.'
            : 'Este navegador não tem dados da versão antiga do painel. Se eles estão em outro computador, abra o painel por lá.'
        }
        acao={
          <Link to="/" className="btn-primario">
            Ir para a visão geral
          </Link>
        }
      />
    );
  }

  async function enviar() {
    setErro('');
    setEnviando(true);
    try {
      setResultado(await enviarDadosLocais(dados!, setProgresso));
      await recarregar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }

  async function limpar() {
    if (!confirm('Apagar os dados deste navegador? Eles já estão no banco, mas esta cópia local não poderá ser recuperada.')) return;
    await limparDadosLocais();
    setLimpo(true);
  }

  const itens: [string, number][] = [
    ['Relatórios de vendas', resumo.relatorios],
    ['Relatórios de produtos', resumo.relatoriosProdutos],
    ['Clientes', resumo.clientes],
    ['Clientes com telefone, anotação ou status', resumo.contatos],
    ['Metas', resumo.metas],
    ['Vendedores', resumo.vendedores],
  ];

  return (
    <div className="max-w-3xl">
      <Titulo
        titulo="Enviar dados locais para o banco"
        subtitulo="A versão antiga do painel guardava os dados só neste navegador. Envie para o banco para a gestão ver de qualquer lugar."
      />

      <section className="card p-5">
        <h2 className="mb-3 text-lg">Encontrado neste navegador</h2>
        <dl className="grid gap-2 sm:grid-cols-2">
          {itens.map(([nome, qtd]) => (
            <div key={nome} className="flex justify-between rounded-lg bg-evaldo-azul-claro/60 px-3 py-2 text-sm">
              <dt>{nome}</dt>
              <dd className="font-bold">{int(qtd)}</dd>
            </div>
          ))}
        </dl>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li>Relatórios que já existem no banco (mesmo vendedor e mês) <strong>não são trocados</strong>.</li>
          <li>Telefone, anotação e status só preenchem o que está vazio no banco.</li>
          <li>Metas que já existem no banco são mantidas.</li>
          <li>Nada é apagado deste navegador sem você pedir.</li>
        </ul>

        {!resultado && (
          <button className="btn-primario mt-5" disabled={enviando} onClick={enviar}>
            {enviando ? 'Enviando…' : 'Enviar para o banco'}
          </button>
        )}
        {progresso && <p className="mt-3 text-sm text-gray-500">{progresso}</p>}
        {erro && (
          <div role="alert" className="mt-4 rounded-lg border-l-4 border-evaldo-vermelho bg-evaldo-vermelho-claro px-4 py-3 text-sm">
            <strong className="text-evaldo-vermelho">O envio parou:</strong> {erro} O que já foi enviado continua no banco; pode clicar em enviar de
            novo que nada é duplicado.
          </div>
        )}
      </section>

      {resultado && (
        <section className="card mt-5 p-5">
          <h2 className="mb-3 text-lg">✓ Envio concluído</h2>
          <ul className="space-y-1 text-sm">
            <li>
              Relatórios de vendas enviados: <strong>{resultado.relatoriosEnviados}</strong>
              {resultado.relatoriosJaExistiam > 0 && ` (${resultado.relatoriosJaExistiam} já estavam no banco)`}
            </li>
            <li>
              Relatórios de produtos enviados: <strong>{resultado.produtosEnviados}</strong>
              {resultado.produtosJaExistiam > 0 && ` (${resultado.produtosJaExistiam} já estavam no banco)`}
            </li>
            <li>
              Contatos de clientes: <strong>{resultado.contatosEnviados}</strong>
            </li>
            <li>
              Metas: <strong>{resultado.metasEnviadas}</strong>
            </li>
            <li>
              Vendedores novos: <strong>{resultado.vendedoresEnviados}</strong>
            </li>
          </ul>
          <p className="mt-4 text-sm text-gray-600">
            Confira o painel. Se estiver tudo certo, pode apagar a cópia que ficou neste navegador.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/" className="btn-secundario">
              Conferir o painel
            </Link>
            <button className="btn-perigo" onClick={limpar}>
              Apagar dados deste navegador
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
