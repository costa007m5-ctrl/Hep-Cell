import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Profile, Product } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import InputField from './InputField';
import jsPDF from 'jspdf';

// --- Types ---
type SaleStep = 'customer' | 'credit_check' | 'product_selection';
interface NewCustomerData { email: string; first_name: string; last_name: string; }

// --- Helper Components ---
const StepIndicator: React.FC<{ currentStep: number; totalSteps: number; stepLabels: string[] }> = ({ currentStep, totalSteps, stepLabels }) => (
    <nav aria-label="Progress">
        <ol role="list" className="flex items-center">
            {stepLabels.map((label, index) => (
                <li key={label} className={`relative ${index !== totalSteps - 1 ? 'pr-8 sm:pr-20' : ''}`}>
                    {index < currentStep ? (
                        <>
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                <div className="h-0.5 w-full bg-indigo-600" />
                            </div>
                            <span className="relative flex h-8 w-8 items-center justify-center bg-indigo-600 rounded-full">
                                <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
                            </span>
                        </>
                    ) : index === currentStep ? (
                        <>
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                <div className="h-0.5 w-full bg-slate-200 dark:bg-slate-700" />
                            </div>
                            <span className="relative flex h-8 w-8 items-center justify-center bg-white dark:bg-slate-800 border-2 border-indigo-600 rounded-full" aria-current="step">
                                <span className="h-2.5 w-2.5 bg-indigo-600 rounded-full" aria-hidden="true" />
                            </span>
                        </>
                    ) : (
                         <>
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                <div className="h-0.5 w-full bg-slate-200 dark:bg-slate-700" />
                            </div>
                            <span className="group relative flex h-8 w-8 items-center justify-center bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-full">
                                <span className="h-2.5 w-2.5 bg-transparent rounded-full" aria-hidden="true" />
                            </span>
                        </>
                    )}
                     <span className="absolute top-10 w-max -left-2 text-center text-xs text-slate-500 dark:text-slate-400">{label}</span>
                </li>
            ))}
        </ol>
    </nav>
);

// --- Main Component ---
const NewSaleTab: React.FC = () => {
    // State management
    const [step, setStep] = useState<SaleStep>('customer');
    const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Step 1 states
    const [customerSearch, setCustomerSearch] = useState('');
    const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
    const [newCustomer, setNewCustomer] = useState<NewCustomerData>({ email: '', first_name: '', last_name: '' });

    // Step 2 & 3 states
    const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
    const [productSearch, setProductSearch] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [installments, setInstallments] = useState(1);
    
    // Action states
    const [isProcessing, setIsProcessing] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
    
    // Data Fetching
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [profilesRes, productsRes] = await Promise.all([ fetch('/api/admin/profiles'), fetch('/api/admin/products') ]);
            if (!profilesRes.ok || !productsRes.ok) throw new Error('Falha ao carregar dados iniciais.');
            setAllProfiles(await profilesRes.json());
            setAllProducts(await productsRes.json());
        } catch (err: any) { setError(err.message); } 
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Derived states
    const filteredProfiles = useMemo(() => customerSearch ? allProfiles.filter(p =>
        p.first_name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
        p.last_name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
        p.email?.toLowerCase().includes(customerSearch.toLowerCase())
    ) : [], [customerSearch, allProfiles]);

    const filteredProducts = useMemo(() => productSearch ? allProducts.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase())
    ) : [], [productSearch, allProducts]);

    const installmentValue = useMemo(() => {
        if (!selectedProduct || installments < 1) return 0;
        return selectedProduct.price / installments;
    }, [selectedProduct, installments]);

    const exceedsLimit = useMemo(() => {
        if (!selectedProfile || !selectedProduct) return false;
        const limit = selectedProfile.credit_limit ?? 0;
        return installmentValue > limit;
    }, [selectedProfile, selectedProduct, installmentValue]);


    // --- Action Handlers ---
    const resetFlow = () => {
        setStep('customer');
        setSelectedProfile(null);
        setSelectedProduct(null);
        setCustomerSearch('');
        setProductSearch('');
        setInstallments(1);
        setShowNewCustomerForm(false);
        setMessage(null);
    };

    const handleSelectProfile = (profile: Profile) => {
        setSelectedProfile(profile);
        setStep('product_selection'); // Pula direto para a seleção de produto
        setCustomerSearch('');
    };

    const handleCreateCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        setMessage(null);
        try {
            const tempPassword = Math.random().toString(36).slice(-8); // Senha temporária
            const response = await fetch('/api/admin/create-and-analyze-customer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newCustomer, password: tempPassword }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Erro ao criar cliente.');
            
            setAllProfiles(prev => [...prev, result.profile]); // Adiciona novo perfil à lista
            setSelectedProfile(result.profile);
            setStep('product_selection'); // Vai para a seleção de produtos
            setShowNewCustomerForm(false);
        } catch (err: any) { setMessage({ text: err.message, type: 'error' });
        } finally { setIsProcessing(false); }
    };
    
    const handleAnalyzeCredit = async () => {
        if (!selectedProfile) return;
        setIsProcessing(true);
        setMessage(null);
        try {
             const response = await fetch('/api/admin/analyze-credit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: selectedProfile.id }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            setSelectedProfile(result.profile); // Atualiza perfil com novos dados de crédito
            setStep('product_selection');
        } catch (err: any) { setMessage({ text: err.message, type: 'error' });
        } finally { setIsProcessing(false); }
    };

    const handleFinalizeSale = async () => {
        if (!selectedProfile || !selectedProduct || exceedsLimit) return;
        setIsProcessing(true);
        setMessage(null);
        try {
            const response = await fetch('/api/admin/create-sale', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: selectedProfile.id, 
                    totalAmount: selectedProduct.price, 
                    installments, 
                    productName: selectedProduct.name 
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            setMessage({ text: 'Venda finalizada e faturas geradas com sucesso!', type: 'success' });
            setTimeout(resetFlow, 3000);
        } catch (err: any) { setMessage({ text: err.message, type: 'error' });
        } finally { setIsProcessing(false); }
    };

    const generatePDF = async () => {
        if (!selectedProfile || !selectedProduct) return;
        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('Relp Cell', 20, 20);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text('Orçamento de Venda', 20, 28);
        doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 140, 28);
        
        // Customer Info
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Dados do Cliente', 20, 45);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(`Nome: ${selectedProfile.first_name} ${selectedProfile.last_name || ''}`, 20, 52);
        doc.text(`Email: ${selectedProfile.email || 'Não informado'}`, 20, 58);

        // Product Info
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Produto e Condições', 20, 75);

        // Add Image
        if (selectedProduct.image_url) {
            try {
                // Use a proxy if CORS is an issue, or ensure images are served with correct headers.
                const imgResponse = await fetch(selectedProduct.image_url);
                const blob = await imgResponse.blob();
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => {
                    const base64data = reader.result;
                    if(typeof base64data === 'string') {
                        doc.addImage(base64data, 'JPEG', 20, 82, 40, 40);
                    }
                    addTextToPdf();
                    doc.save(`orcamento-relpcell-${selectedProfile.first_name}.pdf`);
                };
            } catch (e) {
                console.error("Error loading image for PDF, skipping.", e);
                addTextToPdf();
                doc.save(`orcamento-relpcell-${selectedProfile.first_name}.pdf`);
            }
        } else {
             addTextToPdf();
             doc.save(`orcamento-relpcell-${selectedProfile.first_name}.pdf`);
        }
        
        function addTextToPdf() {
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.text(`Produto: ${selectedProduct!.name}`, 70, 90);
            doc.text(`Valor Total: ${selectedProduct!.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 70, 96);
            doc.text(`Condição: ${installments}x de ${(selectedProduct!.price / installments).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 70, 102);
        }
    };
    
    // --- Render Functions ---
    const renderCustomerStep = () => (
        <div className="space-y-4">
            {!showNewCustomerForm ? (
                <>
                    <InputField label="Buscar Cliente por Nome ou Email" name="customerSearch" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Digite para buscar..."/>
                    {customerSearch && filteredProfiles.length > 0 && (
                        <ul className="border border-slate-300 dark:border-slate-600 rounded-md max-h-60 overflow-y-auto">
                           {filteredProfiles.map(p => (
                               <li key={p.id}>
                                   <button onClick={() => handleSelectProfile(p)} className="w-full text-left p-3 hover:bg-slate-100 dark:hover:bg-slate-700">
                                       <p className="font-semibold">{p.first_name} {p.last_name}</p>
                                       <p className="text-sm text-slate-500">{p.email}</p>
                                   </button>
                               </li>
                           ))}
                        </ul>
                    )}
                    <div className="text-center pt-4">
                        <p className="text-sm text-slate-500">Não encontrou o cliente?</p>
                        <button onClick={() => setShowNewCustomerForm(true)} className="font-medium text-indigo-600 hover:underline">Cadastrar Novo Cliente</button>
                    </div>
                </>
            ) : (
                <form onSubmit={handleCreateCustomer} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg space-y-4 bg-white dark:bg-slate-800">
                    <h3 className="font-bold text-lg">Novo Cliente</h3>
                    <InputField label="Primeiro Nome" name="firstName" value={newCustomer.first_name} onChange={e => setNewCustomer({...newCustomer, first_name: e.target.value})} required/>
                    <InputField label="Sobrenome" name="lastName" value={newCustomer.last_name} onChange={e => setNewCustomer({...newCustomer, last_name: e.target.value})} />
                    <InputField label="Email" name="email" type="email" value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} required/>
                     <div className="flex gap-4">
                        <button type="button" onClick={() => setShowNewCustomerForm(false)} className="w-full py-2 px-4 border border-slate-300 rounded-md text-sm font-medium">Cancelar</button>
                        <button type="submit" disabled={isProcessing} className="w-full py-2 px-4 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                            {isProcessing ? <LoadingSpinner/> : 'Salvar e Analisar Crédito'}
                        </button>
                     </div>
                </form>
            )}
        </div>
    );
    
    const renderCreditCheckStep = () => (
        <div className="text-center p-6 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <h3 className="font-bold text-lg">Cliente: {selectedProfile?.first_name} {selectedProfile?.last_name}</h3>
            <p className="text-slate-500 mt-2">Este é um novo cliente. É necessário realizar uma análise de crédito antes de prosseguir com a venda.</p>
            <button onClick={handleAnalyzeCredit} disabled={isProcessing} className="mt-4 py-2 px-6 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 disabled:opacity-50">
                {isProcessing ? <LoadingSpinner/> : 'Analisar Crédito'}
            </button>
        </div>
    );

    const renderProductStep = () => (
        <div className="space-y-6">
            <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-700/50 flex justify-between items-center">
                <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Cliente</p>
                    <p className="font-bold text-lg">{selectedProfile?.first_name} {selectedProfile?.last_name}</p>
                </div>
                 <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Limite por Parcela</p>
                    <p className="font-bold text-lg text-green-600 dark:text-green-400">{(selectedProfile?.credit_limit ?? 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
                </div>
            </div>

            <div className="space-y-2">
                <InputField label="Buscar Produto" name="productSearch" value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Digite para buscar..."/>
                 {productSearch && filteredProducts.length > 0 && (
                    <ul className="border border-slate-300 dark:border-slate-600 rounded-md max-h-60 overflow-y-auto">
                        {filteredProducts.map(p => (
                            <li key={p.id}>
                                <button onClick={() => { setSelectedProduct(p); setProductSearch(''); }} className="w-full text-left p-3 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-4">
                                    <img src={p.image_url || 'https://via.placeholder.com/50'} alt={p.name} className="w-12 h-12 rounded object-cover"/>
                                    <div>
                                        <p className="font-semibold">{p.name}</p>
                                        <p className="text-sm text-slate-500">{p.price.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {selectedProduct && (
                <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg space-y-4 bg-white dark:bg-slate-800 animate-fade-in">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">Resumo da Venda</h3>
                    <div className="flex gap-4 items-center">
                        <img src={selectedProduct.image_url || 'https://via.placeholder.com/100'} alt={selectedProduct.name} className="w-24 h-24 rounded object-cover"/>
                        <div>
                            <p><strong>Produto:</strong> {selectedProduct.name}</p>
                            <p><strong>Valor Total:</strong> {selectedProduct.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                    </div>
                    <InputField 
                        label="Número de Parcelas" name="installments" type="number" value={String(installments)} 
                        onChange={e => setInstallments(Math.max(1, parseInt(e.target.value, 10)))} min="1" max="12" required
                    />
                     {installments > 0 && (
                        <div className={`text-sm p-2 rounded-md ${exceedsLimit ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'}`}>
                           <p className="font-semibold">
                                {installments}x de {installmentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                            <p className="text-xs">
                                Limite por parcela: {(selectedProfile?.credit_limit ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                        </div>
                    )}
                </div>
            )}
             <div className="flex flex-col sm:flex-row gap-4 pt-4">
                 <button type="button" onClick={resetFlow} className="w-full sm:w-auto py-3 px-4 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-medium">
                    &larr; Alterar Cliente
                </button>
                <div className="flex-grow"></div>
                <button type="button" onClick={generatePDF} disabled={!selectedProduct || isProcessing} className="w-full sm:w-auto py-3 px-6 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-medium disabled:opacity-50">
                    Gerar Orçamento PDF
                </button>
                <button type="button" onClick={handleFinalizeSale} disabled={!selectedProduct || isProcessing || exceedsLimit} className="w-full sm:w-auto py-3 px-6 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                    {isProcessing ? <LoadingSpinner/> : 'Finalizar Venda'}
                </button>
            </div>
        </div>
    );
    
    // --- Main Render ---
    if (isLoading) return <div className="p-8 flex justify-center"><LoadingSpinner/></div>;
    if (error) return <div className="p-4"><Alert message={error} type="error"/></div>;

    const currentStepIndex = step === 'customer' ? 0 : 1;
    const stepLabels = ['Cliente', 'Produto e Venda'];

    return (
        <div className="p-4 space-y-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Registrar Nova Venda</h2>
            <div className="max-w-xl mx-auto mb-12">
                 <StepIndicator currentStep={currentStepIndex} totalSteps={2} stepLabels={stepLabels}/>
            </div>
            
            {message && <div className="max-w-2xl mx-auto"><Alert message={message.text} type={message.type}/></div>}

            <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-lg max-w-2xl mx-auto">
                {step === 'customer' && renderCustomerStep()}
                {step === 'credit_check' && renderCreditCheckStep()}
                {step === 'product_selection' && renderProductStep()}
            </div>
        </div>
    );
};

export default NewSaleTab;