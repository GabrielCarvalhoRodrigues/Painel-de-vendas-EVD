import type { Mes } from '../tipos';

const NOMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function partes(mes: Mes): [number, number] {
  const [a, m] = mes.split('-').map(Number);
  return [a, m];
}

export function mesDeData(dataIso: string): Mes {
  return dataIso.slice(0, 7);
}

export function somarMeses(mes: Mes, n: number): Mes {
  const [a, m] = partes(mes);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

export function mesAnterior(mes: Mes): Mes {
  return somarMeses(mes, -1);
}

/** Quantos meses de `de` até `ate` (ate - de). */
export function diferencaMeses(de: Mes, ate: Mes): number {
  const [a1, m1] = partes(de);
  const [a2, m2] = partes(ate);
  return (a2 - a1) * 12 + (m2 - m1);
}

export function ultimoDiaDoMes(mes: Mes): number {
  const [a, m] = partes(mes);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

/** "outubro/2026" */
export function nomeMes(mes: Mes): string {
  const [a, m] = partes(mes);
  return `${NOMES[m - 1]}/${a}`;
}

/** "out/26" */
export function nomeMesCurto(mes: Mes): string {
  const [a, m] = partes(mes);
  return `${CURTOS[m - 1]}/${String(a).slice(2)}`;
}
