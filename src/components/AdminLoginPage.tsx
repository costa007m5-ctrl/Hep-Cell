
import React, { useState } from 'react';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import Logo from './Logo';

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

        // O ID do administrador central no seu banco
        const ADMIN_USER_ID = '1da77e27-f1df-4e35-bcec-51dc2c5a9062';
        
        if (user?.id !== ADMIN_USER_ID) {
            await supabase.auth.signOut();
            throw new Error("Acesso negado. Apenas a conta administrativa principal pode acessar esta área.");
        }
        
        // Sinaliza login administrativo na sessão
        sessionStorage.setItem('isAdminLoggedIn', 'true');
        onLoginSuccess();

    } catch (err: any) {
        setError(err.message || 'Credenciais de administrador inválidas.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-100 dark:bg-slate-900 font-sans">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
            <div className="mb-4">
                <Logo className="h-20 w-20" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                Admin Relp
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Gestão de Crédito e Faturas</p>
        </div>
        
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl p-8 border border-white dark:border-slate-700">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="animate-fade-in">
                <Alert message={error} type="error" />
              </div>
            )}
            
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1 tracking-wider">E-mail Admin</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="admin@relpcell.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1 tracking-wider">Senha</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 disabled:opacity-50 transition-all active:scale-[0.98] flex justify-center"
            >
                {loading ? <LoadingSpinner /> : 'Entrar no Painel'}
            </button>
          </form>
          
           <p className="mt-8 text-center">
                <button onClick={onBackToCustomer} className="text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors">
                    &larr; Voltar para a loja
                </button>
            </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
