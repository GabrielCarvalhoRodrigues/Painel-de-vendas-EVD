import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { lerDadosLocais, resumir, temDadosLocais } from '../dados/dadosLocais';
import { ErroBanco } from '../dados/erros';
import { podeVer, type Tela } from '../dados/permissoes';
import { useAuth } from '../estado/AuthContext';
import { usePainel } from '../estado/PainelContext';
import { Logo } from './Logo';

type ItemMenu = { para: string; nome: string; icone: string; tela: Tela };
type Area = 'clientes' | 'produtos';

/** Cada relatório tem o seu menu. A tela inicial escolhe qual abrir. */
const AREAS: Record<Area, { nome: string; inicio: string; itens: ItemMenu[] }> = {
  clientes: {
    nome: 'Clientes',
    inicio: '/clientes',
    itens: [
      { para: '/clientes', nome: 'Visão geral', icone: '◧', tela: 'visao-geral' },
      { para: '/ranking', nome: 'Ranking do mês', icone: '★', tela: 'ranking' },
      { para: '/deixaram', nome: 'Deixaram de comprar', icone: '⚠', tela: 'deixaram' },
      { para: '/variacao', nome: 'Comprou mais ou menos', icone: '⇅', tela: 'variacao' },
      { para: '/vendedores', nome: 'Vendedores e metas', icone: '◎', tela: 'vendedores' },
      { para: '/importar', nome: 'Importar clientes', icone: '⇪', tela: 'importar' },
    ],
  },
  produtos: {
    nome: 'Produtos',
    inicio: '/produtos/visao',
    itens: [
      { para: '/produtos/visao', nome: 'Visão geral', icone: '◧', tela: 'produtos-visao' },
      { para: '/produtos', nome: 'Produtos do mês', icone: '▤', tela: 'produtos' },
      { para: '/produtos/pararam', nome: 'Pararam de vender', icone: '⚠', tela: 'produtos-pararam' },
      { para: '/produtos/variacao', nome: 'Vendeu mais ou menos', icone: '⇅', tela: 'produtos-variacao' },
      { para: '/produtos/veiculos', nome: 'Veículos', icone: '⛟', tela: 'produtos-veiculos' },
      { para: '/importar-produtos', nome: 'Importar produtos', icone: '⇪', tela: 'importar-produtos' },
    ],
  },
};

function areaDaRota(caminho: string): Area | null {
  if (caminho === '/' || caminho === '/dados-locais') return null;
  if (caminho.startsWith('/produto') || caminho === '/importar-produtos') return 'produtos';
  return 'clientes';
}

export function Layout() {
  const [aberto, setAberto] = useState(false);
  const local = useLocation();
  useEffect(() => setAberto(false), [local.pathname]);
  const { perfil, sessao, sair } = useAuth();
  const { carregando, erro, recarregar } = usePainel();
  const [aviso, setAviso] = useState('');
  const [temLocais, setTemLocais] = useState(false);

  // Erros do banco ao salvar (telefone, meta, importação…) aparecem numa faixa no topo.
  useEffect(() => {
    const aoFalhar = (ev: PromiseRejectionEvent) => {
      if (ev.reason instanceof ErroBanco) {
        ev.preventDefault();
        setAviso(ev.reason.message);
      }
    };
    window.addEventListener('unhandledrejection', aoFalhar);
    return () => window.removeEventListener('unhandledrejection', aoFalhar);
  }, []);

  // Mostra o item "Dados deste navegador" só se ainda houver dados da versão antiga.
  useEffect(() => {
    if (!podeVer('dados-locais', perfil)) return;
    lerDadosLocais().then((d) => setTemLocais(temDadosLocais(resumir(d))));
  }, [perfil, local.pathname]);

  const nome = perfil?.nome || sessao?.user.email || '';
  const area = areaDaRota(local.pathname);
  const menu: ItemMenu[] = [
    ...(area ? AREAS[area].itens.filter((m) => podeVer(m.tela, perfil)) : []),
    ...(temLocais ? [{ para: '/dados-locais', nome: 'Enviar dados locais', icone: '⇧', tela: 'dados-locais' as Tela }] : []),
  ];

  return (
    <div className="min-h-screen lg:flex">
      {/* Barra do topo no celular */}
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-evaldo-azul-escuro px-4 py-3 lg:hidden">
        <button
          className="rounded-md px-2 py-1 text-2xl leading-none text-white hover:bg-white/10"
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
        >
          ☰
        </button>
        <Logo className="h-8" pequeno />
        <span className="ml-auto max-w-[45%] truncate text-xs font-semibold text-white/85" title={nome}>
          👤 {nome}
        </span>
      </header>

      {aberto && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setAberto(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-evaldo-azul-escuro text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          aberto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-6">
          <Logo className="h-14 max-w-[180px]" />
          <button className="text-2xl text-white/70 lg:hidden" onClick={() => setAberto(false)} aria-label="Fechar menu">
            ×
          </button>
        </div>
        <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3 text-sm">
          <span className="min-w-0 flex-1 truncate font-semibold" title={sessao?.user.email}>
            👤 {nome}
          </span>
          <button className="rounded-md border border-white/30 px-2 py-1 text-xs font-semibold text-white/85 hover:bg-white/10" onClick={sair}>
            Sair
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                isActive ? 'bg-evaldo-amarelo text-evaldo-azul-escuro' : 'text-white/85 hover:bg-evaldo-azul'
              }`
            }
          >
            <span className="w-5 text-center text-base">⌂</span>
            Início
          </NavLink>

          <div className="py-2">
            <div className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-white/45">Relatório</div>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-white/10 p-1">
              {(Object.keys(AREAS) as Area[]).map((a) => (
                <Link
                  key={a}
                  to={AREAS[a].inicio}
                  className={`rounded-md px-2 py-1.5 text-center text-xs font-bold transition-colors ${
                    area === a ? 'bg-evaldo-amarelo text-evaldo-azul-escuro' : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  {AREAS[a].nome}
                </Link>
              ))}
            </div>
          </div>

          {menu.map((item) => (
            <NavLink
              key={item.para}
              to={item.para}
              end={item.para === '/produtos'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isActive ? 'bg-evaldo-amarelo text-evaldo-azul-escuro' : 'text-white/85 hover:bg-evaldo-azul'
                }`
              }
            >
              <span className="w-5 text-center text-base">{item.icone}</span>
              {item.nome}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 text-[11px] text-white/50">Painel de Vendas Evaldo</div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        {aviso && (
          <div role="alert" className="mb-4 flex items-start gap-3 rounded-lg border-l-4 border-evaldo-vermelho bg-evaldo-vermelho-claro px-4 py-3 text-sm">
            <span className="flex-1 font-semibold text-evaldo-vermelho">⚠ {aviso}</span>
            <button className="text-evaldo-vermelho/70 hover:text-evaldo-vermelho" onClick={() => setAviso('')} aria-label="Fechar aviso">
              ×
            </button>
          </div>
        )}
        {erro ? (
          <div className="card mx-auto mt-6 max-w-xl px-6 py-10 text-center">
            <h2 className="text-xl">Não foi possível carregar os dados</h2>
            <p className="mt-2 text-sm text-gray-600">{erro}</p>
            <button className="btn-primario mt-6" onClick={() => recarregar()}>
              Tentar novamente
            </button>
          </div>
        ) : carregando ? (
          <div className="flex items-center justify-center gap-3 py-20 text-sm text-gray-500">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-evaldo-azul/20 border-t-evaldo-azul" />
            Carregando dados do banco…
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
