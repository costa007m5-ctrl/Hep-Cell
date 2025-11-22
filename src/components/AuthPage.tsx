
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

  // Register State - Dados para Boleto
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
  const [passwordStrength, setPasswordStrength] = useState(0);

  const streetNumberRef = useRef<HTMLInputElement>(null);

  // Greeting logic based on time
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

  // Password Strength Checker
  const checkStrength = (pass: string) => {
    let score = 0;
    if (pass.length > 6) score++;
    if (pass.length > 10) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    setPasswordStrength(score);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPassword(val);
    if (mode === 'register') checkStrength(val);
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
        // Auto-focus no número após carregar endereço
        setTimeout(() => streetNumberRef.current?.focus(), 100);
      }
    } catch (error) {
      console.error("Erro ao buscar CEP", error);
    } finally {
      setLoadingCep(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Redireciona de volta para a origem da aplicação após o login
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (error) throw error;
    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
      setLoading(false);
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
        // Validação básica de cadastro
        if (!fullName || !cpf || !phone || !cep || !address.number) {
            throw new Error("Por favor, preencha todos os dados para emitirmos suas faturas corretamente.");
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

        // 2. Se sucesso e temos usuário, atualizar tabela de perfil (Dados de Boleto)
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
        setTimeout(() => setMode('login'), 5000);
      }
    } catch (error: any) {
      let errorMsg = error.message;
      if (errorMsg === 'Invalid login credentials') errorMsg = 'Email ou senha incorretos.';
      if (errorMsg.includes('already registered')) errorMsg = 'Este email já possui cadastro.';
      setMessage({ text: errorMsg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Styles
  const glassInput = "block w-full pl-10 pr-10 py-3.5 border border-white/20 rounded-xl bg-white/5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all backdrop-blur-sm text-sm font-medium hover:bg-white/10";
  const labelStyle = "block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 ml-1 mb-1.5 tracking-wider";

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-4 overflow-hidden bg-slate-100 dark:bg-[#0f172a] font-sans transition-colors duration-500">
      
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-pulse mix-blend-multiply dark:mix-blend-screen"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 bg-purple-600/20 rounded-full blur-3xl animate-pulse mix-blend-multiply dark:mix-blend-screen" style={{animationDelay: '2s'}}></div>
          <div className="absolute top-[40%] left-[30%] w-60 h-60 bg-pink-500/10 rounded-full blur-3xl animate-pulse mix-blend-multiply dark:mix-blend-screen" style={{animationDelay: '4s'}}></div>
      </div>

      <div className="relative w-full max-w-md z-10 my-auto">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center justify-center mb-8 space-y-3 animate-fade-in-up">
            <div className="p-3.5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-2xl shadow-indigo-500/10 border border-white/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            </div>
            <div className="text-center">
                <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                    Relp Cell
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Pagamentos & Loja</p>
            </div>
        </div>
        
        {/* Glass Card */}
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-slate-700/50 p-6 sm:p-8 transition-all duration-500 flex flex-col relative overflow-hidden">
          
          {/* Top Decoration Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

          <div className="mb-6 flex-shrink-0">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                {mode === 'login' && `${getGreeting()}!`}
                {mode === 'register' && 'Cadastro Completo'}
                {mode === 'recovery' && 'Recuperar Senha'}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                {mode === 'login' && 'Acesse para gerenciar suas faturas.'}
                {mode === 'register' && 'Preencha os dados para habilitar o crediário.'}
                {mode === 'recovery' && 'Enviaremos um link para seu email.'}
              </p>
          </div>
          
          <form onSubmit={handleAuth} className="space-y-5 flex-1 overflow-y-auto pr-1 custom-scrollbar max-h-[60vh]">
            {message && (
              <div className="animate-fade-in sticky top-0 z-20 mb-4">
                <Alert message={message.text} type={message.type} />
              </div>
            )}
            
            {/* === GOOGLE LOGIN (Top for convenience) === */}
            {(mode === 'login' || mode === 'register') && (
                <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3.5 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-all duration-200 group active:scale-[0.98]"
                >
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                         <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                         <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                         <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                         <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    <span className="text-slate-700 dark:text-slate-200 font-semibold group-hover:text-slate-900 dark:group-hover:text-white">Entrar com Google</span>
                </button>
            )}

            {(mode === 'login' || mode === 'register') && (
                <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                    <span className="flex-shrink-0 mx-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Ou via email</span>
                    <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                </div>
            )}

            {/* === EMAIL & PASSWORD === */}
            <div className="space-y-4">
                <div>
                    <label className={labelStyle}>Email</label>
                    <div className="relative group">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg>
                        </span>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={glassInput}
                            placeholder="seu@email.com"
                            autoComplete="email"
                        />
                    </div>
                </div>

                {mode !== 'recovery' && (
                    <div className="animate-fade-in">
                        <div className="flex justify-between items-center ml-1 mb-1.5">
                            <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Senha</label>
                            {mode === 'login' && (
                                <button type="button" onClick={() => setMode('recovery')} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 hover:underline">
                                    ESQUECEU?
                                </button>
                            )}
                        </div>
                        <div className="relative group">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            </span>
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                value={password}
                                onChange={handlePasswordChange}
                                className={glassInput}
                                placeholder="••••••••"
                                autoComplete={mode === 'login' ? "current-password" : "new-password"}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-indigo-500 cursor-pointer transition-colors"
                            >
                                {showPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a10.05 10.05 0 011.572-2.572m3.76-3.76a9.953 9.953 0 015.674-1.334c2.744 0 5.258.953 7.26 2.548m2.24 2.24a9.958 9.958 0 011.342 2.144c-1.274 4.057-5.064 7-9.542 7a9.97 9.97 0 01-2.347-.278M9.88 9.88a3 3 0 104.24 4.24" /></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                )}
                            </button>
                        </div>
                        
                        {/* Password Strength Indicator */}
                        {mode === 'register' && password.length > 0 && (
                            <div className="flex gap-1 mt-2 h-1">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className={`flex-1 rounded-full transition-all duration-300 ${i < passwordStrength ? (passwordStrength < 3 ? 'bg-red-500' : passwordStrength < 5 ? 'bg-yellow-500' : 'bg-green-500') : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* === BOLETO REGISTRATION FIELDS === */}
            {mode === 'register' && (
                <div className="space-y-4 pt-2 animate-fade-in">
                    <div className="h-px bg-slate-200 dark:bg-slate-700/50 w-full my-4"></div>
                    <p className="text-xs font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">Dados do Responsável</p>
                    
                    <div>
                        <label className={labelStyle}>Nome Completo</label>
                        <div className="relative group">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            </span>
                            <input
                                type="text"
                                required
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className={glassInput}
                                placeholder="Nome e Sobrenome"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelStyle}>CPF</label>
                            <input
                                type="text"
                                required
                                value={cpf}
                                onChange={(e) => setCpf(maskCPF(e.target.value))}
                                className={`${glassInput} pl-3.5`}
                                placeholder="000.000.000-00"
                                maxLength={14}
                            />
                        </div>
                        <div>
                            <label className={labelStyle}>Celular</label>
                            <input
                                type="tel"
                                required
                                value={phone}
                                onChange={(e) => setPhone(maskPhone(e.target.value))}
                                className={`${glassInput} pl-3.5`}
                                placeholder="(00) 00000-0000"
                                maxLength={15}
                            />
                        </div>
                    </div>

                    <div className="h-px bg-slate-200 dark:bg-slate-700/50 w-full my-4"></div>
                    <p className="text-xs font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">Endereço de Cobrança</p>

                    <div>
                        <label className={labelStyle}>CEP</label>
                        <div className="relative">
                            <input
                                type="text"
                                required
                                value={cep}
                                onChange={(e) => setCep(maskCEP(e.target.value))}
                                onBlur={handleCepBlur}
                                className={`${glassInput} pl-3.5`}
                                placeholder="00000-000"
                                maxLength={9}
                            />
                            {loadingCep && (
                                <div className="absolute right-3 top-3.5">
                                    <LoadingSpinner />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                            <label className={labelStyle}>Rua</label>
                            <input
                                type="text"
                                required
                                value={address.street}
                                onChange={(e) => setAddress({...address, street: e.target.value})}
                                className={`${glassInput} pl-3.5`}
                                placeholder="Logradouro"
                            />
                        </div>
                        <div>
                            <label className={labelStyle}>Número</label>
                            <input
                                type="text"
                                required
                                ref={streetNumberRef}
                                value={address.number}
                                onChange={(e) => setAddress({...address, number: e.target.value})}
                                className={`${glassInput} pl-3.5`}
                                placeholder="Nº"
                            />
                        </div>
                    </div>

                    <div>
                        <label className={labelStyle}>Bairro</label>
                        <input
                            type="text"
                            required
                            value={address.neighborhood}
                            onChange={(e) => setAddress({...address, neighborhood: e.target.value})}
                            className={`${glassInput} pl-3.5`}
                            placeholder="Bairro"
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                            <label className={labelStyle}>Cidade</label>
                            <input
                                type="text"
                                required
                                value={address.city}
                                onChange={(e) => setAddress({...address, city: e.target.value})}
                                className={`${glassInput} pl-3.5`}
                                placeholder="Cidade"
                            />
                        </div>
                        <div>
                            <label className={labelStyle}>UF</label>
                            <input
                                type="text"
                                required
                                value={address.state}
                                onChange={(e) => setAddress({...address, state: e.target.value})}
                                className={`${glassInput} pl-3.5`}
                                placeholder="UF"
                                maxLength={2}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* === SUBMIT BUTTON === */}
            <div className="pt-4 flex-shrink-0">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-xl shadow-lg shadow-indigo-500/40 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {loading ? <LoadingSpinner /> : (
                    mode === 'login' ? 'Entrar Agora' : 
                    mode === 'register' ? 'Finalizar Cadastro' : 
                    'Enviar Link'
                )}
              </button>
            </div>
          </form>

          {/* === FACE ID SIMULATION (Visual Only) === */}
          {mode === 'login' && (
             <div className="mt-4 flex justify-center">
                 <button className="p-2 text-slate-400 hover:text-indigo-500 dark:text-slate-500 dark:hover:text-indigo-400 transition-colors" title="Usar Biometria">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.131A8 8 0 008 8M6.218 7.113a3.993 3.993 0 00-.879 1.19c-.5 1.152-.75 2.398-.99 3.693m2.505 5.547l.09-.054" />
                    </svg>
                 </button>
             </div>
          )}

          <div className="mt-6 text-center flex-shrink-0">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {mode === 'login' ? 'Novo por aqui?' : 'Já tem conta?'}
              <button 
                onClick={() => {
                    setMessage(null);
                    if (mode === 'recovery') setMode('login');
                    else setMode(mode === 'login' ? 'register' : 'login');
                }} 
                className="ml-2 font-bold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors underline decoration-2 underline-offset-2"
              >
                {mode === 'login' ? 'Criar conta' : 'Fazer Login'}
              </button>
            </p>
          </div>
        </div>
        
        {onAdminLoginClick && (
            <div className="mt-8 text-center opacity-50 hover:opacity-100 transition-opacity">
                <button onClick={onAdminLoginClick} className="text-[10px] font-medium text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex items-center justify-center gap-1 mx-auto">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    Área Restrita
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default AuthPage;
