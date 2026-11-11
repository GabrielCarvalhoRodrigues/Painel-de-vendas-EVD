import { toBlob } from 'html-to-image';
import { useEffect, useRef, useState } from 'react';
import type { Mes } from '../tipos';
import { dataBR, int, porcento, reais } from '../utils/formato';
import { nomeMes } from '../utils/meses';
import { Logo } from './Logo';

export interface DadosCard {
  vendedor: string;
  mes: Mes;
  parcial: boolean;
  ate?: string;
  meta: number | null;
  vendido: number;
  markup: number | null;
  devolucao: number;
  clientes: number;
  top3: { nome: string; valor: number }[];
}

const L = 1080;
const A = 1350;

/** Card de resultado do vendedor, em 1080×1350, para enviar no WhatsApp. */
function Card({ d }: { d: DadosCard }) {
  const pct = d.meta ? d.vendido / d.meta : null;
  const bateu = pct != null && pct >= 1;
  return (
    <div style={{ width: L, height: A, fontFamily: 'Montserrat, sans-serif' }} className="flex flex-col bg-fundo text-texto">
      <div className="relative bg-evaldo-azul-escuro px-16 pb-12 pt-12 text-white">
        <div className="flex items-center justify-between">
          <div className="rounded-2xl bg-white px-6 py-4">
            <Logo className="h-20 max-w-[320px]" claro={false} />
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold uppercase tracking-[0.2em] text-evaldo-amarelo">Resultado do mês</div>
            <div className="mt-1 text-4xl font-extrabold capitalize italic">{nomeMes(d.mes)}</div>
            {d.parcial && <div className="mt-2 text-xl text-white/80">parcial, até {d.ate ? dataBR(d.ate) : '—'}</div>}
          </div>
        </div>
        <div className="mt-10 text-2xl font-semibold uppercase tracking-widest text-white/70">Vendedor</div>
        <div className="text-7xl font-extrabold italic leading-tight">{d.vendedor}</div>
        <div className="absolute bottom-0 left-0 h-4 w-full bg-evaldo-amarelo" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-7 px-16 py-8">
        <div className="rounded-3xl bg-white p-10 shadow-card">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-2xl font-semibold uppercase tracking-wide text-gray-500">Vendido</div>
              <div className="text-7xl font-extrabold text-evaldo-azul-escuro">{reais(d.vendido)}</div>
            </div>
            {pct != null && (
              <div className={`rounded-2xl px-6 py-3 text-5xl font-extrabold ${bateu ? 'bg-evaldo-azul text-white' : 'bg-evaldo-amarelo text-evaldo-azul-escuro'}`}>
                {porcento(pct)}
              </div>
            )}
          </div>
          {d.meta ? (
            <>
              <div className="mt-8 h-8 overflow-hidden rounded-full bg-evaldo-azul-claro">
                <div className={`h-full rounded-full ${bateu ? 'bg-evaldo-azul' : 'bg-evaldo-amarelo'}`} style={{ width: `${Math.min(100, (pct ?? 0) * 100)}%` }} />
              </div>
              <div className="mt-4 flex justify-between text-2xl">
                <span className="text-gray-500">
                  Meta: <strong className="text-evaldo-azul-escuro">{reais(d.meta)}</strong>
                </span>
                <strong className={bateu ? 'text-evaldo-azul' : 'text-evaldo-azul-escuro'}>
                  {bateu ? '★ Meta batida!' : `Faltam ${reais(d.meta - d.vendido)}`}
                </strong>
              </div>
            </>
          ) : (
            <div className="mt-6 text-2xl text-gray-500">Meta não cadastrada</div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {[
            ['Markup', porcento(d.markup), 'text-evaldo-azul-escuro'],
            ['Devolução', reais(d.devolucao), d.devolucao > 0 ? 'text-evaldo-vermelho' : 'text-evaldo-azul-escuro'],
            ['Clientes', int(d.clientes), 'text-evaldo-azul-escuro'],
          ].map(([t, v, cor]) => (
            <div key={t} className="rounded-3xl border-t-8 border-evaldo-amarelo bg-white p-7 shadow-card">
              <div className="text-xl font-semibold uppercase tracking-wide text-gray-500">{t}</div>
              <div className={`mt-2 text-4xl font-extrabold ${cor}`}>{v}</div>
            </div>
          ))}
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-card">
          <div className="mb-4 text-2xl font-extrabold uppercase italic text-evaldo-azul-escuro">Top 3 clientes</div>
          {d.top3.length === 0 && <div className="text-2xl text-gray-500">Sem vendas no mês</div>}
          {d.top3.map((c, i) => (
            <div key={c.nome} className="flex items-center gap-5 border-b border-gray-100 py-3 last:border-0">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-evaldo-amarelo text-3xl font-extrabold text-evaldo-azul-escuro">
                {i + 1}º
              </div>
              <div className="min-w-0 flex-1 truncate text-3xl font-semibold">{c.nome}</div>
              <div className="text-3xl font-extrabold text-evaldo-azul-escuro">{reais(c.valor)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="shrink-0 bg-evaldo-azul py-5 text-center text-xl font-semibold tracking-wide text-white">Evaldo Peças & Serviços</div>
    </div>
  );
}

export function ModalCardWhatsApp({ dados, fechar }: { dados: DadosCard; fechar: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0.3);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const ajustar = () => {
      const largura = caixa.current?.clientWidth ?? 360;
      const altura = window.innerHeight - 220;
      setEscala(Math.min(largura / L, altura / A, 0.5));
    };
    ajustar();
    window.addEventListener('resize', ajustar);
    return () => window.removeEventListener('resize', ajustar);
  }, []);

  const nomeArquivo = `resultado-${dados.vendedor.toLowerCase().replace(/\s+/g, '-')}-${dados.mes}.png`;

  async function gerar(): Promise<Blob | null> {
    if (!ref.current) return null;
    const opcoes = { width: L, height: A, pixelRatio: 1, cacheBust: true };
    try {
      return await toBlob(ref.current, opcoes);
    } catch {
      // Se a fonte do Google não puder ser embutida, gera sem ela.
      return toBlob(ref.current, { ...opcoes, skipFonts: true });
    }
  }

  async function baixar() {
    setGerando(true);
    setErro('');
    try {
      const blob = await gerar();
      if (!blob) throw new Error('vazio');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeArquivo;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setErro('Não consegui gerar a imagem. Tente de novo.');
    } finally {
      setGerando(false);
    }
  }

  async function compartilhar() {
    setGerando(true);
    setErro('');
    try {
      const blob = await gerar();
      if (!blob) throw new Error('vazio');
      const arquivo = new File([blob], nomeArquivo, { type: 'image/png' });
      if (navigator.canShare?.({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], title: `Resultado ${dados.vendedor}` });
      } else {
        setErro('Este navegador não compartilha imagens direto. Use "Baixar PNG" e envie pelo WhatsApp.');
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setErro('Não consegui compartilhar a imagem.');
    } finally {
      setGerando(false);
    }
  }

  const podeCompartilhar = typeof navigator !== 'undefined' && 'canShare' in navigator;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={fechar}>
      <div className="card flex max-h-full w-full max-w-xl flex-col p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg">Card para WhatsApp</h2>
          <button className="text-2xl text-gray-400 hover:text-gray-700" onClick={fechar} aria-label="Fechar">
            ×
          </button>
        </div>
        <div ref={caixa} className="flex justify-center overflow-hidden">
          <div style={{ width: L * escala, height: A * escala }} className="overflow-hidden rounded-lg shadow-card">
            <div style={{ transform: `scale(${escala})`, transformOrigin: 'top left', width: L, height: A }}>
              <div ref={ref}>
                <Card d={dados} />
              </div>
            </div>
          </div>
        </div>
        {erro && <p className="mt-3 text-sm text-evaldo-vermelho">{erro}</p>}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {podeCompartilhar && (
            <button className="btn-whatsapp" onClick={compartilhar} disabled={gerando}>
              💬 Compartilhar
            </button>
          )}
          <button className="btn-primario" onClick={baixar} disabled={gerando}>
            {gerando ? 'Gerando…' : '⤓ Baixar PNG'}
          </button>
        </div>
      </div>
    </div>
  );
}
