import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { NOME_SITUACAO, type ClienteAnalise, type Situacao } from '../regras/analise';
import { porcento, reais } from '../utils/formato';

export function Titulo({ titulo, subtitulo, children }: { titulo: string; subtitulo?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl sm:text-3xl">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-gray-500">{subtitulo}</p>}
      </div>
      {children}
    </div>
  );
}

export function TelaVazia({ titulo, texto, acao }: { titulo: string; texto?: string; acao?: ReactNode }) {
  return (
    <div className="card mx-auto mt-6 max-w-xl px-6 py-12 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-evaldo-amarelo-claro text-2xl text-evaldo-azul-escuro">
        ⇪
      </div>
      <h2 className="text-xl">{titulo}</h2>
      {texto && <p className="mt-2 text-sm text-gray-600">{texto}</p>}
      {acao && <div className="mt-6">{acao}</div>}
    </div>
  );
}

export function SemDados() {
  return (
    <TelaVazia
      titulo="Importe o primeiro relatório para começar"
      texto='Exporte do ERP o relatório "VENDAS POR MARK-UP" (sintético por cliente) em CSV, um arquivo por vendedor e por mês.'
      acao={
        <Link to="/importar" className="btn-primario">
          Importar clientes
        </Link>
      }
    />
  );
}

/** ▲ verde / ▼ vermelha com a variação percentual. `inverter` para quando subir é ruim. */
export function Seta({ variacao, className = '' }: { variacao: number | null; className?: string }) {
  if (variacao == null || !isFinite(variacao)) return <span className={`text-gray-400 ${className}`}>—</span>;
  if (Math.abs(variacao) < 0.0005) return <span className={`text-gray-500 ${className}`}>= 0,0%</span>;
  const sobe = variacao > 0;
  return (
    <span className={`font-semibold ${sobe ? 'text-positivo' : 'text-evaldo-vermelho'} ${className}`}>
      {sobe ? '▲' : '▼'} {porcento(Math.abs(variacao))}
    </span>
  );
}

/** Valor em R$ colorido: verde se positivo, vermelho se negativo. */
export function Diferenca({ valor, sinal = true }: { valor: number | null; sinal?: boolean }) {
  if (valor == null) return <span className="text-gray-400">—</span>;
  if (Math.abs(valor) < 0.005) return <span className="text-gray-500">{reais(0)}</span>;
  const cor = valor > 0 ? 'text-positivo' : 'text-evaldo-vermelho';
  return (
    <span className={cor}>
      {sinal && valor > 0 ? '+' : ''}
      {reais(valor)}
    </span>
  );
}

export function Valor({ valor }: { valor: number }) {
  return <span className={valor < 0 ? 'text-evaldo-vermelho' : ''}>{reais(valor)}</span>;
}

const ESTILO_SITUACAO: Record<Situacao, string> = {
  ativo: 'bg-evaldo-azul-claro text-evaldo-azul',
  novo: 'bg-evaldo-amarelo-claro text-evaldo-azul-escuro',
  voltou: 'bg-evaldo-amarelo-claro text-evaldo-azul-escuro',
  deixou: 'bg-evaldo-vermelho-claro text-evaldo-vermelho',
  nao_voltou: 'bg-gray-100 text-gray-600',
  sem_compra: 'bg-gray-100 text-gray-500',
};

function Selo({ classe, children }: { classe: string; children: ReactNode }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${classe}`}>{children}</span>;
}

export function SeloSituacao({ situacao }: { situacao: Situacao }) {
  return <Selo classe={ESTILO_SITUACAO[situacao]}>{NOME_SITUACAO[situacao]}</Selo>;
}

export function SeloBalcao() {
  return <Selo classe="bg-evaldo-azul text-white">Balcão</Selo>;
}

/** Situação para o ranking: destaca queda forte e subida forte. */
export function SituacaoRanking({ c }: { c: ClienteAnalise }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {c.quedaForte && <Selo classe="bg-evaldo-vermelho text-white">▼ Queda forte</Selo>}
      {c.subiuForte && <Selo classe="bg-positivo text-white">▲ Subiu +50%</Selo>}
      {!c.quedaForte && !c.subiuForte && <SeloSituacao situacao={c.situacao} />}
      {(c.quedaForte || c.subiuForte) && c.situacao !== 'ativo' && <SeloSituacao situacao={c.situacao} />}
    </span>
  );
}

export function LinkCliente({ codigo, nome }: { codigo: string; nome: string }) {
  return (
    <Link to={`/cliente/${codigo}`} className="font-semibold text-evaldo-azul-escuro hover:text-evaldo-azul hover:underline">
      {nome}
    </Link>
  );
}

export function Medalha({ posicao }: { posicao: number }) {
  if (posicao > 3) return <span className="text-gray-500">{posicao}º</span>;
  const medalhas = ['🥇', '🥈', '🥉'];
  return (
    <span className="inline-flex items-center gap-1 font-extrabold text-evaldo-azul-escuro">
      {medalhas[posicao - 1]} {posicao}º
    </span>
  );
}
