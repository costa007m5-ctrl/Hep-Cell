import React, { useState } from 'react';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

interface AdminLoginPageProps {
  onLoginSuccess: () => void;
  onBackToCustomer: () => void;
}

const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onLoginSuccess, onBackToCustomer }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
        const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (signInError) throw signInError;

        // IMPORTANTE: Este ID deve ser o mesmo usado nas políticas RLS do Supabase.
        // Substitua pelo ID do seu usuário administrador no Supabase Auth.
        // Você pode encontrar o ID em Authentication > Users na sua dashboard do Supabase.
        const ADMIN_USER_ID = '1da77e27-f1df-4e35-bcec-51dc2c5a9062';
        
        if (user?.id !== ADMIN_USER_ID) {
            await supabase.auth.signOut(); // Desloga o usuário não-admin
            throw new Error("Acesso negado. Esta conta não tem permissões de administrador.");
        }
        
        onLoginSuccess();

    } catch (err: any) {
        setError(err.message || 'Credenciais de administrador inválidas.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-100 dark:bg-slate-900">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Área do Administrador
            </h1>
            <p className="text-slate-500 dark:text-slate-400">Acesso restrito.</p>
        </div>
        
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="animate-fade-in">
                <Alert message={error} type="error" />
              </div>
            )}
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                E-mail do Administrador
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password"className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Senha
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-slate-800 transition-colors duration-200"
              >
                {loading ? <LoadingSpinner /> : 'Acessar'}
              </button>
            </div>
          </form>
           <p className="mt-6 text-center text-sm">
                <button onClick={onBackToCustomer} className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                &larr; Voltar para a área do cliente
                </button>
            </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
