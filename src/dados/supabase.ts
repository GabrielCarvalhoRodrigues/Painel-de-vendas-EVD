/**
 * Conexão com o Supabase. Só a pasta src/dados/ usa este arquivo.
 * Usa a chave anon/publishable (pública por natureza): quem protege os dados
 * é o login + Row Level Security. NUNCA use a chave service_role aqui.
 */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** false quando o .env não foi preenchido. */
export const configurado = Boolean(url && chave);

const hashInicial = typeof window === 'undefined' ? '' : window.location.hash;

/** A página foi aberta pelo link de "esqueci minha senha" do e-mail. */
export const veioDaRecuperacao = /type=recovery/.test(hashInicial);

/** O link do e-mail veio com erro (ex.: expirado). */
export const erroNoLink = (() => {
  const m = /error_description=([^&]+)/.exec(hashInicial);
  if (!m) return '';
  return /expired|invalid/i.test(decodeURIComponent(m[1]))
    ? 'O link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".'
    : 'O link do e-mail não é válido. Peça um novo em "Esqueci minha senha".';
})();

export const supabase = createClient(url ?? 'http://localhost', chave ?? 'sem-chave', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // implicit: o link do e-mail funciona mesmo aberto em outro aparelho.
    flowType: 'implicit',
  },
});
