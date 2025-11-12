import React, { useState, useEffect, useCallback } from 'react';
import { Profile, Product } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import InputField from './InputField';

interface NewSaleTabProps {
    onSaleCreated: () => void;
}

const NewSaleTab: React.FC<NewSaleTabProps> = ({ onSaleCreated }) => {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedProfileId, setSelectedProfileId] = useState('');
    const [selectedProductId, setSelectedProductId] = useState('');
    const [installments, setInstallments] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitMessage, setSubmitMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [profilesRes, productsRes] = await Promise.all([
                fetch('/api/admin/profiles'),
                fetch('/api/admin/products')
            ]);

            if (!profilesRes.ok) throw new Error('Falha ao carregar clientes.');
            if (!productsRes.ok) throw new Error('Falha ao carregar produtos.');

            const profilesData = await profilesRes.json();
            const productsData = await productsRes.json();

            setProfiles(profilesData);
            setProducts(productsData);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const selectedProduct = products.find(p => p.id === selectedProductId);
    const selectedProfile = profiles.find(p => p.id === selectedProfileId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProfileId || !selectedProductId || !selectedProduct) return;

        setIsSubmitting(true);
        setSubmitMessage(null);

        try {
            const response = await fetch('/api/admin/create-sale', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: selectedProfileId,
                    productId: selectedProductId,
                    totalAmount: selectedProduct.price,
                    installments: installments,
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Falha ao registrar a venda.');
            
            setSubmitMessage({ text: 'Venda registrada e faturas geradas com sucesso!', type: 'success' });
            setSelectedProfileId('');
            setSelectedProductId('');
            setInstallments(1);
            onSaleCreated(); // Callback to refresh data in parent
        } catch (err: any) {
            setSubmitMessage({ text: err.message, type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (isLoading) {
        return <div className="p-8 flex justify-center"><LoadingSpinner /></div>;
    }
    if (error) {
        return <div className="p-4"><Alert message={error} type="error" /></div>;
    }

    const selectClasses = "mt-1 block w-full px-3 py-2 border rounded-md shadow-sm bg-slate-50 border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500";

    return (
        <div className="p-4 space-y-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Registrar Nova Venda</h2>
            <form onSubmit={handleSubmit} className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-lg space-y-4 max-w-2xl mx-auto">
                {submitMessage && <Alert message={submitMessage.text} type={submitMessage.type} />}
                <div>
                    <label htmlFor="client" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Cliente</label>
                    <select id="client" value={selectedProfileId} onChange={e => setSelectedProfileId(e.target.value)} className={selectClasses} required>
                        <option value="" disabled>Selecione um cliente</option>
                        {profiles.map(profile => (
                            <option key={profile.id} value={profile.id}>
                                {profile.first_name} {profile.last_name} ({profile.email})
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label htmlFor="product" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Produto</label>
                    <select id="product" value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} className={selectClasses} required>
                        <option value="" disabled>Selecione um produto</option>
                        {products.map(product => (
                            <option key={product.id} value={product.id}>
                                {product.name} - {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </option>
                        ))}
                    </select>
                </div>
                
                {selectedProfile && selectedProduct && (
                    <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg space-y-3 bg-white dark:bg-slate-800">
                         <h3 className="font-bold text-lg text-slate-900 dark:text-white">Resumo da Venda</h3>
                         <p><strong>Cliente:</strong> {selectedProfile.first_name} {selectedProfile.last_name}</p>
                         <p><strong>Produto:</strong> {selectedProduct.name}</p>
                         <p><strong>Valor Total:</strong> {selectedProduct.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                         <p className="text-sm text-slate-500 dark:text-slate-400">Limite de Crédito do Cliente: {(selectedProfile.credit_limit ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                         {selectedProduct.price > (selectedProfile.credit_limit ?? 0) &&
                             <Alert message="Atenção: O valor do produto excede o limite de crédito do cliente." type="error" />
                         }
                         
                         <InputField 
                            label="Número de Parcelas"
                            type="number"
                            name="installments"
                            value={String(installments)}
                            onChange={e => setInstallments(Math.max(1, parseInt(e.target.value, 10)))}
                            min="1"
                            max="12"
                            required
                         />

                         {installments > 0 && (
                             <p className="font-semibold text-indigo-600 dark:text-indigo-400">
                                 {installments}x de {(selectedProduct.price / installments).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                             </p>
                         )}
                    </div>
                )}

                <div className="flex justify-end pt-2">
                    <button type="submit" disabled={isSubmitting || !selectedProfileId || !selectedProductId || (selectedProduct != null && selectedProfile != null && selectedProduct.price > (selectedProfile.credit_limit ?? 0))} className="py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                        {isSubmitting ? <LoadingSpinner /> : 'Finalizar Venda'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default NewSaleTab;
