
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
        // --- 1. Limpeza de Contratos Pendentes (> 24h) ---
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

        let contractsCancelled = 0;
        if (expiredContracts && expiredContracts.length > 0) {
            for (const contract of expiredContracts) {
                // Atualiza status do contrato
                await supabase.from('contracts').update({ status: 'Cancelado' }).eq('id', contract.id);
                
                // Cancela as faturas associadas (assumindo timestamp próximo como vínculo, já que não temos FK direta no design atual)
                // Uma abordagem mais robusta seria adicionar contract_id na tabela invoices, mas usando a lógica de tempo:
                const contractTime = new Date(contract.created_at).getTime();
                // Intervalo de tolerância de 5 segundos (mesmo batch de criação)
                const startTime = new Date(contractTime - 5000).toISOString();
                const endTime = new Date(contractTime + 5000).toISOString();

                await supabase.from('invoices')
                    .update({ status: 'Cancelado', notes: 'Cancelado por falta de assinatura do contrato (24h).' })
                    .eq('user_id', contract.user_id)
                    .eq('status', 'Aguardando Assinatura')
                    .gte('created_at', startTime)
                    .lte('created_at', endTime);
                
                contractsCancelled++;
                
                // Notifica usuário
                await supabase.from('notifications').insert({
                    user_id: contract.user_id,
                    title: 'Compra Cancelada',
                    message: 'O prazo de 24h para assinatura do contrato expirou. Sua compra foi cancelada.',
                    type: 'alert'
                });
            }
        }

        // --- 2. Verificação de Vencimentos (Rotina Padrão) ---
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
            description: `Rotina executada. Contracts Cancelled: ${contractsCancelled}. Invoices Notified: ${notificationsSent}.`,
            details: { contractsCancelled, notificationsSent, emailsSent }
        });

        return res.status(200).json({ 
            success: true, 
            contracts_cancelled: contractsCancelled,
            notifications_sent: notificationsSent, 
            emails_sent: emailsSent 
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
