import { useState, type FormEvent, type ReactNode } from 'react';
import { Logo } from '../componentes/Logo';
import { definirNovaSenha, entrarComUsuario } from '../dados/auth';
import { mensagemDeErro } from '../dados/erros';
import { useAuth } from '../estado/AuthContext';

/** Moldura das telas de acesso: fundo azul, logo e um cartão branco. */
export function TelaAcesso({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-evaldo-azul-escuro px-4 py-10">
      <Logo className="mb-8 h-16 max-w-[220px]" />
      <div className="card w-full max-w-sm p-6">
        <h1 className="mb-5 text-2xl">{titulo}</h1>
        {children}
      </div>
      <p className="mt-6 text-xs text-white/50">Painel de Vendas Evaldo</p>
    </div>
  );
}

function Aviso({ tipo, children }: { tipo: 'erro' | 'ok'; children: ReactNode }) {
  const cor = tipo === 'erro' ? 'border-evaldo-vermelho bg-evaldo-vermelho-claro text-evaldo-vermelho' : 'border-positivo bg-green-50 text-positivo';
  return (
    <div role={tipo === 'erro' ? 'alert' : 'status'} className={`mb-4 rounded-lg border-l-4 px-3 py-2 text-sm font-semibold ${cor}`}>
      {children}
    </div>
  );
}

export function Login() {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await entrarComUsuario(usuario, senha);
    } catch (x) {
      setErro(mensagemDeErro(x));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <TelaAcesso titulo="Entrar">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <form onSubmit={enviar} className="space-y-4">
        <label className="block">
          <span className="rotulo">Usuário ou e-mail</span>
          <input
            className="campo w-full"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="rotulo">Senha</span>
          <input
            className="campo w-full"
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </label>
        <button className="btn-primario w-full" disabled={enviando}>
          {enviando ? 'Aguarde…' : 'Entrar'}
        </button>
      </form>
    </TelaAcesso>
  );
}

/** Aberta pelo link do e-mail de "esqueci minha senha". */
export function NovaSenha() {
  const { concluirTrocaSenha, sessao } = useAuth();
  const [senha, setSenha] = useState('');
  const [repetir, setRepetir] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (senha.length < 8) return setErro('Use pelo menos 8 caracteres.');
    if (senha !== repetir) return setErro('As duas senhas não são iguais.');
    setErro('');
    setEnviando(true);
    try {
      await definirNovaSenha(senha);
      concluirTrocaSenha();
    } catch (x) {
      setErro(mensagemDeErro(x));
    } finally {
      setEnviando(false);
    }
  }

  if (!sessao) {
    return (
      <TelaAcesso titulo="Link inválido">
        <p className="text-sm text-gray-600">O link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".</p>
        <button className="btn-primario mt-5 w-full" onClick={concluirTrocaSenha}>
          Voltar para o login
        </button>
      </TelaAcesso>
    );
  }

  return (
    <TelaAcesso titulo="Criar nova senha">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <form onSubmit={enviar} className="space-y-4">
        <label className="block">
          <span className="rotulo">Nova senha</span>
          <input className="campo w-full" type="password" autoComplete="new-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        </label>
        <label className="block">
          <span className="rotulo">Repita a nova senha</span>
          <input className="campo w-full" type="password" autoComplete="new-password" required value={repetir} onChange={(e) => setRepetir(e.target.value)} />
        </label>
        <button className="btn-primario w-full" disabled={enviando}>
          {enviando ? 'Salvando…' : 'Salvar nova senha'}
        </button>
      </form>
    </TelaAcesso>
  );
}

/** Logado, mas sem perfil da gestão. */
export function SemAcesso() {
  const { sessao, perfil, sair } = useAuth();
  return (
    <TelaAcesso titulo="Sem acesso">
      <p className="text-sm text-gray-600">
        O usuário <strong>{sessao?.user.email}</strong>{' '}
        {perfil ? 'ainda não tem acesso liberado ao painel.' : 'ainda não tem perfil cadastrado.'} Peça para a gestão liberar o acesso.
      </p>
      <button className="btn-secundario mt-5 w-full" onClick={sair}>
        Sair
      </button>
    </TelaAcesso>
  );
}

export function TelaCarregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-evaldo-azul-escuro text-white">
      <Logo className="h-14 max-w-[200px]" />
      <div className="flex items-center gap-3 text-sm text-white/80">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-evaldo-amarelo" />
        {texto}
      </div>
    </div>
  );
}

export function TelaErro({ titulo, texto, acao, rotulo = 'Tentar novamente' }: { titulo: string; texto: string; acao: () => void; rotulo?: string }) {
  const { sessao, sair } = useAuth();
  return (
    <TelaAcesso titulo={titulo}>
      <Aviso tipo="erro">{texto}</Aviso>
      <button className="btn-primario w-full" onClick={acao}>
        {rotulo}
      </button>
      {sessao && (
        <button className="btn-secundario mt-3 w-full" onClick={sair}>
          Sair
        </button>
      )}
    </TelaAcesso>
  );
}
