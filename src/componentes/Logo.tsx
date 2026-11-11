import { useState } from 'react';
import logoEvaldo from '../assets/logo-evaldo.png';

/** Logo em src/assets/logo-evaldo.png (embutida no build); se falhar, mostra o nome em texto. */
export function Logo({ className = '', claro = true, pequeno = false }: { className?: string; claro?: boolean; pequeno?: boolean }) {
  const [semImagem, setSemImagem] = useState(false);
  if (semImagem) {
    return (
      <div className="leading-none">
        <div className={`${pequeno ? 'text-lg' : 'text-2xl'} font-extrabold italic ${claro ? 'text-white' : 'text-evaldo-azul'}`}>EVALDO</div>
        <div className={`${pequeno ? 'mt-0.5 text-[9px]' : 'mt-1 text-[11px]'} font-semibold uppercase tracking-widest ${claro ? 'text-evaldo-amarelo' : 'text-evaldo-azul-escuro'}`}>
          Peças & Serviços
        </div>
      </div>
    );
  }
  return (
    <img src={logoEvaldo} alt="Evaldo Peças & Serviços" className={`object-contain ${className}`} onError={() => setSemImagem(true)} />
  );
}
