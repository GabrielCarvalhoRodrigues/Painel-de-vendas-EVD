import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { aoMudarSessao, carregarPerfil, sair as sairDoSupabase, sessaoAtual, type Perfil, type Session } from '../dados/auth';
import { mensagemDeErro } from '../dados/erros';
import { veioDaRecuperacao } from '../dados/supabase';

interface Auth {
  /** Ainda verificando se há alguém logado. */
  carregando: boolean;
  sessao: Session | null;
  perfil: Perfil | null;
  /** Erro ao carregar o perfil (ex.: sem conexão). */
  erro: string;
  /** Aberto pelo link de "esqueci minha senha": falta definir a nova senha. */
  trocandoSenha: boolean;
  concluirTrocaSenha: () => void;
  tentarDeNovo: () => void;
  sair: () => Promise<void>;
}

const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [verificandoSessao, setVerificandoSessao] = useState(true);
  const [carregandoPerfil, setCarregandoPerfil] = useState(false);
  const [sessao, setSessao] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [erro, setErro] = useState('');
  const [trocandoSenha, setTrocandoSenha] = useState(veioDaRecuperacao);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    sessaoAtual()
      .then(setSessao)
      .catch(() => setSessao(null))
      .finally(() => setVerificandoSessao(false));
    return aoMudarSessao((evento, s) => {
      setSessao(s);
      if (evento === 'PASSWORD_RECOVERY') setTrocandoSenha(true);
    });
  }, []);

  // Carrega o perfil quando muda o usuário logado.
  const usuario = sessao?.user.id ?? null;
  useEffect(() => {
    setPerfil(null);
    setErro('');
    if (!usuario) return;
    let ativo = true;
    setCarregandoPerfil(true);
    carregarPerfil(usuario)
      .then((p) => ativo && setPerfil(p))
      .catch((e) => ativo && setErro(mensagemDeErro(e)))
      .finally(() => ativo && setCarregandoPerfil(false));
    return () => {
      ativo = false;
    };
  }, [usuario, tentativa]);

  const sair = useCallback(async () => {
    try {
      await sairDoSupabase();
    } finally {
      setSessao(null);
      setPerfil(null);
    }
  }, []);

  const valor: Auth = {
    carregando: verificandoSessao || carregandoPerfil,
    sessao,
    perfil,
    erro,
    trocandoSenha,
    concluirTrocaSenha: () => setTrocandoSenha(false),
    tentarDeNovo: () => setTentativa((t) => t + 1),
    sair,
  };
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
