import React, { useState, useEffect, useCallback } from 'react';
import { Product } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import InputField from './InputField';

const ProductsTab: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    
    const [formState, setFormState] = useState({
        name: '',
        description: '',
        price: '',
        stock: '',
        image_url: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitMessage, setSubmitMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const fetchProducts = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/admin/products');
            if (!response.ok) throw new Error('Falha ao carregar produtos.');
            const data = await response.json();
            setProducts(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };

    const handleCreateProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitMessage(null);
        try {
            const response = await fetch('/api/admin/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formState,
                    price: parseFloat(formState.price),
                    stock: parseInt(formState.stock, 10)
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Erro ao criar produto.');

            setSubmitMessage({ text: 'Produto criado com sucesso!', type: 'success' });
            setShowCreateForm(false);
            setFormState({ name: '', description: '', price: '', stock: '', image_url: '' });
            fetchProducts();
        } catch (err: any) {
            setSubmitMessage({ text: err.message, type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (isLoading) {
      return <div className="flex justify-center p-8"><LoadingSpinner /></div>;
    }
    if (error) {
      return <div className="p-4"><Alert message={error} type="error" /></div>;
    }

    return (
        <div className="p-4 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Gerenciar Produtos</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Adicione e visualize os produtos que aparecerão na loja do aplicativo.
                    </p>
                </div>
                <button onClick={() => setShowCreateForm(prev => !prev)} className="flex-shrink-0 py-2 px-4 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm">
                    {showCreateForm ? 'Cancelar' : '+ Adicionar Produto'}
                </button>
            </div>

            {showCreateForm && (
                <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-lg animate-fade-in">
                    <form onSubmit={handleCreateProduct} className="space-y-4">
                        {submitMessage && <Alert message={submitMessage.text} type={submitMessage.type} />}
                        <InputField label="Nome do Produto" name="name" value={formState.name} onChange={handleInputChange} required />
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Descrição</label>
                            <textarea id="description" name="description" value={formState.description} onChange={handleInputChange} rows={3} className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm bg-slate-50 border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 focus:ring-indigo-500 focus:border-indigo-500"></textarea>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             <InputField label="Preço (R$)" name="price" type="number" step="0.01" value={formState.price} onChange={handleInputChange} required />
                             <InputField label="Estoque (Unidades)" name="stock" type="number" value={formState.stock} onChange={handleInputChange} required />
                        </div>
                        <InputField label="URL da Imagem" name="image_url" value={formState.image_url} onChange={handleInputChange} placeholder="https://..." />
                        <div className="flex justify-end pt-2">
                             <button type="submit" disabled={isSubmitting} className="py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                                {isSubmitting ? <LoadingSpinner /> : 'Salvar Produto'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-900/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Produto</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Preço</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Estoque</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                        {products.length > 0 ? products.map(product => (
                            <tr key={product.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">{product.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-300">{product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-300">{product.stock} unidades</td>
                            </tr>
                        )) : (
                            <tr><td colSpan={3} className="text-center p-8 text-slate-500 dark:text-slate-400">Nenhum produto cadastrado.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ProductsTab;
