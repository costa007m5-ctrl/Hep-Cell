
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Inicializa Supabase Admin
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Função auxiliar para simular envio de email
async function sendEmailMock(to: string, subject: string, body: string) {
    console.log(`[MOCK EMAIL] To: ${to} | Subject: ${subject} | Body: ${body}`);
    return true;
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
    try {
        // --- 1. Limpeza de Faturas de Entrada Expiradas (> 12h) ---
        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

        // Busca faturas de entrada em aberto criadas há mais de 12h
        const { data: expiredEntries, error: entryError } = await supabase
            .from('invoices')
            .select('id, user_id, created_at, month')
            .like('notes', '%ENTRADA%') // Identifica pela tag na nota
            .eq('status', 'Em aberto')
            .lt('created_at', twelveHoursAgo);

        if (entryError) console.error('Erro buscando entradas expiradas:', entryError);

        let entriesCancelled = 0;
        let installmentsCancelled = 0;
        let contractsCancelled = 0;

        if (expiredEntries && expiredEntries.length > 0) {
            for (const entry of expiredEntries) {
                const entryTime = new Date(entry.created_at).getTime();
                // Define uma janela de segurança de 1 minuto para encontrar itens relacionados a mesma compra
                const minTime = new Date(entryTime - 60000).toISOString();
                const maxTime = new Date(entryTime + 60000).toISOString();

                console.log(`Cancelando compra expirada: ${entry.month} do usuário ${entry.user_id}`);

                // 1. Cancela a fatura da entrada
                await supabase.from('invoices')
                    .update({ status: 'Cancelado', notes: 'Entrada expirada (12h sem pagamento).' })
                    .eq('id', entry.id);
                entriesCancelled++;

                // 2. Cancela as parcelas (outras faturas criadas no mesmo momento)
                const { count: countInv } = await supabase.from('invoices')
                    .update({ status: 'Cancelado', notes: 'Cancelado automaticamente: Entrada não paga.' })
                    .eq('user_id', entry.user_id)
                    .neq('id', entry.id) // Não atualiza a entrada de novo
                    .gte('created_at', minTime)
                    .lte('created_at', maxTime)
                    .select('*', { count: 'exact', head: true });
                
                if (countInv) installmentsCancelled += countInv;

                // 3. Cancela o contrato associado
                const { count: countContr } = await supabase.from('contracts')
                    .update({ status: 'Cancelado' })
                    .eq('user_id', entry.user_id)
                    .gte('created_at', minTime)
                    .lte('created_at', maxTime)
                    .select('*', { count: 'exact', head: true });

                if (countContr) contractsCancelled += countContr;
                
                // Notifica o usuário
                await supabase.from('notifications').insert({
                    user_id: entry.user_id,
                    title: 'Compra Cancelada',
                    message: 'O prazo de 12h para pagamento da entrada expirou. A compra foi cancelada.',
                    type: 'alert'
                });
            }
        }

        // --- 2. Limpeza de Contratos Pendentes (> 24h) ---
        // (Mantido para casos onde não houve entrada, mas o contrato ficou pendente)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString();

        // Busca contratos pendentes expirados
        const { data: expiredContracts, error: contractError } = await supabase
            .from('contracts')
            .select('id, user_id, created_at')
            .eq('status', 'pending_signature')
            .lt('created_at', yesterdayStr);

        if (contractError) console.error('Erro buscando contratos expirados:', contractError);

        if (expiredContracts && expiredContracts.length > 0) {
            for (const contract of expiredContracts) {
                // Atualiza status do contrato
                await supabase.from('contracts').update({ status: 'Cancelado' }).eq('id', contract.id);
                contractsCancelled++;
                
                // Cancela as faturas associadas
                const contractTime = new Date(contract.created_at).getTime();
                const minTime = new Date(contractTime - 60000).toISOString();
                const maxTime = new Date(contractTime + 60000).toISOString();

                await supabase.from('invoices')
                    .update({ status: 'Cancelado', notes: 'Cancelado por falta de assinatura do contrato (24h).' })
                    .eq('user_id', contract.user_id)
                    .eq('status', 'Aguardando Assinatura')
                    .gte('created_at', minTime)
                    .lte('created_at', maxTime);
            }
        }

        // --- 3. Verificação de Vencimentos (Rotina Padrão) ---
        const today = new Date();
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(today.getDate() + 3);

        const todayStr = today.toISOString().split('T')[0];
        const threeDaysStr = threeDaysFromNow.toISOString().split('T')[0];

        const { data: invoices, error } = await supabase
            .from('invoices')
            .select(`
                id, 
                amount, 
                due_date, 
                month,
                user_id, 
                profiles (first_name, email)
            `)
            .eq('status', 'Em aberto')
            .or(`due_date.eq.${todayStr},due_date.eq.${threeDaysStr}`);

        if (error) throw error;

        let notificationsSent = 0;
        let emailsSent = 0;

        if (invoices && invoices.length > 0) {
            for (const invoice of invoices) {
                // Ignora se for a fatura de entrada (já tem regras próprias acima)
                if (invoice.month.includes('Entrada')) continue;

                const profile = invoice.profiles as any;
                if (!profile) continue;

                const isDueToday = invoice.due_date === todayStr;
                const title = isDueToday ? '⚠️ Fatura Vence Hoje!' : '📅 Fatura Vencendo';
                const message = isDueToday 
                    ? `Olá ${profile.first_name}, sua fatura de R$ ${invoice.amount} vence hoje. Evite juros!`
                    : `Olá ${profile.first_name}, lembrete: sua fatura de R$ ${invoice.amount} vence em 3 dias.`;
                const type = isDueToday ? 'alert' : 'warning';

                const { data: existingNotif } = await supabase
                    .from('notifications')
                    .select('id')
                    .eq('user_id', invoice.user_id)
                    .eq('title', title)
                    .gte('created_at', todayStr + 'T00:00:00')
                    .single();

                if (!existingNotif) {
                    await supabase.from('notifications').insert({
                        user_id: invoice.user_id,
                        title: title,
                        message: message,
                        type: type,
                        read: false
                    });
                    notificationsSent++;
                }

                const emailBody = `Olá ${profile.first_name}, ${message}`;
                await sendEmailMock(profile.email, title, emailBody);
                emailsSent++;
            }
        }

        await supabase.from('action_logs').insert({
            action_type: 'CRON_DAILY_CHECK',
            status: 'SUCCESS',
            description: `Rotina executada. Entradas Canceladas: ${entriesCancelled}. Parcelas Canceladas: ${installmentsCancelled}. Contratos Cancelados: ${contractsCancelled}. Notificações: ${notificationsSent}.`,
            details: { entriesCancelled, installmentsCancelled, contractsCancelled, notificationsSent, emailsSent }
        });

        return res.status(200).json({ 
            success: true, 
            entries_cancelled: entriesCancelled,
            installments_cancelled: installmentsCancelled,
            contracts_cancelled: contractsCancelled,
            notifications_sent: notificationsSent
        });

    } catch (error: any) {
        console.error('Erro no Cron Job:', error);
        await supabase.from('action_logs').insert({
            action_type: 'CRON_DAILY_CHECK',
            status: 'FAILURE',
            description: 'Erro fatal no cron job.',
            details: { error: error.message }
        });
        return res.status(500).json({ error: error.message });
    }
}
