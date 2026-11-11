/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Deixa o dist/index.html abrir com dois cliques (file://), sem servidor.
 * O navegador bloqueia <script type="module"> e "crossorigin" em arquivos locais,
 * então o JS é gerado como script comum (IIFE) e carregado com "defer".
 */
function abrirSemServidor(): Plugin {
  return {
    name: 'abrir-sem-servidor',
    apply: 'build',
    enforce: 'post',
    generateBundle(_opcoes, bundle) {
      const html = bundle['index.html'];
      if (!html || html.type !== 'asset') return;
      html.source = String(html.source)
        .replace(/<script type="module" crossorigin src="\.\//g, '<script defer src="./')
        .replace(/(<link rel="stylesheet") crossorigin (href="\.\/)/g, '$1 $2');
    },
  };
}

/** Separa os arquivos do build por linguagem: css/, js/ e img/. */
function pastaDoArquivo(nome: string): string {
  if (/\.css$/i.test(nome)) return 'css/painel.css';
  if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(nome)) return 'img/[name][extname]';
  if (/\.(woff2?|ttf|otf)$/i.test(nome)) return 'fontes/[name][extname]';
  return 'outros/[name][extname]';
}

export default defineConfig({
  plugins: [react(), abrirSemServidor()],
  base: './',
  build: {
    chunkSizeWarningLimit: 5000,
    cssCodeSplit: false,
    assetsInlineLimit: 0,
    modulePreload: false,
    rolldownOptions: {
      output: {
        format: 'iife',
        codeSplitting: false,
        entryFileNames: 'js/painel.js',
        assetFileNames: (info) => pastaDoArquivo(info.names?.[0] ?? ''),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
