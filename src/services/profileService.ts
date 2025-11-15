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
    // Para garantir a integridade dos dados, construímos um payload de atualização controlado.
    // O campo 'email' não deve ser atualizado a partir do perfil do cliente.
    // A data de 'updated_at' é sempre definida para o momento da atualização.
    const { email, ...updateData } = profile;

    const payload = {
        ...updateData,
        updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'id' });

    if (error) {
        // Melhora o log de erro para mostrar a mensagem real em vez de '[object Object]'.
        console.error('Erro ao atualizar perfil:', error.message, error);
        throw error;
    }
};