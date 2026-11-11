/** Erro do banco/login já com a mensagem pronta para mostrar ao usuário. */
export class ErroBanco extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroBanco';
  }
}

interface ErroBruto {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
}

/** Traduz erros do Supabase (rede, permissão, banco) para português. */
export function mensagemDeErro(e: unknown): string {
  if (e instanceof ErroBanco) return e.message;
  const o = (e ?? {}) as ErroBruto;
  const msg = String(o.message ?? (typeof e === 'string' ? e : ''));

  if (
    o.name === 'AuthRetryableFetchError' ||
    /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(msg)
  ) {
    return 'Sem conexão com o banco. Verifique a internet e tente novamente.';
  }
  if (o.code === 'PGRST205' || o.code === 'PGRST202' || o.code === '42P01' || o.code === '42883') {
    return 'O banco ainda não foi configurado: aplique as migrations no Supabase (veja o README).';
  }
  if (o.code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return 'Usuário ou senha incorretos.';
  if (o.code === 'email_not_confirmed') return 'O usuário ainda não foi confirmado no Supabase (rode o script criar-usuario-gestao.sql).';
  if (o.code === 'over_request_rate_limit' || o.code === 'over_email_send_rate_limit' || o.status === 429) {
    return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.';
  }
  if (o.code === 'weak_password') return 'Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.';
  if (o.code === 'same_password') return 'A nova senha precisa ser diferente da atual.';
  if (
    o.code === '42501' ||
    o.code === 'PGRST301' ||
    o.code === 'PGRST303' ||
    o.status === 401 ||
    o.status === 403 ||
    /jwt|row-level security|permission denied/i.test(msg)
  ) {
    return 'Sem permissão ou sessão expirada. Saia e entre novamente.';
  }
  // Mensagens das funções de importação (raise exception) já vêm em português.
  if (o.code === 'P0001' || o.code === '22023') return msg;
  if (o.code === '23503') return 'Dados inconsistentes: vendedor ou cliente não encontrado no banco.';
  return `Erro no banco: ${msg || 'desconhecido'}. Tente novamente.`;
}

export function erroBanco(e: unknown): ErroBanco {
  return e instanceof ErroBanco ? e : new ErroBanco(mensagemDeErro(e));
}
