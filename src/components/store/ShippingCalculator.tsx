
import React, { useState, useEffect } from 'react';
import { Product, Profile } from '../../types';
import LoadingSpinner from '../LoadingSpinner';

interface ShippingCalculatorProps {
    product: Product;
    userProfile: Profile | null;
    onCalculate?: (cost: number, days: number) => void;
}

const ShippingCalculator: React.FC<ShippingCalculatorProps> = ({ product, userProfile, onCalculate }) => {
    const [cep, setCep] = useState(userProfile?.zip_code || '');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{ cost: number, days: number, city: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Endereço Base da Loja (Santana, AP)
    const STORE_CEP = '68928-184';

    const calculateShipping = async (targetCep: string) => {
        const cleanCep = targetCep.replace(/\D/g, '');
        if (cleanCep.length !== 8) return;

        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
            const data = await res.json();

            if (data.erro) throw new Error("CEP não encontrado.");
            if (data.uf !== 'AP') throw new Error("Atendemos apenas o Amapá.");
            
            const allowedCities = ['Macapá', 'Santana'];
            if (!allowedCities.includes(data.localidade)) throw new Error("Entregamos apenas em Macapá e Santana.");

            // --- Lógica de Cálculo Oculta ---
            // Pequeno: peso < 2kg e dimensões < 40cm
            const isLarge = (product.weight || 0) > 2000 || (product.height || 0) > 40 || (product.width || 0) > 40;
            
            let baseCost = 12.90;
            if (data.localidade === 'Santana') baseCost = 7.90; // Loja é em Santana
            
            const weightCost = ((product.weight || 500) / 1000) * 2.5; // R$ 2.50 por kg
            const totalCost = baseCost + weightCost;
            const days = isLarge ? 6 : 3;

            setResult({ cost: totalCost, days, city: data.localidade });
            if (onCalculate) onCalculate(totalCost, days);
        } catch (e: any) {
            setError(e.message);
            setResult(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (cep.length === 9) calculateShipping(cep);
    }, [cep]);

    return (
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Calcular Frete</span>
                <div className="flex items-center gap-1 text-[10px] text-indigo-500 font-bold uppercase">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                    Amapá Express
                </div>
            </div>

            <div className="flex gap-2">
                <input 
                    type="text" 
                    value={cep} 
                    onChange={e => setCep(e.target.value.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2'))}
                    placeholder="00000-000"
                    maxLength={9}
                    className="flex-1 px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button 
                    onClick={() => calculateShipping(cep)}
                    className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    {isLoading ? <LoadingSpinner /> : 'Calcular'}
                </button>
            </div>

            {error && <p className="text-[10px] text-red-500 mt-2 font-bold">{error}</p>}

            {result && !isLoading && (
                <div className="mt-4 flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl border border-indigo-100 dark:border-indigo-900 animate-fade-in">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" /><path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" /></svg>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-green-600 uppercase">Chega em {result.days} dias úteis</p>
                            <p className="text-xs text-slate-500">Entrega em {result.city}, AP</p>
                        </div>
                    </div>
                    <span className="font-black text-slate-900 dark:text-white text-sm">
                        {result.cost === 0 ? 'Grátis' : result.cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                </div>
            )}
        </div>
    );
};

export default ShippingCalculator;
