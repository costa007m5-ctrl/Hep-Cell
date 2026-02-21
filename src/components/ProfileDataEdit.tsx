import React, { useState, useEffect, useRef } from 'react';
import { Profile } from '../types';
import { updateProfile } from '../services/profileService';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';
import InputField from './InputField';
import { useToast } from './Toast';

interface ProfileDataEditProps {
    profile: Profile;
    onSuccess: (updated: Profile) => void;
}

const ProfileDataEdit: React.FC<ProfileDataEditProps> = ({ profile, onSuccess }) => {
    const [formData, setFormData] = useState({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone: profile.phone || '',
        zip_code: profile.zip_code || '',
        street_name: profile.street_name || '',
        street_number: profile.street_number || '',
        neighborhood: profile.neighborhood || '',
        city: profile.city || '',
        federal_unit: profile.federal_unit || '',
    });

    const [isSaving, setIsSaving] = useState(false);
    const [isFetchingCep, setIsFetchingCep] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { addToast } = useToast();
    const numRef = useRef<HTMLInputElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        
        if (name === 'zip_code' && value.replace(/\D/g, '').length === 8) {
            handleCepLookup(value.replace(/\D/g, ''));
        }
    };

    const handleCepLookup = async (cep: string) => {
        setIsFetchingCep(true);
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await res.json();
            if (data.erro) throw new Error("CEP não encontrado");
            
            setFormData(prev => ({
                ...prev,
                street_name: data.logradouro,
                neighborhood: data.bairro,
                city: data.localidade,
                federal_unit: data.uf
            }));
            numRef.current?.focus();
        } catch (e: any) {
            addToast(e.message, "error");
        } finally {
            setIsFetchingCep(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);
        try {
            const updatedProfile = { ...profile, ...formData };
            await updateProfile(updatedProfile);
            addToast("Dados atualizados com sucesso!", "success");
            onSuccess(updatedProfile);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-indigo-600 uppercase tracking-widest mb-4">Dados Pessoais</h3>
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="Nome" name="first_name" value={formData.first_name} onChange={handleChange} required />
                    <InputField label="Sobrenome" name="last_name" value={formData.last_name} onChange={handleChange} required />
                </div>
                <InputField label="Celular / WhatsApp" name="phone" value={formData.phone} onChange={handleChange} placeholder="(00) 00000-0000" />
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-indigo-600 uppercase tracking-widest mb-4">Endereço de Entrega</h3>
                <div className="relative">
                    <InputField label="CEP" name="zip_code" value={formData.zip_code} onChange={handleChange} maxLength={9} isLoading={isFetchingCep} />
                </div>
                <InputField label="Rua / Logradouro" name="street_name" value={formData.street_name} onChange={handleChange} required />
                <div className="grid grid-cols-3 gap-4">
                    <InputField ref={numRef} label="Número" name="street_number" value={formData.street_number} onChange={handleChange} required />
                    <div className="col-span-2">
                        <InputField label="Bairro" name="neighborhood" value={formData.neighborhood} onChange={handleChange} required />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="Cidade" name="city" value={formData.city} onChange={handleChange} required />
                    <InputField label="Estado (UF)" name="federal_unit" value={formData.federal_unit} onChange={handleChange} required maxLength={2} />
                </div>
            </div>

            {error && <Alert message={error} type="error" />}

            <button 
                type="submit" 
                disabled={isSaving}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-500/30 active:scale-95 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
            >
                {isSaving ? <LoadingSpinner /> : 'SALVAR ALTERAÇÕES'}
            </button>
        </form>
    );
};

export default ProfileDataEdit;