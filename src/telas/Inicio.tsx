import { Link } from 'react-router-dom';
import { podeVer } from '../dados/permissoes';
import { useAuth } from '../estado/AuthContext';

const OPCOES = [
  {
    para: '/clientes',
    tela: 'visao-geral' as const,
    icone: '👥',
    titulo: 'Clientes e vendedores',
    texto: 'Faturamento, ranking de clientes, quem deixou de comprar, quem comprou mais ou menos e as metas dos vendedores.',
  },
  {
    para: '/produtos/visao',
    tela: 'produtos-visao' as const,
    icone: '📦',
    titulo: 'Produtos',
    texto: 'Itens vendidos, ranking de produtos, produtos que pararam de vender, quem vendeu mais ou menos e balcão x oficina.',
  },
];

/** Tela inicial: escolhe qual relatório abrir. */
export function Inicio() {
  const { perfil } = useAuth();
  return (
    <div className="mx-auto max-w-4xl py-6">
      <h1 className="text-2xl sm:text-3xl">Qual relatório você quer ver?</h1>
      <p className="mt-1 text-sm text-gray-500">Dá para trocar a qualquer momento pelo menu.</p>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {OPCOES.filter((o) => podeVer(o.tela, perfil)).map((o) => (
          <Link
            key={o.para}
            to={o.para}
            className="group flex flex-col rounded-card border-t-4 border-evaldo-amarelo bg-white p-6 shadow-card transition hover:-translate-y-1"
          >
            <span className="text-4xl">{o.icone}</span>
            <span className="mt-3 text-xl font-extrabold text-evaldo-azul-escuro group-hover:underline">{o.titulo}</span>
            <span className="mt-2 text-sm text-gray-600">{o.texto}</span>
            <span className="mt-5 font-semibold text-evaldo-azul">Abrir →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
