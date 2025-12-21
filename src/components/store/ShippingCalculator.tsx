
import React, { useState, useEffect } from 'react';
import { Product, Profile } from '../../types';
import LoadingSpinner from '../LoadingSpinner';

interface ShippingCalculatorProps {
    product: Product;
    userProfile: Profile | null;
    onCalculate?: (cost: number, days: number) => void;
}

const ShippingCalculator: React.FC<ShippingCalculatorProps> = ({ product, userProfile, onCalculate }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{ cost: number, days: number, city: string } | null>(null);

    // Endereço Base da Loja (Fonte Nova, Santana, AP)
    const STORE_CEP = '68928-184';

    useEffect(() => {
        // Se o usuário já tem endereço salvo, calcula automaticamente
        if (userProfile?.zip_code) {
            calculateShipping(userProfile.zip_code);
        }
    }, [userProfile?.zip_code, product.id]);

    const calculateShipping = async (cep: string) => {
        setIsLoading(true);
        try {
            // Validação local rápida
            const cleanCep = cep.replace(/\D/g, '');
            if (cleanCep.length !== 8) return;

            // Busca cidade (Simulado ou API)
            const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
            const data = await res.json();

            if (data.erro || data.uf !== 'AP') {
                setResult(null);
                return;
            }

            // --- REGRAS DE NEGÓCIO OCULTAS ---
            // 1. Cubagem e Peso
            const weight = product.weight || 500; // gramas
            const volume = (product.height || 1) * (product.width || 1) * (product.length || 1); // cm³
            
            // 2. Base de custo: Macapá R$ 15, Santana R$ 8
            let baseCost = data.localidade === 'Santana' ? 8.90 : 14.90;
            
            // 3. Adicional por peso/volume
            const weightAddition = (weight / 1000) * 4.5; // R$ 4.50 por kg
            const volumeAddition = (volume / 1000) * 1.2; // R$ 1.20 por litro de cubagem
            
            const totalCost = baseCost + weightAddition + volumeAddition;

            // 4. Prazo Automático
            // Regra: Volume > 20.000cm³ (Ex: Celular ~500cm³, Tablet ~1500cm³)
            const days = volume > 20000 ? 6 : 3;

            const finalResult = {
                cost: product.free_shipping ? 0 : totalCost,
                days,
                city: data.localidade
            };

            setResult(finalResult);
            if (onCalculate) onCalculate(finalResult.cost, finalResult.days);

        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return <div className="py-4"><LoadingSpinner /></div>;
    if (!result) return null;

    return (
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-indigo-50 dark:border-slate-700 animate-fade-in">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" /><path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" /></svg>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-green-600 uppercase tracking-wider">Chega em até {result.days} dias úteis</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Entrega para {result.city}, AP</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-sm font-black text-slate-900 dark:text-white">
                        {result.cost === 0 ? 'Grátis' : result.cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ShippingCalculator;
