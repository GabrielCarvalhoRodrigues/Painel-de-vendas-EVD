import type { ReactElement } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './componentes/Layout';
import { podeEntrar, podeVer, type Tela } from './dados/permissoes';
import { configurado } from './dados/supabase';
import { AuthProvider, useAuth } from './estado/AuthContext';
import { PainelProvider } from './estado/PainelContext';
import { ProdutosProvider } from './estado/ProdutosContext';
import { FichaProduto } from './telas/FichaProduto';
import { Inicio } from './telas/Inicio';
import { ProdutosPararam } from './telas/ProdutosPararam';
import { ProdutosVariacao } from './telas/ProdutosVariacao';
import { ProdutosVisaoGeral } from './telas/ProdutosVisaoGeral';
import { DadosLocais } from './telas/DadosLocais';
import { DeixaramDeComprar } from './telas/DeixaramDeComprar';
import { FichaCliente } from './telas/FichaCliente';
import { Importar } from './telas/Importar';
import { ImportarProdutos } from './telas/ImportarProdutos';
import { Veiculos } from './telas/Veiculos';
import { Login, NovaSenha, SemAcesso, TelaAcesso, TelaCarregando, TelaErro } from './telas/Login';
import { Produtos } from './telas/Produtos';
import { Ranking } from './telas/Ranking';
import { Variacao } from './telas/Variacao';
import { Vendedores } from './telas/Vendedores';
import { VisaoGeral } from './telas/VisaoGeral';

export default function App() {
  if (!configurado) {
    return (
      <TelaAcesso titulo="Falta configurar">
        <p className="text-sm text-gray-600">
          Preencha o arquivo <code>.env</code> com a URL e a chave anon do Supabase (veja o <code>.env.example</code> e o README) e gere o
          painel de novo.
        </p>
      </TelaAcesso>
    );
  }
  return (
    <AuthProvider>
      <Portao />
    </AuthProvider>
  );
}

/** Decide o que mostrar: login, troca de senha, sem acesso ou o painel. */
function Portao() {
  const { carregando, sessao, perfil, erro, trocandoSenha, tentarDeNovo } = useAuth();

  if (trocandoSenha && !carregando) return <NovaSenha />;
  if (carregando) return <TelaCarregando />;
  if (!sessao) return <Login />;
  if (erro) return <TelaErro titulo="Não foi possível entrar" texto={erro} acao={tentarDeNovo} />;
  if (!podeEntrar(perfil)) return <SemAcesso />;

  return (
    <PainelProvider>
      <ProdutosProvider>
        <Rotas />
      </ProdutosProvider>
    </PainelProvider>
  );
}

function Rotas() {
  const { perfil } = useAuth();
  const so = (tela: Tela, elemento: ReactElement) => (podeVer(tela, perfil) ? elemento : <Navigate to="/" replace />);

  return (
    // HashRouter: funciona em qualquer hospedagem estática (GitHub Pages), sem configurar o servidor.
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Inicio />} />
          <Route path="clientes" element={so('visao-geral', <VisaoGeral />)} />
          <Route path="ranking" element={so('ranking', <Ranking />)} />
          <Route path="deixaram" element={so('deixaram', <DeixaramDeComprar />)} />
          <Route path="variacao" element={so('variacao', <Variacao />)} />
          <Route path="produtos" element={so('produtos', <Produtos />)} />
          <Route path="produtos/visao" element={so('produtos-visao', <ProdutosVisaoGeral />)} />
          <Route path="produtos/pararam" element={so('produtos-pararam', <ProdutosPararam />)} />
          <Route path="produtos/variacao" element={so('produtos-variacao', <ProdutosVariacao />)} />
          <Route path="produtos/veiculos" element={so('produtos-veiculos', <Veiculos />)} />
          <Route path="produto/:codigo" element={so('produto', <FichaProduto />)} />
          <Route path="cliente/:codigo" element={so('cliente', <FichaCliente />)} />
          <Route path="vendedores" element={so('vendedores', <Vendedores />)} />
          <Route path="importar" element={so('importar', <Importar />)} />
          <Route path="importar-produtos" element={so('importar-produtos', <ImportarProdutos />)} />
          <Route path="dados-locais" element={so('dados-locais', <DadosLocais />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
