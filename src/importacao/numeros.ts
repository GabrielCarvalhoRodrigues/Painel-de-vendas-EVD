/**
 * Converte um número no formato brasileiro ("1.434,40", "-12,50", "12,50-") para number.
 * Campo vazio vira 0. Texto que não é número gera NaN.
 */
export function numeroBR(texto: string | undefined | null): number {
  if (texto == null) return 0;
  let t = texto.trim().replace(/^"|"$/g, '').replace(/\s/g, '');
  if (t === '' || t === '-') return 0;

  let negativo = false;
  if (t.startsWith('(') && t.endsWith(')')) {
    negativo = true;
    t = t.slice(1, -1);
  }
  if (t.endsWith('-')) {
    negativo = true;
    t = t.slice(0, -1);
  }
  if (t.startsWith('-')) {
    negativo = !negativo;
    t = t.slice(1);
  }
  if (!/^[\d.]*(,\d+)?$/.test(t) || t === '') return NaN;

  const valor = Number(t.replace(/\./g, '').replace(',', '.'));
  return negativo ? -valor : valor;
}
