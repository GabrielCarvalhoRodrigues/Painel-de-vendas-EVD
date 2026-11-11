# Painel de Vendas Evaldo

Painel comercial da **Evaldo Peças & Serviços**. Lê os relatórios **"VENDAS POR MARK-UP"** (sintético por cliente) exportados do ERP e mostra, por vendedor e por mês:

- **Visão geral**: faturamento, resultado, markup, clientes e ticket médio, comparados com o mês anterior.
- **Ranking do mês**: busca, ordenação e exportação para Excel.
- **Deixaram de comprar**: telefone, botão do WhatsApp, anotação e status do contato.
- **Comprou mais ou menos**: matriz cliente × mês.
- **Ficha do cliente**: evolução mês a mês.
- **Produtos do mês**: código, produto e quantidade vendida, com filtro **Vendas Balcão**, **Vendas oficina** e **TODOS**, aplicado também na exportação para Excel.
- **Vendedores e metas**: inclui o card de resultado em PNG para enviar no WhatsApp.

Os dados ficam no **Supabase** (banco Postgres + login). A equipe de gestão entra com e-mail e senha e vê as mesmas informações em qualquer computador ou celular. O site em si é estático e fica publicado no **GitHub Pages**.

```
Navegador  →  site (GitHub Pages)  →  dados e login (Supabase)
```

**Segurança:** o código do repositório é público, mas não contém nenhum dado. Sem login de um usuário da gestão, o banco não devolve nada, nem para quem tiver a chave pública do site (Row Level Security). A chave `service_role` do Supabase **nunca** vai para o código.

## 1. Criar o banco no Supabase

1. Em [supabase.com](https://supabase.com), clique em **New project**. Em **Region**, escolha **South America (São Paulo)**. Guarde a senha do banco num lugar seguro.
2. Aplique as migrations da pasta `supabase/migrations/`, **nesta ordem**:
   - `20261109000001_estrutura.sql`: tabelas, índices e histórico de contatos;
   - `20261109000002_seguranca.sql`: regras de acesso (RLS);
   - `20261109000003_importacao.sql`: funções de importação.

   Pelo navegador: **SQL Editor → New query**, cole o conteúdo de um arquivo, clique em **Run** e repita para o próximo.
   Pelo terminal (Supabase CLI): `supabase login`, depois `supabase link --project-ref SEU-PROJETO` e `supabase db push`.

Para recriar o banco do zero, basta aplicar as migrations de novo num projeto vazio.

### Tabelas

| Tabela | O que guarda |
|---|---|
| `perfis` | Um por usuário do login: nome, papel (`gestao` ou `vendedor`) e código do vendedor no ERP |
| `vendedores` | Código no ERP (ex.: `004`), nome e se está ativo |
| `clientes` | Código no ERP (texto, com zeros), nome, telefone, anotação atual, status do contato e último vendedor |
| `relatorios_importados` | Um relatório "VENDAS POR MARK-UP" por vendedor e mês: período, se é parcial, arquivo, quem importou e quando |
| `vendas_cliente_mes` | Uma linha por cliente × vendedor × mês: prazo médio, qtd. de vendas, itens, valor, custo e resultado |
| `metas` | Meta de faturamento por vendedor e mês |
| `contatos_clientes` | Histórico de status e anotações, com data e autor (preenchido sozinho) |
| `relatorios_produtos` / `vendas_produto_mes` | Relatório de produtos vendidos, por vendedor, mês e canal (balcão/oficina) |

Valores em dinheiro ficam em `numeric(14,2)`. Reimportar o mesmo vendedor e mês substitui as linhas **numa operação só**: se der erro no meio, nada muda.

## 2. Criar os usuários da gestão

1. **Desative o cadastro aberto:** em **Authentication → Sign In / Providers**, desligue **Allow new users to sign up**. Assim só você cria usuários.
2. Em **Authentication → Users → Add user → Create new user**, informe e-mail e senha forte e marque **Auto Confirm User**.
3. Copie o **UID** do usuário criado e, no **SQL Editor**, rode:

   ```sql
   insert into public.perfis (id, nome, papel)
   values ('COLE-O-UID-AQUI', 'Nome da Pessoa', 'gestao');
   ```

Usuário sem perfil consegue entrar, mas vê a mensagem "Sem acesso" e não lê nenhum dado.

Para **tirar o acesso** de alguém: apague o usuário em **Authentication → Users** (o perfil é apagado junto).

## 3. Preencher o `.env`

Copie `.env.example` para `.env` e preencha com os dados de **Project Settings → API**:

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

Use **somente** a chave anon/publishable. O `.env` não vai para o GitHub (está no `.gitignore`).

## 4. Rodar no computador

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo.

```bash
npm install
npm run dev
```

Abra o endereço que aparecer no terminal (normalmente http://localhost:5173) e entre com o usuário da gestão.

Para testar sem dados reais, vá em **Importar relatórios** e arraste os arquivos da pasta `exemplos/`: um relatório de vendas (outubro parcial de um vendedor) e um de produtos vendidos. Os nomes de vendedores, clientes e placas são inventados.

### Dados que ficaram no navegador (versão antiga)

A versão anterior do painel guardava os dados no navegador. Se o painel encontrar esses dados, aparece no menu o item **Enviar dados locais**. Ele mostra o que foi encontrado, envia para o banco sem duplicar (relatórios e metas que já estão no banco não são trocados) e, só depois do envio, oferece apagar a cópia local.

Abra o painel **no mesmo navegador e do mesmo jeito** que você usava antes. Os dados de `http://localhost:5173` e os do `index.html` aberto com dois cliques ficam guardados separados. Se for mais fácil, basta reimportar os CSVs.

## 5. Publicar no GitHub Pages

1. Crie um repositório no GitHub e envie o projeto. O mais fácil é usar o [GitHub Desktop](https://desktop.github.com), que respeita o `.gitignore`.
   ⚠️ **Não envie** as pastas `node_modules/` e `dist/` nem o arquivo `.env`. Pelo upload do site do GitHub, o `.gitignore` **não** é respeitado: escolha os arquivos manualmente.
2. No repositório, vá em **Settings → Secrets and variables → Actions → New repository secret** e crie:
   - `VITE_SUPABASE_URL`, com a URL do projeto;
   - `VITE_SUPABASE_ANON_KEY`, com a chave anon/publishable.
3. Em **Settings → Pages → Build and deployment → Source**, escolha **GitHub Actions**.
4. A cada envio para a branch `main`, o GitHub roda os testes, gera o painel e publica (aba **Actions**). O endereço fica assim: `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.
5. No Supabase, vá em **Authentication → URL Configuration**:
   - **Site URL**: o endereço do GitHub Pages;
   - **Redirect URLs**: o mesmo endereço e `http://localhost:5173/` (para testar no computador).

   Sem isso, o link do "esqueci minha senha" não volta para o painel.

O plano gratuito do Supabase **pausa o projeto depois de 7 dias sem uso**. Para reativar, abra o projeto no painel do Supabase (os dados não se perdem).

### Gerar a versão sem o GitHub

```bash
npm run build
```

O resultado fica na pasta `dist/` (`index.html`, `css/`, `js/`, `img/`) e serve em qualquer hospedagem estática. As telas usam endereços com `#` (ex.: `/#/ranking`), então não é preciso configurar o servidor. O `index.html` também abre com dois cliques, mas nesse modo o "esqueci minha senha" não funciona, porque o link do e-mail precisa de um endereço `http(s)`.

## 6. Liberar o acesso de um vendedor (futuro)

Hoje só a gestão entra. Para liberar um vendedor, que verá **apenas os próprios dados**:

1. **Banco:** crie uma nova migration (ex.: `supabase/migrations/20270101000001_acesso_vendedor.sql`) com o bloco comentado no final de `20261109000002_seguranca.sql` (sem os `--`) e aplique.
2. **Painel:** em `src/dados/permissoes.ts`, troque `VENDEDOR_LIBERADO` para `true`. As telas listadas em `SO_GESTAO` (vendedores e metas, importações, custo e markup) somem para o vendedor. Ajuste essa lista se decidir mostrar mais ou menos.
3. **Usuário:** crie o usuário em **Authentication → Users** e o perfil com o código dele no ERP:

   ```sql
   insert into public.perfis (id, nome, papel, vendedor_codigo)
   values ('UID-DO-VENDEDOR', 'Nome do Vendedor', 'vendedor', '004');
   ```

4. Entre com esse usuário e confira se ele vê só os próprios clientes e vendas.

## Testes

```bash
npm test
```

Os testes cobrem:

- a leitura do CSV em Windows-1252, a conversão dos números brasileiros e a extração de vendedor e período do cabeçalho;
- as regras de situação do cliente;
- **o banco** (`banco.test.ts`): as migrations rodam num Postgres de teste e conferem a importação, a reimportação substituindo o mesmo período, a operação "tudo ou nada" e o **bloqueio sem login** (não logado não lê nenhuma tabela; logado sem perfil vê tudo vazio);
- a camada de dados (o que é enviado ao Supabase e as mensagens de erro em português);
- o envio dos dados locais;
- **no Supabase real** (`supabase-real.test.ts`, só com o `.env` preenchido): confere que nenhuma tabela responde sem login. Se ele falhar com "tabela não encontrada", as migrations ainda não foram aplicadas.

## Logo

A logo fica em `src/assets/logo-evaldo.png` e também é usada como ícone da aba do navegador. Para trocar, substitua esse arquivo e rode `npm run build`.

## Como exportar o relatório no ERP

- Relatório: **VENDAS POR MARK-UP**, tipo **SINTÉTICO**, agrupado por **CLIENTE**.
- **Um arquivo por vendedor e por mês**, do dia 1 ao último dia. Se o período terminar antes do fim do mês, o mês fica marcado como **parcial**.
- Ao reenviar o mês atual atualizado, o painel pergunta se deve **substituir** o relatório anterior. Telefones, anotações e status de contato dos clientes são mantidos.

### Relatório de produtos vendidos (aba "Produtos do mês")

- Relatório do ERP: **MOVIMENTO DE CLIENTES**, tipo **ANALÍTICO**, um mês, todos os vendedores, em CSV.
- Importe na aba **Importar produtos** do menu.
- Colunas usadas: **VEN** (código do vendedor), **CÓD**, **DESCRIÇÃO**, **QTD**, **VR.TOTAL** e a coluna sem título com `VEÍCULO: … - ABC-1D23 - KM`.
- Os nomes dos vendedores vêm do cadastro do painel.
- Quando a linha tem placa, a venda conta como **Vendas oficina**. Sem placa, conta como **Vendas Balcão**.
- O período vem de `Data Inicial`/`Data Final` ou de uma coluna DATA. Pode ser o mês até o momento: nesse caso ele fica marcado como **parcial**.
- O arquivo pode trazer vários vendedores. O painel separa as vendas de cada um, e reenviar o mesmo mês substitui os dados anteriores.
- Exemplo: `exemplos/produtos-2026-10-parcial.csv`. Se o ERP usar outro título de coluna, acrescente-o em `NOMES_COLUNA`, em `src/importacao/lerProdutos.ts`.

## Regras usadas

| Regra | Definição |
|---|---|
| Comprou no mês | Valor total do mês maior que zero (só devolução não conta) |
| Markup | Resultado ÷ custo (recalculado, não usa a coluna do arquivo) |
| Ativo | Comprou no último mês e no anterior |
| Novo | A primeira compra no período importado foi no último mês |
| Voltou a comprar | Comprou no último mês, não no anterior, mas já tinha comprado antes |
| Deixou de comprar | Comprou em 2 meses ou mais e não comprou no último mês |
| Não voltou (1 compra) | Comprou uma única vez e não voltou |
| Queda forte | Comprou no mês, mas mais de 50% abaixo do mês anterior |
| Média mensal | Média dos meses fechados (o mês parcial fica de fora) |
| Balcão | "CLIENTE CONSUMIDOR" (00000011): aparece no ranking, mas não nas listas de "deixou de comprar" |

Com o filtro **Todos**, as vendas de um mesmo cliente com vendedores diferentes são somadas. Por isso, um cliente que trocou de vendedor não aparece como perdido no total da loja.

A **meta** de um vendedor vale para o mês em que foi cadastrada e continua valendo nos meses seguintes até ser alterada.

## Estrutura

```
src/
  dados/        único lugar que fala com o Supabase
    supabase.ts     conexão (URL e chave anon do .env)
    repositorio.ts  importarRelatorio, listarVendas, salvarMeta, salvarContato…
    auth.ts         login, sair, esqueci minha senha, perfil
    permissoes.ts   podeVer(tela): o que cada papel vê
    erros.ts        mensagens de erro em português
    dadosLocais.ts  envio dos dados da versão antiga (navegador)
  importacao/   leitura do CSV do ERP
  regras/       regras de negócio (situação, markup, metas)
  estado/       login, filtros e dados carregados
  componentes/  menu, filtros, tabelas, card do WhatsApp
  telas/        uma tela por arquivo (inclui Login)
  testes/       testes (Vitest)
supabase/migrations/   estrutura do banco, segurança (RLS) e importação
.github/workflows/     publicação automática no GitHub Pages
exemplos/       CSVs fictícios no formato do ERP
```
