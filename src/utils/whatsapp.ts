/** Só os dígitos do telefone, sem o 55 do Brasil (se o usuário digitou). */
export function limparTelefone(telefone: string): string {
  let d = telefone.replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  return d;
}

/** Telefone com DDD: 10 dígitos (fixo) ou 11 (celular). */
export function telefoneValido(telefone: string): boolean {
  const d = limparTelefone(telefone);
  return d.length === 10 || d.length === 11;
}

export function formatarTelefone(telefone: string): string {
  const d = limparTelefone(telefone);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return telefone;
}

function primeiroNome(nome: string): string {
  const n = nome.trim().split(/\s+/)[0] ?? '';
  return n.charAt(0) + n.slice(1).toLowerCase();
}

export function mensagemRetorno(cliente: string, vendedor?: string): string {
  const quem = vendedor ? `Aqui é o ${primeiroNome(vendedor)}, da Evaldo Peças & Serviços` : 'Aqui é da Evaldo Peças & Serviços';
  return `Olá! ${quem}. Faz um tempo que não recebemos seu pedido e queríamos saber se está precisando de alguma peça ou serviço. Estamos à disposição para fazer um orçamento! (${cliente})`;
}

export function linkWhatsApp(telefone: string, mensagem: string): string {
  return `https://wa.me/55${limparTelefone(telefone)}?text=${encodeURIComponent(mensagem)}`;
}
