import { useMemo, useState, type ReactNode } from 'react';

export interface Ordem<K extends string> {
  campo: K;
  desc: boolean;
}

/** Ordena a lista pela coluna clicada. `valores` diz como obter o valor de cada coluna. */
export function useOrdenacao<T, K extends string>(
  lista: T[],
  valores: Record<K, (item: T) => string | number | null>,
  inicial: Ordem<NoInfer<K>>,
) {
  const [ordem, setOrdem] = useState<Ordem<K>>(inicial);
  const ordenada = useMemo(() => {
    const pegar = valores[ordem.campo];
    return [...lista].sort((a, b) => {
      const va = pegar(a);
      const vb = pegar(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const r = typeof va === 'string' ? va.localeCompare(String(vb), 'pt-BR') : va - (vb as number);
      return ordem.desc ? -r : r;
    });
  }, [lista, ordem]);

  // Texto começa em A→Z; números começam do maior para o menor.
  const alternar = (campo: K) =>
    setOrdem((o) =>
      o.campo === campo ? { campo, desc: !o.desc } : { campo, desc: !lista.length || typeof valores[campo](lista[0]) !== 'string' },
    );

  return { ordenada, ordem, alternar };
}

export function Th<K extends string>({
  campo,
  ordem,
  alternar,
  children,
  num = false,
}: {
  campo: K;
  ordem: Ordem<K>;
  alternar: (k: K) => void;
  children: ReactNode;
  num?: boolean;
}) {
  const ativo = ordem.campo === campo;
  return (
    <th className={`cursor-pointer select-none hover:bg-evaldo-azul-escuro ${num ? 'text-right' : ''}`} onClick={() => alternar(campo)}>
      {children}
      <span className={`ml-1 ${ativo ? 'text-evaldo-amarelo' : 'text-white/40'}`}>{ativo ? (ordem.desc ? '▼' : '▲') : '↕'}</span>
    </th>
  );
}
