import React, { useState, useEffect } from 'react';
import { supabase } from '../services/clients';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

const ResetPasswordPage: React.FC = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Verifica se o usuário chegou aqui autenticado (via link mágico do email)
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage({ text: 'Link inválido ou expirado. Solicite uma nova recuperação.', type: 'error' });
      }
    };
    checkSession();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ text: 'As senhas não coincidem.', type: 'error' });
      return;
    }
    if (newPassword.length < 6) {
        setMessage({ text: 'A senha deve ter pelo menos 6 caracteres.', type: 'error' });
        return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      setIsSuccess(true);
      setMessage({ text: 'Sua senha foi alterada com sucesso!', type: 'success' });
      
      // Redireciona para a home após 3 segundos
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);

    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-4 overflow-hidden bg-slate-100 dark:bg-[#0f172a] font-sans transition-colors duration-500">
      
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse mix-blend-multiply dark:mix-blend-screen"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl animate-pulse mix-blend-multiply dark:mix-blend-screen" style={{animationDelay: '2s'}}></div>
      </div>

      <div className="relative w-full max-w-md z-10 my-auto">
        
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-slate-700/50 p-8 transition-all duration-500 flex flex-col relative overflow-hidden">
          
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

          <div className="mb-6 text-center">
              <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Nova Senha
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
                Digite sua nova senha abaixo para recuperar o acesso à sua conta.
              </p>
          </div>
          
          {message && <div className="mb-4"><Alert message={message.text} type={message.type} /></div>}

          {!isSuccess && (
              <form onSubmit={handleReset} className="space-y-5">
                <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 ml-1 mb-1.5 tracking-wider">Nova Senha</label>
                    <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="block w-full pl-4 pr-4 py-3.5 border border-white/20 rounded-xl bg-white/5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all backdrop-blur-sm text-sm font-medium hover:bg-white/10"
                        placeholder="••••••••"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 ml-1 mb-1.5 tracking-wider">Confirmar Senha</label>
                    <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="block w-full pl-4 pr-4 py-3.5 border border-white/20 rounded-xl bg-white/5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all backdrop-blur-sm text-sm font-medium hover:bg-white/10"
                        placeholder="••••••••"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-xl shadow-lg shadow-indigo-500/40 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                >
                    {loading ? <LoadingSpinner /> : 'Redefinir Senha'}
                </button>
              </form>
          )}

          {isSuccess && (
             <div className="text-center">
                 <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Redirecionando para o login...</p>
                 <button onClick={() => window.location.href = '/'} className="text-indigo-600 hover:underline font-bold">Ir para Login agora</button>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;