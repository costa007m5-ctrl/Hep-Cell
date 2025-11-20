
import React, { useState, useRef } from 'react';
import { supabase } from '../services/clients';
import { updateProfile } from '../services/profileService';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

interface AuthPageProps {
  onAdminLoginClick?: () => void;
}

type AuthMode = 'login' | 'register' | 'recovery';

const AuthPage: React.FC<AuthPageProps> = ({ onAdminLoginClick }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register State
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [cep, setCep] = useState('');
  const [address, setAddress] = useState({
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: ''
  });
  const [loadingCep, setLoadingCep] = useState(false);

  const streetNumberRef = useRef<HTMLInputElement>(null);

  // Greeting logic
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  // Masks
  const maskCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const maskPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  };

  const maskCEP = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{3})\d+?$/, '$1');
  };

  const handleCepBlur = async () => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    setLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setAddress(prev => ({
          ...prev,
          street: data.logradouro,
          neighborhood: data.bairro,
          city: data.localidade,
          state: data.uf
        }));
        streetNumberRef.current?.focus();
      }
    } catch (error) {
      console.error("Erro ao buscar CEP", error);
    } finally {
      setLoadingCep(false);
    }
  };

  const handleAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'register') {
        // Validação básica
        if (!fullName || !cpf || !phone || !cep || !address.number) {
            throw new Error("Por favor, preencha todos os campos obrigatórios.");
        }

        const firstName = fullName.split(' ')[0];
        const lastName = fullName.split(' ').slice(1).join(' ');

        // 1. Criar usuário no Auth
        const { data, error } = await supabase.auth.signUp({ 
            email, 
            password,
            options: {
                data: {
                    first_name: firstName,
                    last_name: lastName,
                    cpf: cpf,
                    phone: phone
                }
            }
        });

        if (error) throw error;

        // 2. Se sucesso e temos usuário, atualizar tabela de perfil
        if (data.user) {
            try {
                await updateProfile({
                    id: data.user.id,
                    email: email,
                    first_name: firstName,
                    last_name: lastName,
                    identification_type: 'CPF',
                    identification_number: cpf,
                    zip_code: cep,
                    street_name: address.street,
                    street_number: address.number,
                    neighborhood: address.neighborhood,
                    city: address.city,
                    federal_unit: address.state
                });
            } catch (profileError) {
                console.error("Erro ao salvar perfil detalhado:", profileError);
                // Não bloqueia o fluxo, pois o Auth criou a conta
            }

            if (!data.session) {
                 setMessage({ text: 'Cadastro realizado! Verifique seu e-mail para confirmar.', type: 'success' });
                 setMode('login');
            }
        }

      } else if (mode === 'recovery') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/reset-password',
        });
        if (error) throw error;
        setMessage({ text: 'Email de recuperação enviado! Verifique sua caixa de entrada.', type: 'success' });
        setTimeout(() => setMode('login'), 3000);
      }
    } catch (error: any) {
      let errorMsg = error.message;
      if (errorMsg === 'Invalid login credentials') errorMsg = 'Email ou senha incorretos.';
      if (errorMsg.includes('already registered')) errorMsg = 'Este email já está cadastrado.';
      setMessage({ text: errorMsg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Input Style Class
  const inputClass = "block w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm";
  const labelClass = "block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 ml-1 mb-1";

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-4 overflow-hidden bg-slate-100 dark:bg-slate-900 font-sans">
      
      {/* Animated Background Blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-500/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 bg-purple-500/30 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>

      <div className="relative w-full max-w-md z-10 my-auto">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center justify-center mb-6 space-y-2">
            <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-indigo-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                Relp Cell
            </h1>
        </div>
        
        {/* Main Card */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-6 sm:p-8 transition-all duration-500 max-h-[80vh] flex flex-col">
          
          <div className="mb-6 flex-shrink-0">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                {mode === 'login' && `${getGreeting()}!`}
                {mode === 'register' && 'Criar Conta Completa'}
                {mode === 'recovery' && 'Recuperar Acesso'}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                {mode === 'login' && 'Entre para gerenciar suas faturas e compras.'}
                {mode === 'register' && 'Preencha seus dados para liberar seu crédito.'}
                {mode === 'recovery' && 'Digite seu email para receber um link de reset.'}
              </p>
          </div>
          
          <form onSubmit={handleAuth} className="space-y-4 flex-1 overflow-y-auto pr-1 custom-scrollbar">
            {message && (
              <div className="animate-fade-in sticky top-0 z-20">
                <Alert message={message.text} type={message.type} />
              </div>
            )}
            
            {/* === LOGIN FIELDS === */}
            <div className="space-y-4">
                <div>
                    <label className={labelClass}>Email</label>
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg>
                        </span>
                        <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={inputClass}
                        placeholder="nome@exemplo.com"
                        autoComplete="email"
                        />
                    </div>
                </div>

                {mode !== 'recovery' && (
                    <div className="animate-fade-in">
                        <div className="flex justify-between items-center ml-1 mb-1">
                            <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Senha</label>
                            {mode === 'login' && (
                                <button type="button" onClick={() => setMode('recovery')} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                                    ESQUECEU?
                                </button>
                            )}
                        </div>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            </span>
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={inputClass}
                                placeholder="••••••••"
                                autoComplete={mode === 'login' ? "current-password" : "new-password"}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                            >
                                {showPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a10.05 10.05 0 011.572-2.572m3.76-3.76a9.953 9.953 0 015.674-1.334c2.744 0 5.258.953 7.26 2.548m2.24 2.24a9.958 9.958 0 011.342 2.144c-1.274 4.057-5.064 7-9.542 7a9.97 9.97 0 01-2.347-.278M9.88 9.88a3 3 0 104.24 4.24" /></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* === REGISTER EXTRA FIELDS === */}
            {mode === 'register' && (
                <div className="space-y-4 pt-2 animate-fade-in">
                    <div className="h-px bg-slate-200 dark:bg-slate-700 w-full my-4"></div>
                    <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Dados Pessoais</p>
                    
                    <div>
                        <label className={labelClass}>Nome Completo</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            </span>
                            <input
                                type="text"
                                required
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className={inputClass}
                                placeholder="Nome e Sobrenome"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>CPF</label>
                            <input
                                type="text"
                                required
                                value={cpf}
                                onChange={(e) => setCpf(maskCPF(e.target.value))}
                                className={`${inputClass} px-3 pl-3`}
                                placeholder="000.000.000-00"
                                maxLength={14}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Telefone</label>
                            <input
                                type="tel"
                                required
                                value={phone}
                                onChange={(e) => setPhone(maskPhone(e.target.value))}
                                className={`${inputClass} px-3 pl-3`}
                                placeholder="(00) 00000-0000"
                                maxLength={15}
                            />
                        </div>
                    </div>

                    <div className="h-px bg-slate-200 dark:bg-slate-700 w-full my-4"></div>
                    <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Endereço</p>

                    <div>
                        <label className={labelClass}>CEP</label>
                        <div className="relative">
                            <input
                                type="text"
                                required
                                value={cep}
                                onChange={(e) => setCep(maskCEP(e.target.value))}
                                onBlur={handleCepBlur}
                                className={`${inputClass} px-3 pl-3`}
                                placeholder="00000-000"
                                maxLength={9}
                            />
                            {loadingCep && (
                                <div className="absolute right-3 top-3">
                                    <LoadingSpinner />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                            <label className={labelClass}>Rua</label>
                            <input
                                type="text"
                                required
                                value={address.street}
                                onChange={(e) => setAddress({...address, street: e.target.value})}
                                className={`${inputClass} px-3 pl-3`}
                                placeholder="Logradouro"
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Número</label>
                            <input
                                type="text"
                                required
                                ref={streetNumberRef}
                                value={address.number}
                                onChange={(e) => setAddress({...address, number: e.target.value})}
                                className={`${inputClass} px-3 pl-3`}
                                placeholder="Nº"
                            />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Bairro</label>
                        <input
                            type="text"
                            required
                            value={address.neighborhood}
                            onChange={(e) => setAddress({...address, neighborhood: e.target.value})}
                            className={`${inputClass} px-3 pl-3`}
                            placeholder="Bairro"
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                            <label className={labelClass}>Cidade</label>
                            <input
                                type="text"
                                required
                                value={address.city}
                                onChange={(e) => setAddress({...address, city: e.target.value})}
                                className={`${inputClass} px-3 pl-3`}
                                placeholder="Cidade"
                            />
                        </div>
                        <div>
                            <label className={labelClass}>UF</label>
                            <input
                                type="text"
                                required
                                value={address.state}
                                onChange={(e) => setAddress({...address, state: e.target.value})}
                                className={`${inputClass} px-3 pl-3`}
                                placeholder="UF"
                                maxLength={2}
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="pt-2 flex-shrink-0">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-indigo-500/30 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {loading ? <LoadingSpinner /> : (
                    mode === 'login' ? 'Entrar na Conta' : 
                    mode === 'register' ? 'Finalizar Cadastro' : 
                    'Enviar Link de Recuperação'
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center flex-shrink-0">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {mode === 'login' ? 'Ainda não tem conta?' : 'Já tem uma conta?'}
              <button 
                onClick={() => {
                    setMessage(null);
                    if (mode === 'recovery') setMode('login');
                    else setMode(mode === 'login' ? 'register' : 'login');
                }} 
                className="ml-2 font-bold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
              >
                {mode === 'login' ? 'Cadastre-se' : 'Fazer Login'}
              </button>
            </p>
          </div>
        </div>
        
        {onAdminLoginClick && (
            <div className="mt-8 text-center">
                <button onClick={onAdminLoginClick} className="text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors flex items-center justify-center gap-1 mx-auto">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    Área Administrativa
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default AuthPage;
