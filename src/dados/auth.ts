/** Login (Supabase Auth) e perfil do usuário. */
import type { Session } from '@supabase/supabase-js';
import { ErroBanco, erroBanco } from './erros';
import { supabase } from './supabase';

export type { Session };

export type Papel = 'gestao' | 'vendedor';

export interface Perfil {
  id: string;
  nome: string;
  papel: Papel;
  /** Código do vendedor no ERP (vazio para a gestão). */
  vendedorCodigo: string | null;
}

/**
 * Espera o Supabase ler o endereço (link do e-mail de senha) antes de o
 * roteador do painel mexer no "#" da URL.
 */
export async function prepararSessao(): Promise<void> {
  try {
    await supabase.auth.initialize();
  } catch {
    /* sem conexão: a tela de login mostra o erro */
  }
  // Tira o "#access_token=..." do endereço, se ainda estiver lá.
  if (/access_token=|error_description=/.test(window.location.hash)) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

export async function sessaoAtual(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw erroBanco(error);
  return data.session;
}

/** Avisa quando a pessoa entra, sai, troca a senha etc. Devolve a função para parar de ouvir. */
export function aoMudarSessao(fn: (evento: string, sessao: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((evento, sessao) => fn(evento, sessao));
  return () => data.subscription.unsubscribe();
}

export async function entrar(email: string, senha: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
  if (error) throw erroBanco(error);
}

/**
 * Login simples do painel: um único usuário fixo que entra como gestão e vê
 * todos os dados. Por baixo, usa uma conta real do Supabase (um e-mail interno
 * que ninguém digita) — criada pelo script supabase/criar-usuario-gestao.sql.
 * Para trocar a senha, rode aquele script de novo com a nova senha.
 */
export const USUARIO_PAINEL = 'Dimmer7';
const EMAIL_INTERNO = 'contato@dimmer7.com.br';

/** Aceita o usuário "Dimmer7" ou um e-mail cadastrado no Supabase. */
export async function entrarComUsuario(usuario: string, senha: string): Promise<void> {
  const digitado = usuario.trim().toLowerCase();
  let email: string;
  if (digitado.includes('@')) {
    email = digitado;
  } else if (digitado === USUARIO_PAINEL.toLowerCase()) {
    email = EMAIL_INTERNO;
  } else {
    throw new ErroBanco('Usuário ou senha incorretos.');
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw erroBanco(error);
}

export async function sair(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw erroBanco(error);
}

/** Envia o e-mail de "esqueci minha senha". O link volta para este mesmo endereço. */
export async function enviarLinkSenha(email: string): Promise<void> {
  const { protocol, origin, pathname } = window.location;
  const redirectTo = protocol === 'http:' || protocol === 'https:' ? origin + pathname : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) throw erroBanco(error);
}

export async function definirNovaSenha(senha: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) throw erroBanco(error);
}

/** Perfil do usuário logado (null se ninguém criou o perfil dele). */
export async function carregarPerfil(id: string): Promise<Perfil | null> {
  const { data, error } = await supabase.from('perfis').select('id, nome, papel, vendedor_codigo').eq('id', id).maybeSingle();
  if (error) throw erroBanco(error);
  if (!data) return null;
  return { id: data.id, nome: data.nome, papel: data.papel as Papel, vendedorCodigo: data.vendedor_codigo };
}
