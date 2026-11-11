import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { prepararSessao } from './dados/auth';
import { configurado } from './dados/supabase';
import './index.css';

// Lê o link do e-mail ("esqueci minha senha") antes de o roteador usar o "#" do endereço.
(configurado ? prepararSessao() : Promise.resolve()).finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
