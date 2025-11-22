
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Service Worker Registration for PWA & Updates
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('SW registrado com sucesso! Escopo:', registration.scope);

        // Detecta se há uma atualização esperando
        if (registration.waiting) {
           notifyUpdate();
        }

        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // Novo conteúdo disponível; por favor, atualize.
                  notifyUpdate();
                } else {
                  // Conteúdo em cache para uso offline.
                  console.log('Conteúdo em cache para uso offline.');
                }
              }
            };
          }
        };
      })
      .catch((err) => console.log('Erro ao registrar SW:', err));
  });
}

// Função para notificar o usuário sobre a atualização
function notifyUpdate() {
    // Verifica permissão para notificação nativa
    if (Notification.permission === 'granted') {
        new Notification('Nova Atualização Disponível!', {
            body: 'Uma nova versão do Relp Cell foi instalada. Toque para atualizar.',
            icon: '/icon-192.png' // Ajuste conforme necessário
        });
    }
    
    // Também pode exibir um toast ou recarregar a página automaticamente se preferir
    // window.location.reload();
}
