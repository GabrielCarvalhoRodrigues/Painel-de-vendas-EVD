import { useEffect, useState } from 'react';
import { mensagemDeErro } from '../dados/erros';
import { listarHistoricoContatos, type RegistroContato } from '../dados/repositorio';
import { usePainel } from '../estado/PainelContext';
import type { StatusContato } from '../tipos';
import { dataHoraBR } from '../utils/formato';
import { formatarTelefone, linkWhatsApp, mensagemRetorno, telefoneValido } from '../utils/whatsapp';

export const NOME_STATUS: Record<StatusContato, string> = {
  nao_contatado: 'Não contatado',
  contatado: 'Contatado',
  recuperado: 'Recuperado',
};

const COR_STATUS: Record<StatusContato, string> = {
  nao_contatado: 'border-gray-300 text-gray-600',
  contatado: 'border-evaldo-azul text-evaldo-azul bg-evaldo-azul-claro',
  recuperado: 'border-positivo text-positivo bg-green-50',
};

/** Telefone, botão do WhatsApp, status de contato e anotação do cliente (tudo salvo no cadastro). */
export function ContatoCliente({ codigo, nome, vendedor, compacto = false }: { codigo: string; nome: string; vendedor?: string; compacto?: boolean }) {
  const { clientes, salvarCliente } = usePainel();
  const cadastro = clientes.get(codigo);
  const [telefone, setTelefone] = useState(cadastro?.telefone ?? '');
  const [anotacao, setAnotacao] = useState(cadastro?.anotacao ?? '');
  const [salvo, setSalvo] = useState('');
  const status: StatusContato = cadastro?.statusContato ?? 'nao_contatado';

  useEffect(() => {
    setTelefone(cadastro?.telefone ?? '');
    setAnotacao(cadastro?.anotacao ?? '');
  }, [cadastro?.telefone, cadastro?.anotacao]);

  const [versao, setVersao] = useState(0);

  async function salvar(dados: Parameters<typeof salvarCliente>[1], aviso: string) {
    await salvarCliente(codigo, dados);
    setSalvo(aviso);
    setVersao((v) => v + 1);
    setTimeout(() => setSalvo(''), 2000);
  }

  const valido = telefoneValido(telefone);

  return (
    <div className={`grid gap-3 ${compacto ? 'md:grid-cols-[220px_auto_170px_1fr]' : 'sm:grid-cols-2'} items-start`}>
      <label>
        <span className="rotulo">Telefone (com DDD)</span>
        <input
          className={`campo w-full ${telefone && !valido ? 'border-evaldo-vermelho' : ''}`}
          inputMode="tel"
          placeholder="(00) 00000-0000"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          onBlur={() => {
            const t = valido ? formatarTelefone(telefone) : telefone.trim();
            setTelefone(t);
            if (t !== (cadastro?.telefone ?? '')) salvar({ telefone: t }, 'Telefone salvo');
          }}
        />
      </label>
      <div className={compacto ? 'pt-5' : 'flex items-end'}>
        <a
          href={valido ? linkWhatsApp(telefone, mensagemRetorno(nome, vendedor)) : undefined}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            if (!valido) {
              e.preventDefault();
              alert('Preencha o telefone do cliente com DDD para chamar no WhatsApp.');
            } else if (status === 'nao_contatado') {
              salvar({ statusContato: 'contatado' }, 'Marcado como contatado');
            }
          }}
          className={`btn-whatsapp w-full whitespace-nowrap ${valido ? '' : 'opacity-50'}`}
          title={valido ? 'Abre o WhatsApp com uma mensagem pronta' : 'Preencha o telefone primeiro'}
        >
          💬 Chamar no WhatsApp
        </a>
      </div>
      <label>
        <span className="rotulo">Status do contato</span>
        <select
          className={`campo w-full font-semibold ${COR_STATUS[status]}`}
          value={status}
          onChange={(e) => salvar({ statusContato: e.target.value as StatusContato }, 'Status salvo')}
        >
          {Object.entries(NOME_STATUS).map(([id, n]) => (
            <option key={id} value={id}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className={compacto ? '' : 'sm:col-span-2'}>
        <span className="rotulo">
          Anotação {salvo && <span className="ml-2 normal-case text-positivo">✓ {salvo}</span>}
        </span>
        <textarea
          className="campo w-full"
          rows={compacto ? 1 : 3}
          placeholder="Ex.: liguei dia 30/10, vai comprar semana que vem"
          value={anotacao}
          onChange={(e) => setAnotacao(e.target.value)}
          onBlur={() => {
            if (anotacao !== (cadastro?.anotacao ?? '')) salvar({ anotacao }, 'Anotação salva');
          }}
        />
      </label>
      {!compacto && <HistoricoContatos codigo={codigo} versao={versao} />}
    </div>
  );
}

/** Histórico de mudanças de status e anotação, com data e quem fez. */
function HistoricoContatos({ codigo, versao }: { codigo: string; versao: number }) {
  const [itens, setItens] = useState<RegistroContato[] | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    listarHistoricoContatos(codigo)
      .then((r) => ativo && setItens(r))
      .catch((e) => ativo && setErro(mensagemDeErro(e)));
    return () => {
      ativo = false;
    };
  }, [codigo, versao]);

  return (
    <details className="sm:col-span-2">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-gray-500">
        Histórico de contatos {itens ? `(${itens.length})` : ''}
      </summary>
      {erro && <p className="mt-2 text-sm text-evaldo-vermelho">{erro}</p>}
      {itens && itens.length === 0 && <p className="mt-2 text-sm text-gray-500">Nenhum contato registrado ainda.</p>}
      {itens && itens.length > 0 && (
        <ul className="mt-2 space-y-2 text-sm">
          {itens.map((i) => (
            <li key={i.id} className="rounded-lg bg-evaldo-azul-claro/60 px-3 py-2">
              <div className="text-xs text-gray-500">
                {dataHoraBR(i.data)} · {i.autor} · <strong>{NOME_STATUS[i.status]}</strong>
              </div>
              {i.anotacao && <div className="mt-0.5 whitespace-pre-wrap">{i.anotacao}</div>}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
