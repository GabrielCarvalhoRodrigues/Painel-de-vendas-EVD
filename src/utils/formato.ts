const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const moedaCurta = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const inteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** R$ 1.234,56 (o Intl usa espaço não separável; trocamos por espaço comum). */
export function reais(valor: number): string {
  return moeda.format(valor).replace(/ /g, ' ');
}

export function reaisCurto(valor: number): string {
  return moedaCurta.format(valor).replace(/ /g, ' ');
}

export function num(valor: number): string {
  return numero.format(valor);
}

export function int(valor: number): string {
  return inteiro.format(valor);
}

/** Recebe fração (0,25) e devolve "25,0%". */
export function porcento(fracao: number | null | undefined): string {
  if (fracao == null || !isFinite(fracao)) return '—';
  return `${pct.format(fracao * 100)}%`;
}

/** AAAA-MM-DD ou Date → dd/mm/aaaa */
export function dataBR(data: string | Date): string {
  if (typeof data === 'string') {
    const [a, m, d] = data.slice(0, 10).split('-');
    return `${d}/${m}/${a}`;
  }
  return data.toLocaleDateString('pt-BR');
}

export function dataHoraBR(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}
