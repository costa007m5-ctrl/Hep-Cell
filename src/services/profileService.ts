import { supabase } from './clients';
import { Profile } from '../types';

/**
 * Busca o perfil de um usuário específico no banco de dados.
 * @param userId O ID do usuário (deve ser o auth.uid()).
 * @returns O objeto de perfil ou nulo se não for encontrado.
 */
export const getProfile = async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    // O erro 'PGRST116' significa "No rows found", o que é esperado se o perfil ainda não existe.
    // Qualquer outro erro deve ser lançado.
    if (error && error.code !== 'PGRST116') {
        console.error('Erro ao buscar perfil:', error);
        throw error;
    }

    return data;
};

/**
 * Atualiza ou cria (upsert) um perfil de usuário no banco de dados.
 * @param profile O objeto de perfil a ser salvo. O 'id' deve corresponder ao auth.uid().
 */
export const updateProfile = async (profile: Profile): Promise<void> => {
    const { error } = await supabase
        .from('profiles')
        .upsert(profile, { onConflict: 'id' });

    if (error) {
        console.error('Erro ao atualizar perfil:', error);
        throw error;
    }
};