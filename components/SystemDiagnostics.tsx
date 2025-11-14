import React, { useState, useEffect } from 'react';

interface DiagnosticItem {
  name: string;
  status: 'checking' | 'success' | 'error' | 'warning';
  message: string;
  value?: string;
}

const SystemDiagnostics: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [pwaInstallable, setPwaInstallable] = useState(false);
  const [pwaInstalled, setPwaInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    runDiagnostics();
    checkPWAStatus();
  }, []);

  const checkPWAStatus = () => {
    // Verificar se já está instalado
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setPwaInstalled(true);
    }

    // Listener para evento de instalação
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setPwaInstallable(true);
    });

    // Listener para quando o app é instalado
    window.addEventListener('appinstalled', () => {
      setPwaInstalled(true);
      setPwaInstallable(false);
    });
  };

  const installPWA = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setPwaInstallable(false);
    }
    
    setDeferredPrompt(null);
  };

  const runDiagnostics = async () => {
    const results: DiagnosticItem[] = [];

    // 1. Verificar API Config
    results.push({
      name: 'API Config',
      status: 'checking',
      message: 'Verificando...',
    });

    try {
      const response = await fetch('/api/config');
      const config = await response.json();

      // Verificar Supabase
      results.push({
        name: 'Supabase URL',
        status: config.supabaseUrl ? 'success' : 'error',
        message: config.supabaseUrl ? 'Configurado' : 'Não configurado',
        value: config.supabaseUrl ? '✓' : '✗',
      });

      results.push({
        name: 'Supabase Anon Key',
        status: config.supabaseAnonKey ? 'success' : 'error',
        message: config.supabaseAnonKey ? 'Configurado' : 'Não configurado',
        value: config.supabaseAnonKey ? '✓' : '✗',
      });

      // Verificar Mercado Pago
      results.push({
        name: 'Mercado Pago Public Key',
        status: config.mercadoPagoPublicKey ? 'success' : 'error',
        message: config.mercadoPagoPublicKey 
          ? 'Configurado e ativo' 
          : 'NÃO CONFIGURADO - Boleto e Cartão não funcionarão',
        value: config.mercadoPagoPublicKey 
          ? `${config.mercadoPagoPublicKey.substring(0, 20)}...` 
          : '✗',
      });

      // Verificar Gemini
      results.push({
        name: 'Gemini API Key',
        status: config.geminiApiKey ? 'success' : 'warning',
        message: config.geminiApiKey ? 'Configurado' : 'Não configurado',
        value: config.geminiApiKey ? '✓' : '✗',
      });

      // Atualizar status da API Config
      results[0] = {
        name: 'API Config',
        status: 'success',
        message: 'Endpoint funcionando',
      };

    } catch (error) {
      results[0] = {
        name: 'API Config',
        status: 'error',
        message: 'Falha ao conectar',
      };
    }

    // 2. Verificar Service Worker
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        results.push({
          name: 'Service Worker',
          status: registration ? 'success' : 'warning',
          message: registration ? 'Ativo' : 'Não registrado',
        });
      } catch (error) {
        results.push({
          name: 'Service Worker',
          status: 'error',
          message: 'Erro ao verificar',
        });
      }
    } else {
      results.push({
        name: 'Service Worker',
        status: 'error',
        message: 'Não suportado',
      });
    }

    // 3. Verificar conexão
    results.push({
      name: 'Conexão',
      status: navigator.onLine ? 'success' : 'error',
      message: navigator.onLine ? 'Online' : 'Offline',
    });

    setDiagnostics(results);
  };

  const getStatusIcon = (status: DiagnosticItem['status']) => {
    switch (status) {
      case 'success':
        return (
          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'checking':
        return (
          <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        );
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="mt-4 w-full flex justify-center items-center py-2 px-4 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Diagnóstico do Sistema
      </button>
    );
  }

  return (
    <div className="mt-4 w-full border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-900">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Diagnóstico do Sistema
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-3">
        {diagnostics.map((item, index) => (
          <div
            key={index}
            className="flex items-start space-x-3 p-3 bg-white dark:bg-slate-800 rounded-lg"
          >
            <div className="flex-shrink-0 mt-0.5">
              {getStatusIcon(item.status)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {item.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {item.message}
              </p>
              {item.value && (
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 font-mono">
                  {item.value}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* PWA Section */}
      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
          Progressive Web App (PWA)
        </h4>
        
        {pwaInstalled ? (
          <div className="flex items-center space-x-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-green-700 dark:text-green-300">
              App instalado como PWA
            </span>
          </div>
        ) : pwaInstallable ? (
          <button
            onClick={installPWA}
            className="w-full flex justify-center items-center py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Instalar App
          </button>
        ) : (
          <div className="flex items-center space-x-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-blue-700 dark:text-blue-300">
              PWA disponível no navegador
            </span>
          </div>
        )}
      </div>

      <button
        onClick={runDiagnostics}
        className="mt-4 w-full flex justify-center items-center py-2 px-4 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Atualizar Diagnóstico
      </button>
    </div>
  );
};

export default SystemDiagnostics;
