
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

// Função para notificar o usuário sobre a atualização
function notifyUpdate() {
    if (Notification.permission === 'granted') {
        new Notification('Nova Atualização Disponível!', {
            body: 'O Relp Cell foi atualizado com novas funções. Toque para recarregar.',
            icon: 'https://placehold.co/192x192/4f46e5/ffffff.png?text=Relp',
            tag: 'app-update'
        });
    }
}

// Service Worker Registration for PWA & Updates
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Solicita permissão de notificação logo no início para garantir
    if (Notification.permission === 'default') {
        Notification.requestPermission();
    }

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('SW registrado com sucesso! Escopo:', registration.scope);

        // Detecta se há uma atualização esperando
        if (registration.waiting) {
           notifyUpdate();
        }

        // Ouve mudanças no controlador (SW ativado)
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
        });

        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // Nova atualização disponível
                  console.log('Nova versão disponível.');
                  notifyUpdate();
                } else {
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
