
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
    
    // States do formulário principal
    const [formState, setFormState] = useState({
        id: '',
        name: '',
        description: '',
        price: '',
        stock: '',
        image_url: '',
        brand: '',
        category: 'Celulares',
    });
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitMessage, setSubmitMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    // States para importação
    const [mercadoLivreUrl, setMercadoLivreUrl] = useState('');
    const [isFetchingML, setIsFetchingML] = useState(false);
    const [mlError, setMlError] = useState<string | null>(null);

    const [shopeeUrl, setShopeeUrl] = useState('');
    const [isFetchingShopee, setIsFetchingShopee] = useState(false);
    const [shopeeError, setShopeeError] = useState<string | null>(null);
    
    // State para IA
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGeneratingAi, setIsGeneratingAi] = useState(false);

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

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImageBase64(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCreateOrUpdateProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitMessage(null);
        try {
            const priceNum = parseFloat(formState.price.toString().replace(',', '.'));
            const stockNum = parseInt(formState.stock, 10);

            if (isNaN(priceNum)) throw new Error("O preço inválido.");
            if (isNaN(stockNum)) throw new Error("O estoque inválido.");

            const payload: any = {
                ...formState,
                price: priceNum,
                stock: stockNum,
            };
            
            if (imageBase64) {
                payload.image_base64 = imageBase64;
            }

            const method = isEditing ? 'PUT' : 'POST';
            
            const response = await fetch('/api/admin/products', {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Erro ao salvar produto.');

            setSubmitMessage({ text: isEditing ? 'Produto atualizado!' : 'Produto criado com sucesso!', type: 'success' });
            setShowCreateForm(false);
            resetForm();
            fetchProducts();
        } catch (err: any) {
            setSubmitMessage({ text: err.message, type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const resetForm = () => {
        setFormState({ id: '', name: '', description: '', price: '', stock: '', image_url: '', brand: '', category: 'Celulares' });
        setImageBase64(null);
        setMercadoLivreUrl('');
        setShopeeUrl('');
        setAiPrompt('');
        setIsEditing(false);
    };

    const handleEditClick = (product: Product) => {
        setFormState({
            id: product.id,
            name: product.name,
            description: product.description || '',
            price: String(product.price),
            stock: String(product.stock),
            image_url: product.image_url || '',
            brand: product.brand || '',
            category: product.category || 'Celulares',
        });
        setImageBase64(null);
        setIsEditing(true);
        setShowCreateForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    
    const handleMagicFill = async () => {
        if (!aiPrompt.trim()) return;
        setIsGeneratingAi(true);
        setSubmitMessage(null);
        try {
            const response = await fetch('/api/admin/generate-product-details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: aiPrompt })
            });
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Erro na geração IA.");
            
            setFormState(prev => ({
                ...prev,
                name: data.name || prev.name,
                description: data.description || prev.description,
                price: data.price ? String(data.price) : prev.price,
                stock: data.stock ? String(data.stock) : prev.stock,
                brand: data.brand || prev.brand,
                category: data.category || prev.category
            }));
            setSubmitMessage({ text: "Campos preenchidos com sucesso pela IA!", type: 'success' });
        } catch (err: any) {
            setSubmitMessage({ text: err.message, type: 'error' });
        } finally {
            setIsGeneratingAi(false);
        }
    };

    const handleFetchMercadoLivreProduct = async () => {
        setMlError(null);
        const idMatch = mercadoLivreUrl.match(/(MLB-?\d+)/i) || mercadoLivreUrl.match(/MLB\d+/i);
        
        if (!idMatch) {
            setMlError('Não foi possível identificar o código MLB no link ou texto fornecido.');
            return;
        }
        
        const productId = idMatch[0].replace('-', '').toUpperCase();

        setIsFetchingML(true);
        try {
            const response = await fetch(`/api/ml-item?id=${productId}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Erro ao buscar no Mercado Livre.`);
            }
            const itemData = await response.json();
            
            let detailedDescription = itemData.description || '';
            const specs = [];
            if (itemData.brand) specs.push(`Marca: ${itemData.brand}`);
            if (itemData.model) specs.push(`Modelo: ${itemData.model}`);
            
            if (specs.length > 0) {
                detailedDescription = `### Ficha Técnica\n${specs.join('\n')}\n\n### Descrição\n${detailedDescription}`;
            } else {
                 detailedDescription = `### Descrição\n${detailedDescription}`;
            }
            
            setFormState(prev => ({
                ...prev,
                name: itemData.title || '',
                description: detailedDescription.trim(),
                price: String(itemData.price || ''),
                stock: String(itemData.available_quantity || '1'),
                image_url: itemData.pictures?.[0]?.secure_url || '',
                brand: itemData.brand || '',
                category: 'Celulares',
            }));

            setImageBase64(null);
            setSubmitMessage({ text: 'Produto importado! Revise os dados e clique em Salvar.', type: 'success' });

        } catch (err: any) {
            setMlError(err.message);
        } finally {
            setIsFetchingML(false);
        }
    };

    const handleFetchShopeeProduct = async () => {
        setShopeeError(null);
        if (!shopeeUrl) {
            setShopeeError('Por favor, insira uma URL de produto da Shopee.');
            return;
        }
    
        setIsFetchingShopee(true);
        try {
            const response = await fetch(`/api/shopee?url=${encodeURIComponent(shopeeUrl)}`);
            const data = await response.json();
    
            if (!response.ok) {
                throw new Error(data.error || 'Erro ao buscar na Shopee.');
            }
            
            setFormState(prev => ({
                ...prev,
                name: data.nome || '',
                description: `### Descrição\n${data.descricao || ''}`,
                price: String(data.preco || ''),
                stock: String(data.estoque || '1'),
                image_url: data.imagens?.[0] || '',
                brand: data.marca || '',
            }));

            setImageBase64(null); 
            setSubmitMessage({ text: 'Produto importado! Revise os dados e clique em Salvar.', type: 'success' });
    
        } catch (err: any) {
            setShopeeError(err.message);
        } finally {
            setIsFetchingShopee(false);
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
                        Adicione, edite e visualize os produtos da loja.
                    </p>
                </div>
                <button onClick={() => { setShowCreateForm(prev => !prev); if (!showCreateForm) resetForm(); }} className="flex-shrink-0 py-2 px-4 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm">
                    {showCreateForm ? 'Cancelar' : '+ Adicionar Produto'}
                </button>
            </div>

            {showCreateForm && (
                <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-lg animate-fade-in border border-slate-200 dark:border-slate-700">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-4">{isEditing ? 'Editar Produto' : 'Novo Produto'}</h3>
                    
                    {!isEditing && (
                        <div className="space-y-6 mb-6">
                             {/* AI Magic Input */}
                             <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 dark:text-indigo-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
                                    <span className="font-bold text-indigo-800 dark:text-indigo-200">Comando Mágico (IA)</span>
                                </div>
                                <p className="text-xs text-indigo-600 dark:text-indigo-300 mb-3">
                                    Digite algo como: "iPhone 15 128GB azul por 4500 reais com 5 no estoque" e clique em Gerar. A IA vai criar a ficha técnica automaticamente!
                                </p>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        className="flex-1 px-3 py-2 rounded-md border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500"
                                        placeholder="Descreva o produto..."
                                        value={aiPrompt}
                                        onChange={(e) => setAiPrompt(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleMagicFill()}
                                    />
                                    <button 
                                        onClick={handleMagicFill} 
                                        disabled={isGeneratingAi || !aiPrompt.trim()}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {isGeneratingAi ? <LoadingSpinner /> : (
                                            <>
                                                <span>Gerar</span>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" /></svg>
                                            </>
                                        )}
                                    </button>
                                </div>
                             </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Importar Mercado Livre */}
                                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-700 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-yellow-800 dark:text-yellow-200">Mercado Livre</span>
                                        <span className="text-xs bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 px-2 py-0.5 rounded-full">Importação</span>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-2 items-end">
                                        <div className="flex-grow w-full">
                                            <input
                                                type="text"
                                                value={mercadoLivreUrl}
                                                onChange={(e) => setMercadoLivreUrl(e.target.value)}
                                                placeholder="Link ou código MLB..."
                                                className="block w-full px-3 py-2 border rounded-md shadow-sm border-yellow-300 dark:border-yellow-600 bg-white dark:bg-slate-800 text-sm focus:ring-yellow-500 focus:border-yellow-500"
                                            />
                                        </div>
                                        <button onClick={handleFetchMercadoLivreProduct} disabled={isFetchingML} className="w-full sm:w-auto flex-shrink-0 h-[38px] flex items-center justify-center px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50">
                                            {isFetchingML ? <LoadingSpinner /> : 'Importar'}
                                        </button>
                                    </div>
                                    {mlError && <p className="text-xs text-red-600 mt-1">{mlError}</p>}
                                </div>

                                {/* Importar Shopee */}
                                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-md border border-orange-200 dark:border-orange-700 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-orange-800 dark:text-orange-200">Shopee</span>
                                        <span className="text-xs bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 px-2 py-0.5 rounded-full">Importação</span>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-2 items-end">
                                        <div className="flex-grow w-full">
                                            <input
                                                type="text"
                                                value={shopeeUrl}
                                                onChange={(e) => setShopeeUrl(e.target.value)}
                                                placeholder="https://shopee.com.br/..."
                                                className="block w-full px-3 py-2 border rounded-md shadow-sm border-orange-300 dark:border-orange-600 bg-white dark:bg-slate-800 text-sm focus:ring-orange-500 focus:border-orange-500"
                                            />
                                        </div>
                                        <button onClick={handleFetchShopeeProduct} disabled={isFetchingShopee} className="w-full sm:w-auto flex-shrink-0 h-[38px] flex items-center justify-center px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50">
                                            {isFetchingShopee ? <LoadingSpinner /> : 'Importar'}
                                        </button>
                                    </div>
                                    {shopeeError && <p className="text-xs text-red-600 mt-1">{shopeeError}</p>}
                                </div>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleCreateOrUpdateProduct} className="space-y-4 border-t border-slate-200 dark:border-slate-700 pt-6">
                        {submitMessage && <Alert message={submitMessage.text} type={submitMessage.type} />}
                        
                        <InputField label="Nome do Produto" name="name" value={formState.name} onChange={handleInputChange} required placeholder="Ex: iPhone 15 Pro Max" />
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             <InputField label="Marca" name="brand" value={formState.brand} onChange={handleInputChange} placeholder="Ex: Apple, Samsung" />
                             <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
                                <select 
                                    name="category" 
                                    value={formState.category} 
                                    onChange={handleInputChange}
                                    className="block w-full px-3 py-2 border rounded-md shadow-sm bg-white border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="Celulares">Celulares</option>
                                    <option value="Acessórios">Acessórios</option>
                                    <option value="Fones">Fones</option>
                                    <option value="Smartwatch">Smartwatch</option>
                                    <option value="Ofertas">Ofertas</option>
                                </select>
                             </div>
                        </div>

                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Descrição & Ficha Técnica</label>
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 mb-1">
                                Dica: Use <strong>### Título</strong> para criar seções separadas na loja (ex: ### Ficha Técnica).
                            </div>
                            <textarea id="description" name="description" value={formState.description} onChange={handleInputChange} rows={8} className="block w-full px-3 py-2 border rounded-md shadow-sm bg-white border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"></textarea>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             <InputField label="Preço (R$)" name="price" type="number" step="0.01" value={formState.price} onChange={handleInputChange} required placeholder="0.00" />
                             <InputField label="Estoque (Unidades)" name="stock" type="number" value={formState.stock} onChange={handleInputChange} required placeholder="1" />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                            <InputField label="URL da Imagem (Importada)" name="image_url" value={formState.image_url} onChange={handleInputChange} placeholder="https://..." readOnly={!!imageBase64} />
                            
                            <div>
                                 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Ou Enviar Arquivo</label>
                                 <input type="file" accept="image/*" onChange={handleFileChange} className="mt-1 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900 dark:file:text-indigo-200"/>
                            </div>
                        </div>

                        {(imageBase64 || formState.image_url) && (
                            <div className="mt-4 p-2 border border-slate-200 dark:border-slate-700 rounded-md inline-block">
                                <p className="text-xs text-slate-500 mb-2">Pré-visualização:</p>
                                <img src={imageBase64 || formState.image_url} alt="Preview" className="w-32 h-32 rounded-lg object-contain bg-white" />
                            </div>
                        )}

                        <div className="flex justify-end pt-4 gap-3">
                             {isEditing && (
                                <button type="button" onClick={() => { setIsEditing(false); setShowCreateForm(false); resetForm(); }} className="py-3 px-6 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                                    Cancelar
                                </button>
                             )}
                             <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto py-3 px-8 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                                {isSubmitting ? <LoadingSpinner /> : (isEditing ? 'Atualizar Produto' : 'Salvar Produto')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-900/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Produto</th>
                             <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Marca/Cat.</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Preço</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Estoque</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {products.length > 0 ? products.map(product => (
                            <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white flex items-center gap-4">
                                    <img src={product.image_url || 'https://via.placeholder.com/40'} alt={product.name} className="w-10 h-10 rounded-md object-cover bg-white border border-slate-200 dark:border-slate-600" />
                                    <span className="truncate max-w-xs" title={product.name}>{product.name}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-300">
                                    {product.brand && <span className="block text-xs font-bold">{product.brand}</span>}
                                    <span className="text-xs bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{product.category || 'N/A'}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-300">{product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-300">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${product.stock > 0 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                                        {product.stock} unid.
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => handleEditClick(product)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">Editar</button>
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan={5} className="text-center p-8 text-slate-500 dark:text-slate-400">Nenhum produto cadastrado.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ProductsTab;
